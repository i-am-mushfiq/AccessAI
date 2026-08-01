'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Minus, Plus, Crosshair } from 'lucide-react';
import {
  tilesForViewport, markerOffset, unproject, project, fitZoom, centroid,
  TILE_SIZE, type LatLng,
} from '@/lib/geo/mercator';
import { cn } from '@/lib/utils/cn';

/**
 * A slippy map, with no map library.
 *
 * Written rather than imported, deliberately. Leaflet plus its stylesheet is
 * ~45 KB gzipped before a single tile loads, on a screen whose whole point is
 * working on a cheap Android phone over 2G (BDS §4.7 keeps the client bundle
 * honest). This is about 200 lines, ships nothing extra, and — the part that
 * actually decided it — is easier to make keyboard-operable than a third-party
 * canvas is to retrofit.
 *
 * The map is an ENHANCEMENT and never the only route to anything. Every place
 * shown here is also in the list below it, with its address, phone number and
 * directions link. A citizen who cannot see, cannot drag, or has tiles blocked
 * loses nothing but the picture. That is why there is no map-only control.
 *
 * Accessibility, since a hand-rolled map is exactly where it gets dropped:
 *  • The map is a labelled `application` region with real keyboard handling —
 *    arrows pan, +/− zoom, Home re-frames.
 *  • Every marker is a `<button>` in the tab order with an accessible name that
 *    includes the distance, so it is usable without seeing the pin.
 *  • Tiles are `aria-hidden` decoration. The information is in the markers.
 *  • Nothing conveys meaning by colour alone: each marker carries a letter glyph
 *    for its category as well as a tint (BDS §2.2 rule 4).
 */

export interface MapMarker {
  readonly id: string;
  readonly lat: number;
  readonly lng: number;
  readonly label: string;
  /** Spoken/read description — type and distance. */
  readonly description: string;
  /** One or two characters identifying the category without colour. */
  readonly glyph: string;
  readonly emphasis: boolean;
}

/** How far one arrow-key press moves the map, in pixels. */
const PAN_STEP = 80;
const MIN_ZOOM = 6;
const MAX_ZOOM = 18;

