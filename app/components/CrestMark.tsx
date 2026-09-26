"use client";

import { useEffect, useState } from "react";
import { crestSrcForTeam, localCrestSrc, opponentInitials, OUR_CREST_SRC } from "@/lib/teamMark";
import type { IfaStandingRow } from "@/lib/ifa/parse";
import beitarTovrok from "../../public/crests/beitar-tovrok.png";
import bneiTira from "../../public/crests/bnei-tira.png";
import hapoelPardesiya from "../../public/crests/hapoel-pardesiya.png";
import hasharonNetanya from "../../public/crests/hasharon-netanya.png";
import maccabiQlansawa from "../../public/crests/maccabi-qlansawa.png";
import mkTaibe from "../../public/crests/mk-taibe.png";
import shimshonBneiTaibe from "../../public/crests/shimshon-bnei-taibe.png";

type StaticImg = string | { src: string };

function srcOf(img: StaticImg): string {
  return typeof img === "string" ? img : img.src;
}

const BUNDLED_CRESTS: Record<string, string> = {
  "/crests/beitar-tovrok.png": srcOf(beitarTovrok),
  "/crests/bnei-tira.png": srcOf(bneiTira),
  "/crests/hapoel-pardesiya.png": srcOf(hapoelPardesiya),
  "/crests/hasharon-netanya.png": srcOf(hasharonNetanya),
  "/crests/maccabi-qlansawa.png": srcOf(maccabiQlansawa),
  "/crests/mk-taibe.png": srcOf(mkTaibe),
  "/crests/shimshon-bnei-taibe.png": srcOf(shimshonBneiTaibe),
};

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
  const local = ours ? OUR_CREST_SRC : localCrestSrc(name);
  const src = ours ? OUR_CREST_SRC : (local && BUNDLED_CRESTS[local]) || crestSrcForTeam(name, standings);
  const [broken, setBroken] = useState(false);
  const initials = ours ? "הא" : opponentInitials(name);

  useEffect(() => {
    setBroken(false);
  }, [src]);

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
