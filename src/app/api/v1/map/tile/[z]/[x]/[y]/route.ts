import type { NextRequest } from 'next/server';
import { env } from '@/lib/config/env';

/**
 * GET /api/v1/map/tile/{z}/{x}/{y} — one raster map tile, fetched on the
 * citizen's behalf.
 *
 * The browser could request tile.openstreetmap.org directly. It is proxied
 * anyway, for four reasons that are not interchangeable:
 *
 *  1. **OSM's Tile Usage Policy requires an identifying User-Agent** and blocks
 *     traffic without one. A browser `<img>` sends the browser's own agent and
 *     cannot be told otherwise, so direct requests are both against the policy
 *     and liable to be refused. A server fetch can identify itself honestly.
 *
 *  2. **The CSP stays at `img-src 'self'`.** Adding a third-party tile host to
 *     the policy widens the image origin for every page in the app, permanently,
 *     to buy one feature. Proxying costs nothing there.
 *
 *  3. **The tile host never sees the citizen.** Tiles are requested by the
 *     server, so OSM receives no IP address, no referer and no cookie belonging
 *     to someone looking up a legal-aid office or a hospital. On this app that is
 *     not a small thing: the map someone pans is a record of what they are
 *     dealing with.
 *
 *  4. **The provider becomes swappable.** `MAP_TILE_URL` moves to a paid host or
 *     a self-run cache without touching the client or the CSP.
 *
 * Tiles are immutable for practical purposes and cached hard, both by the browser
 * and by any shared cache — this is the one response in the app with no citizen
 * data in it, so `public` is correct here and wrong nearly everywhere else.
 */

/** OSM serves up to z19. Beyond that is a guaranteed 404, so refuse it locally. */
const MAX_ZOOM = 19;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const { z, x, y } = await params;

  const zoom = Number(z);
  const tileX = Number(x);
  const tileY = Number(y);

  /**
   * Validated as a coordinate, not just as a number.
   *
   * This is the security boundary of the whole route: the values are
   * interpolated into an outbound URL, so anything that is not a plain integer
   * in range is a request to fetch something else. Range-checking against
   * `2**zoom` also means a malformed URL fails here instead of costing an
   * upstream round trip.
   */
  const count = 2 ** zoom;
  const valid =
    Number.isInteger(zoom) && zoom >= 0 && zoom <= MAX_ZOOM &&
    Number.isInteger(tileX) && tileX >= 0 && tileX < count &&
    Number.isInteger(tileY) && tileY >= 0 && tileY < count;

  if (!valid) {
    return new Response('Not a tile', { status: 400 });
  }

  const upstream = env.MAP_TILE_URL
    .replace('{z}', String(zoom))
    .replace('{x}', String(tileX))
    .replace('{y}', String(tileY));

  try {
    const response = await fetch(upstream, {
      headers: {
        'User-Agent': env.MAP_USER_AGENT,
        Accept: 'image/png,image/webp,image/*',
      },
      // A tile is decoration. If it is slow, the citizen should get the list and
      // a grey square, not a hanging page.
      signal: AbortSignal.timeout(8000),
      cache: 'force-cache',
    });

    if (!response.ok || !response.body) {
      // Pass the upstream status through rather than inventing one: a 404 for a
      // sea tile is normal and the browser handles it, while a 429 is a signal
      // the deployment needs its own tile cache.
      return new Response(null, { status: response.status === 404 ? 404 : 502 });
    }

    const contentType = response.headers.get('content-type') ?? 'image/png';
    if (!contentType.startsWith('image/')) {
      // An HTML error page from the tile host must not be handed back as an
      // image; the browser would render nothing and log a confusing decode error.
      return new Response(null, { status: 502 });
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // 30 days in the browser, a year in a shared cache. Tile pixels for a
        // given z/x/y effectively do not change.
        'Cache-Control': 'public, max-age=2592000, s-maxage=31536000, immutable',
        // Attribution travels with the bytes, so it is discoverable from the
        // network tab even though the visible credit is rendered on the map.
        'X-Tile-Source': 'OpenStreetMap contributors, ODbL',
      },
    });
  } catch {
    // Timeout or DNS failure. 504 rather than 500: nothing is broken here, the
    // upstream simply did not answer, and the map degrades to a grey grid.
    return new Response(null, { status: 504 });
  }
}
