import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { MapView, type MapMarker } from '@/components/nearby/MapView';
import { catalog, project, LOCALE_INDEX } from '@/messages/catalog';
import { TILE_SIZE } from '@/lib/geo/mercator';

/**
 * The map, rendered.
 *
 * Server-side rendering cannot show any of this: tiles and markers are placed
 * from the measured width, which is zero until a ResizeObserver fires in the
 * browser. So fetching the page proves only that the container exists. Everything
 * that makes the map a map — that tiles are requested, that pins land in the
 * right place, that it can be driven from a keyboard — is asserted here.
 *
 * The accessibility assertions are not decoration. A hand-rolled map is exactly
 * where keyboard support and non-colour cues get skipped, and BDS §2.2 rule 4
 * plus the 48 dp target minimum apply to a map control as much as to a button.
 */

const messages = project(catalog, LOCALE_INDEX.bn);

const dhaka = { lat: 23.8103, lng: 90.4125 };

const markers: MapMarker[] = [
  {
    id: 'osm:node/1',
    lat: 23.8104,
    lng: 90.4126,
    label: 'ঢাকা মেডিকেল কলেজ হাসপাতাল',
    description: 'হাসপাতাল · ০.৮ কিমি',
    glyph: 'হা',
    emphasis: true,
  },
  {
    id: 'osm:node/2',
    lat: 23.8120,
    lng: 90.4150,
    label: 'রমনা থানা',
    description: 'থানা · ১.২ কিমি',
    glyph: 'থা',
    emphasis: true,
  },
  {
    id: 'seed:1',
    lat: 23.8090,
    lng: 90.4100,
    label: 'জেলা সমাজসেবা অফিস',
    description: 'জেলা সমাজসেবা অফিস · ০.৬ কিমি',
    glyph: 'জ',
    emphasis: false,
  },
];

/**
 * jsdom reports every element as 0×0 and has no ResizeObserver, so the map would
 * render an empty grid forever. Both are supplied here — this is the browser's
 * half of the contract, not a behaviour under test.
 */
const VIEWPORT = { width: 640, height: 320 };

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: () => void) {}
      observe() {
        this.callback();
      }
      unobserve() {}
      disconnect() {}
    },
  );

  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return VIEWPORT.width;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return VIEWPORT.height;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Providers({ children }: { readonly children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="bn" messages={messages} timeZone="Asia/Dhaka">
      {children}
    </NextIntlClientProvider>
  );
}

async function renderMap(props: Partial<Parameters<typeof MapView>[0]> = {}) {
  const onSelect = vi.fn();
  await act(async () => {
    render(
      <Providers>
        <MapView
          markers={markers}
          centre={dhaka}
          reference={dhaka}
          referenceLabel="আপনার অবস্থান"
          onSelect={onSelect}
          height={VIEWPORT.height}
          {...props}
        />
      </Providers>,
    );
  });
  return { onSelect };
}

const tileImages = () =>
  [...document.querySelectorAll('img')].filter((img) =>
    (img.getAttribute('src') ?? '').includes('/api/v1/map/tile/'),
  );

