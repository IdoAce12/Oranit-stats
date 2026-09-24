"use client";

import { useState } from "react";
import { crestSrcForTeam, opponentInitials, OUR_CREST_SRC } from "@/lib/teamMark";
import type { IfaStandingRow } from "@/lib/ifa/parse";

export function CrestMark({
  name,
  standings,
  ours = false,
  size = 32,
  className = "",
}: {
  name: string;
  standings: IfaStandingRow[];
  ours?: boolean;
  size?: number;
  className?: string;
}) {
  const src = ours ? OUR_CREST_SRC : crestSrcForTeam(name, standings);
  const [broken, setBroken] = useState(false);
  const initials = ours ? "הא" : opponentInitials(name);

  if (!src || broken) {
    return (
      <span
        className={`crest-fallback ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.36 }}
        aria-hidden
      >
        {initials}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`crest-img ${className}`}
      style={{ width: size, height: size }}
      onError={() => setBroken(true)}
    />
  );
}
