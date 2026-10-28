'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Crosshair, Loader2, Minus, Plus } from 'lucide-react';

/**
 * A small OpenStreetMap pin picker.
 *
 * The map is a plain tile grid rather than a mapping SDK: one dependency fewer,
 * no API key, and the pin is always the exact centre of the viewport. Dragging
 * the map moves the pin; the final coordinates are reported to the form, which
 * sends them to the server for hub resolution.
 */

const TILE_SIZE = 256;
const MIN_ZOOM = 5;
const MAX_ZOOM = 19;

function lngToTileX(lng: number, zoom: number) {
  return ((lng + 180) / 360) * Math.pow(2, zoom);
}

function latToTileY(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
    Math.pow(2, zoom)
  );
}

function tileXToLng(x: number, zoom: number) {
  return (x / Math.pow(2, zoom)) * 360 - 180;
}

function tileYToLat(y: number, zoom: number) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function clampLat(lat: number) {
  return Math.max(-85.05112878, Math.min(85.05112878, lat));
}

interface AddressMapProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  className?: string;
}

export const AddressMap: React.FC<AddressMapProps> = ({
  lat,
  lng,
  onChange,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 640, height: 320 });
  const [center, setCenter] = useState({ lat: clampLat(lat), lng });
  const [zoom, setZoom] = useState(16);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Follow coordinates chosen elsewhere (for example "use my location" or
  // editing a different saved address).
  useEffect(() => {
    setCenter({ lat: clampLat(lat), lng });
  }, [lat, lng]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const update = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    centerX: number;
    centerY: number;
    moved: boolean;
  } | null>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      centerX: lngToTileX(center.lng, zoom),
      centerY: latToTileY(center.lat, zoom),
      moved: false,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;

    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (Math.abs(dx) + Math.abs(dy) > 2) state.moved = true;

    const nextLng = tileXToLng(state.centerX - dx / TILE_SIZE, zoom);
    const nextLat = tileYToLat(state.centerY - dy / TILE_SIZE, zoom);
    setCenter({ lat: clampLat(nextLat), lng: nextLng });
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (state.moved) {
      onChange(center.lat, center.lng);
    }
  };

  const useMyLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError('This browser does not expose a location API.');
      return;
    }

    setLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: clampLat(position.coords.latitude),
          lng: position.coords.longitude,
        };
        setCenter(next);
        setZoom(17);
        onChange(next.lat, next.lng);
        setLocating(false);
      },
      () => {
        setLocationError(
          'Location permission was denied. Drag the map to place the pin instead.',
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, [onChange]);

  const changeZoom = (delta: number) => {
    setZoom((current) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current + delta)));
  };

  const centerX = lngToTileX(center.lng, zoom);
  const centerY = latToTileY(center.lat, zoom);
  const left = centerX - size.width / TILE_SIZE / 2;
  const top = centerY - size.height / TILE_SIZE / 2;

  const startX = Math.floor(left);
  const endX = Math.floor(left + size.width / TILE_SIZE);
  const startY = Math.floor(top);
  const endY = Math.floor(top + size.height / TILE_SIZE);
  const tileCount = Math.pow(2, zoom);

  const tiles: React.ReactNode[] = [];
  for (let x = startX; x <= endX; x += 1) {
    for (let y = startY; y <= endY; y += 1) {
      if (y < 0 || y >= tileCount) continue;
      const wrappedX = ((x % tileCount) + tileCount) % tileCount;
      tiles.push(
        <img
          key={`${x}:${y}`}
          src={`https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`}
          alt=""
          draggable={false}
          className="absolute select-none pointer-events-none"
          style={{
            width: TILE_SIZE,
            height: TILE_SIZE,
            left: (x - left) * TILE_SIZE,
            top: (y - top) * TILE_SIZE,
          }}
        />,
      );
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative w-full h-64 sm:h-80 overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-200 dark:bg-slate-800 cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: 'none' }}
        role="application"
        aria-label="Delivery location map. Drag to move the pin."
      >
        {tiles}

        {/* The pin is fixed at the viewport centre; the map moves under it. */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full pointer-events-none drop-shadow-lg">
          <svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true">
            <path
              d="M17 43C17 43 33 26.6 33 16.5C33 7.4 25.8 0 17 0C8.2 0 1 7.4 1 16.5C1 26.6 17 43 17 43Z"
              fill="#e11d48"
              stroke="white"
              strokeWidth="2"
            />
            <circle cx="17" cy="16" r="6" fill="white" />
          </svg>
        </div>
        <div className="absolute left-1/2 top-1/2 w-3 h-1.5 -translate-x-1/2 rounded-full bg-black/25 blur-[1px] pointer-events-none" />

        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => changeZoom(1)}
            className="w-8 h-8 rounded-lg bg-white/95 dark:bg-slate-900/95 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-white flex items-center justify-center shadow-sm"
            aria-label="Zoom in"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => changeZoom(-1)}
            className="w-8 h-8 rounded-lg bg-white/95 dark:bg-slate-900/95 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-white flex items-center justify-center shadow-sm"
            aria-label="Zoom out"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/95 dark:bg-slate-900/95 border border-gray-200 dark:border-slate-700 text-[11px] font-extrabold text-gray-800 dark:text-white shadow-sm disabled:opacity-60"
        >
          {locating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Crosshair className="w-3.5 h-3.5 text-rose-500" />
          )}
          Use my current location
        </button>

        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-950/80 text-[9px] text-gray-600 dark:text-slate-300"
        >
          © OpenStreetMap contributors
        </a>
      </div>

      <div className="flex items-center justify-between gap-3 text-[10px] text-gray-500 dark:text-slate-400">
        <span>
          Pin: {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
        </span>
        <span>Drag the map to place the pin exactly on your door.</span>
      </div>

      {locationError && (
        <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
          {locationError}
        </p>
      )}
    </div>
  );
};
