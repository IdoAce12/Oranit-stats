"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CLUB_PHOTOS } from "@/lib/clubPhotos";

const INTERVAL_MS = 7000;

export function PhotoCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const startX = useRef<number | null>(null);

  const go = useCallback((dir: 1 | -1) => {
    setIndex((i) => (i + dir + CLUB_PHOTOS.length) % CLUB_PHOTOS.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => go(1), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, go, index]);

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    setPaused(true);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (startX.current == null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) > 46) go(dx > 0 ? -1 : 1);
    window.setTimeout(() => setPaused(false), 4000);
  };

  return (
    <div
      className="photo-stage"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        startX.current = null;
      }}
    >
      {CLUB_PHOTOS.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          draggable={false}
          className={`photo-slide ${i === index ? "is-active" : ""}`}
        />
      ))}
      <div className="photo-veil" aria-hidden />
      <div className="photo-dots" dir="ltr">
        {CLUB_PHOTOS.map((src, i) => (
          <button
            key={src}
            type="button"
            aria-label={`תמונה ${i + 1}`}
            className={i === index ? "is-on" : ""}
            onClick={() => {
              setIndex(i);
              setPaused(true);
              window.setTimeout(() => setPaused(false), 4000);
            }}
          />
        ))}
      </div>
    </div>
  );
}