export function MapView({
  markers,
  centre: initialCentre,
  reference,
  referenceLabel,
  onSelect,
  selectedId,
  height = 320,
  className,
}: {
  readonly markers: readonly MapMarker[];
  readonly centre: LatLng;
  /** Where distances are measured from — drawn distinctly from the results. */
  readonly reference: LatLng | null;
  readonly referenceLabel: string;
  readonly onSelect?: (id: string) => void;
  readonly selectedId?: string | null;
  readonly height?: number;
  readonly className?: string;
}) {
  const t = useTranslations('nearby');

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height });
  const [centre, setCentre] = useState<LatLng>(initialCentre);
  const [zoom, setZoom] = useState(12);
  /** Tiles that 404'd or timed out, so a grey square is drawn once, not retried. */
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const [framed, setFramed] = useState(false);

  /* ------------------------------------------------------------ sizing */

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const measure = () => {
      setSize({ width: element.clientWidth, height: element.clientHeight });
    };
    measure();

    // The map must re-tile on rotation and on a text-scale change, both of which
    // resize it without a window resize event.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /**
   * Frame every result once the width is known.
   *
   * Deferred rather than done on mount because it needs the real width, and it
   * runs ONCE — re-framing after the citizen has panned would fight them for
   * control of the map.
   */
  const points = useMemo(
    () => markers.map((m) => ({ lat: m.lat, lng: m.lng })),
    [markers],
  );

  const frame = useCallback(() => {
    if (size.width === 0) return;
    const all = reference ? [...points, reference] : points;
    if (all.length === 0) return;
    const middle = centroid(all) ?? initialCentre;
    setCentre(middle);
    setZoom(fitZoom(all, size.width, size.height));
  }, [points, reference, size.width, size.height, initialCentre]);

  useEffect(() => {
    if (framed || size.width === 0) return;
    frame();
    setFramed(true);
  }, [framed, frame, size.width]);

  /* ------------------------------------------------------------ panning */

  const dragRef = useRef<{ x: number; y: number; centre: LatLng } | null>(null);

  const panByPixels = useCallback(
    (dx: number, dy: number) => {
      setCentre((current) => {
        const pixel = project(current, Math.round(zoom));
        return unproject({ x: pixel.x + dx, y: pixel.y + dy }, Math.round(zoom));
      });
    },
    [zoom],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // Let a marker button receive its own click.
    if ((event.target as HTMLElement).closest('button')) return;
    dragRef.current = { x: event.clientX, y: event.clientY, centre };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const z = Math.round(zoom);
    const start = project(drag.centre, z);
    // Dragging right moves the map right, so the CENTRE moves left.
    setCentre(
      unproject(
        { x: start.x - (event.clientX - drag.x), y: start.y - (event.clientY - drag.y) },
        z,
      ),
    );
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowUp': panByPixels(0, -PAN_STEP); break;
      case 'ArrowDown': panByPixels(0, PAN_STEP); break;
      case 'ArrowLeft': panByPixels(-PAN_STEP, 0); break;
      case 'ArrowRight': panByPixels(PAN_STEP, 0); break;
      case '+': case '=': setZoom((z) => Math.min(MAX_ZOOM, z + 1)); break;
      case '-': case '_': setZoom((z) => Math.max(MIN_ZOOM, z - 1)); break;
      case 'Home': frame(); break;
      default: return;
    }
    // Only after a key we handled, so Tab and shortcuts still work.
    event.preventDefault();
  };

  /* -------------------------------------------------------------- render */

  const { tiles } = useMemo(
    () =>
      size.width > 0
        ? tilesForViewport(centre, zoom, size.width, size.height)
        : { tiles: [], centrePixel: { x: 0, y: 0 } },
    [centre, zoom, size.width, size.height],
  );

  const placed = useMemo(
    () =>
      size.width === 0
        ? []
        : markers
            .map((marker) => ({
              marker,
              offset: markerOffset(marker, centre, zoom, size.width, size.height),
            }))
            // Off-screen pins are dropped rather than clamped to the edge: a pin
            // pinned to the border claims a location it is not at.
            .filter(
              ({ offset }) =>
                offset.x > -40 && offset.x < size.width + 40 &&
                offset.y > -40 && offset.y < size.height + 40,
            ),
    [markers, centre, zoom, size.width, size.height],
  );

  const referenceOffset =
    reference && size.width > 0
      ? markerOffset(reference, centre, zoom, size.width, size.height)
      : null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        ref={containerRef}
        role="application"
        aria-label={t('mapLabel')}
        aria-describedby="map-help"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ height }}
        className="relative touch-none select-none overflow-hidden rounded-lg border border-stroke-subtle bg-surface-sunken focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
      >
        {/* ---- tiles: decoration only ---- */}
        <div aria-hidden="true" className="absolute inset-0">
          {tiles.map((tile) => {
            const key = `${tile.z}/${tile.x}/${tile.y}`;
            if (failed.has(key)) return null;
            return (
              // eslint-disable-next-line @next/next/no-img-element -- raster map
              // tiles are already exactly 256 px and served through our own
              // proxy; next/image would add a second resize and a loader for no
              // benefit.
              <img
                key={`${key}@${tile.left},${tile.top}`}
                src={`/api/v1/map/tile/${tile.z}/${tile.x}/${tile.y}`}
                alt=""
                width={TILE_SIZE}
                height={TILE_SIZE}
                draggable={false}
                loading="eager"
                decoding="async"
                onError={() => setFailed((current) => new Set(current).add(key))}
                style={{
                  position: 'absolute',
                  left: Math.round(tile.left),
                  top: Math.round(tile.top),
                  width: TILE_SIZE,
                  height: TILE_SIZE,
                }}
              />
            );
          })}
        </div>

        {/* ---- where distances are measured from ---- */}
        {referenceOffset ? (
          <span
            aria-hidden="true"
            title={referenceLabel}
            className="pointer-events-none absolute z-raised flex h-5 w-5 items-center justify-center rounded-pill border-2 border-white bg-ramp-info-600 shadow-elev-2"
            style={{ left: referenceOffset.x - 10, top: referenceOffset.y - 10 }}
          />
        ) : null}

        {/* ---- results ---- */}
        {placed.map(({ marker, offset }) => {
          const selected = selectedId === marker.id;
          return (
            <button
              key={marker.id}
              type="button"
              onClick={() => onSelect?.(marker.id)}
              aria-label={`${marker.label}. ${marker.description}`}
              aria-current={selected ? 'true' : undefined}
              className={cn(
                'absolute z-raised flex items-center justify-center rounded-pill border-2 border-white type-caption font-semibold shadow-elev-2',
                'focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2',
                selected ? 'h-9 w-9 ring-2 ring-stroke-focus' : 'h-7 w-7',
                marker.emphasis
                  ? 'bg-ramp-error-600 text-white'
                  : 'bg-ramp-green-600 text-white',
              )}
              style={{
                left: offset.x - (selected ? 18 : 14),
                top: offset.y - (selected ? 18 : 14),
              }}
            >
              {/* A letter as well as a tint — colour alone is never the cue. */}
              <span aria-hidden="true">{marker.glyph}</span>
            </button>
          );
        })}

        {/* ---- zoom ---- */}
        <div className="absolute end-2 top-2 z-raised flex flex-col gap-1">
          <MapButton label={t('zoomIn')} onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))} disabled={zoom >= MAX_ZOOM}>
            <Plus size={20} className="icon" aria-hidden="true" />
          </MapButton>
          <MapButton label={t('zoomOut')} onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))} disabled={zoom <= MIN_ZOOM}>
            <Minus size={20} className="icon" aria-hidden="true" />
          </MapButton>
          <MapButton label={t('recentreMap')} onClick={frame}>
            <Crosshair size={20} className="icon" aria-hidden="true" />
          </MapButton>
        </div>
      </div>

      {/* Attribution is a requirement of the ODbL licence, not a nicety, and it
          stays visible rather than hidden behind an info button. */}
      <p className="type-caption flex flex-wrap items-center gap-x-2 text-text-tertiary">
        <span id="map-help">{t('mapKeyboardHelp')}</span>
        <span>
          {'© '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-link underline"
          >
            OpenStreetMap
          </a>
          {' '}
          {t('osmContributors')}
        </span>
      </p>
    </div>
  );
}

function MapButton({
  label,
  onClick,
  disabled,
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      // 48 dp even on the map: BDS §1.1 sets the minimum target and a map control
      // is not exempt just because it is small on other people's maps.
      className="flex h-12 w-12 items-center justify-center rounded-md border border-stroke-subtle bg-surface text-text-primary shadow-elev-1 hover:bg-surface-sunken disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-stroke-focus focus-visible:outline-offset-2"
    >
      {children}
    </button>
  );
}
