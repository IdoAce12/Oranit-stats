"use client";

import { useEffect, useState } from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function Countdown({ target }: { target: Date }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = target.getTime() - now;
  if (Number.isNaN(target.getTime())) {
    return <p className="text-sm text-[var(--muted)]">אין שעת שריקה</p>;
  }
  if (diff <= 0) {
    return <p className="text-lg font-black text-[var(--accent)]">המשחק היום</p>;
  }

  const total = Math.floor(diff / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const cells = [
    { n: days, label: "ימים" },
    { n: hours, label: "שעות" },
    { n: minutes, label: "דקות" },
    { n: seconds, label: "שניות" },
  ];

  return (
    <div className="grid grid-cols-4 gap-2" dir="ltr">
      {cells.map((c) => (
        <div key={c.label} className="rounded-2xl bg-black/20 px-1 py-2 text-center">
          <div className="tabular text-2xl font-black">{c.label === "ימים" ? c.n : pad(c.n)}</div>
          <div className="text-[10px] font-bold text-[var(--muted)]">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