describe('tiles', () => {
  it('requests tiles through this app, never a third-party host', async () => {
    /**
     * The CSP is `img-src 'self'`, and the tile host must not learn who is
     * looking up a legal-aid office. A direct tile.openstreetmap.org URL here
     * would break both at once.
     */
    await renderMap();
    const tiles = tileImages();

    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) {
      const src = tile.getAttribute('src')!;
      expect(src).toMatch(/^\/api\/v1\/map\/tile\/\d+\/\d+\/\d+$/);
      expect(src).not.toContain('openstreetmap.org');
      expect(src).not.toMatch(/^https?:/);
    }
  });

  it('covers the viewport', async () => {
    await renderMap();
    // 640×320 needs at least 3×2 tiles of 256 px, plus the pre-fetch ring.
    expect(tileImages().length).toBeGreaterThanOrEqual(6);
  });

  it('asks for correctly sized tiles', async () => {
    await renderMap();
    for (const tile of tileImages()) {
      expect(tile.getAttribute('width')).toBe(String(TILE_SIZE));
      expect(tile.getAttribute('height')).toBe(String(TILE_SIZE));
    }
  });

  it('hides tiles from assistive technology', async () => {
    /**
     * Tiles are decoration; the information is in the markers. Without this a
     * screen reader announces dozens of empty images before reaching anything
     * useful.
     */
    await renderMap();
    for (const tile of tileImages()) {
      expect(tile.getAttribute('alt')).toBe('');
      expect(tile.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it('requests only in-range tile coordinates', async () => {
    // y outside [0, 2^z) is a guaranteed 404 from every tile server.
    await renderMap();
    for (const tile of tileImages()) {
      const [, , , , , z, x, y] = tile.getAttribute('src')!.split('/');
      const count = 2 ** Number(z);
      expect(Number(x)).toBeGreaterThanOrEqual(0);
      expect(Number(x)).toBeLessThan(count);
      expect(Number(y)).toBeGreaterThanOrEqual(0);
      expect(Number(y)).toBeLessThan(count);
    }
  });
});

describe('markers', () => {
  it('renders one focusable button per place', async () => {
    // Not a div with a click handler: a pin has to be reachable by keyboard and
    // announced, because someone who cannot see it still needs the address.
    await renderMap();
    for (const marker of markers) {
      const button = screen.getByRole('button', { name: new RegExp(marker.label) });
      expect(button.tagName).toBe('BUTTON');
    }
  });

  it('names each marker with its type and distance, not just a pin', async () => {
    await renderMap();
    const hospital = screen.getByRole('button', { name: /ঢাকা মেডিকেল/ });
    expect(hospital.getAttribute('aria-label')).toContain('হাসপাতাল');
    expect(hospital.getAttribute('aria-label')).toContain('কিমি');
  });

  it('carries a letter glyph as well as a colour', async () => {
    /**
     * BDS §2.2 rule 4: never convey meaning by colour alone. A map of
     * identically shaped dots distinguished only by tint says nothing to a
     * colour-blind citizen, or on a greyscale screen.
     */
    await renderMap();
    for (const marker of markers) {
      const button = screen.getByRole('button', { name: new RegExp(marker.label) });
      expect(button.textContent).toContain(marker.glyph);
    }
  });

  it('reports the selected marker to the caller so the list can follow', async () => {
    // Tapping a pin must lead to the card with the address and phone number.
    const { onSelect } = await renderMap();
    await act(async () => {
      screen.getByRole('button', { name: /রমনা থানা/ }).click();
    });
    expect(onSelect).toHaveBeenCalledWith('osm:node/2');
  });

  it('places a marker at the centre point in the middle of the map', async () => {
    await renderMap({ markers: [{ ...markers[0]!, lat: dhaka.lat, lng: dhaka.lng }] });
    const button = screen.getByRole('button', { name: /ঢাকা মেডিকেল/ });
    const left = Number.parseFloat(button.style.left);
    const top = Number.parseFloat(button.style.top);

    // Within half a marker's width of centre; the offset accounts for pin size.
    expect(Math.abs(left - VIEWPORT.width / 2)).toBeLessThan(20);
    expect(Math.abs(top - VIEWPORT.height / 2)).toBeLessThan(20);
  });

  it('places a northern marker above a southern one', async () => {
    // Screen y grows downward. Getting this inverted is the classic Mercator slip
    // and looks entirely plausible until you compare two known places.
    await renderMap();
    const north = screen.getByRole('button', { name: /রমনা থানা/ });      // 23.8120
    const south = screen.getByRole('button', { name: /জেলা সমাজসেবা/ });  // 23.8090
    expect(Number.parseFloat(north.style.top)).toBeLessThan(Number.parseFloat(south.style.top));
  });

  it('renders no marker buttons when there is nothing to show', async () => {
    await renderMap({ markers: [] });
    // Only the three map controls remain.
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});

describe('driving it without a mouse', () => {
  const mapRegion = () => screen.getByRole('application');

  it('is a labelled, focusable region', async () => {
    await renderMap();
    const region = mapRegion();
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(region.getAttribute('aria-label')).toBeTruthy();
    // The keyboard instructions are wired up, not merely printed nearby.
    expect(region.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(region.getAttribute('aria-describedby')!)).not.toBeNull();
  });

  it('pans on the arrow keys', async () => {
    await renderMap();
    const before = tileImages().map((t) => t.getAttribute('src')).join();

    await act(async () => {
      mapRegion().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );
    });

    // Panning must change which tiles are on screen, or their placement.
    const after = tileImages()
      .map((t) => `${t.getAttribute('src')}@${(t as HTMLElement).style.left}`)
      .join();
    expect(after).not.toBe(before);
  });

  it('zooms on plus and minus', async () => {
    await renderMap();
    const zoomOf = () => tileImages()[0]!.getAttribute('src')!.split('/')[5];
    const start = zoomOf();

    await act(async () => {
      mapRegion().dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    });
    expect(Number(zoomOf())).toBe(Number(start) + 1);

    await act(async () => {
      mapRegion().dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true }));
    });
    expect(Number(zoomOf())).toBe(Number(start));
  });

  it('does not swallow keys it has no business handling', async () => {
    // Tab must still move focus, or the map becomes a trap.
    await renderMap();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    await act(async () => {
      mapRegion().dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
  });

  it('gives the zoom controls accessible names and full-size targets', async () => {
    await renderMap();
    for (const name of ['বড় করে দেখুন', 'ছোট করে দেখুন', 'সব আবার দেখান']) {
      const button = screen.getByRole('button', { name });
      // BDS §1.1: 48 dp minimum. A map control is not exempt.
      expect(button.className).toMatch(/h-12/);
      expect(button.className).toMatch(/w-12/);
    }
  });
});

describe('attribution', () => {
  it('credits OpenStreetMap visibly, as the ODbL requires', async () => {
    // A licence requirement, not a nicety, and not hidden behind an info button.
    await renderMap();
    const link = screen.getByRole('link', { name: /OpenStreetMap/ });
    expect(link.getAttribute('href')).toBe('https://www.openstreetmap.org/copyright');
  });
});
