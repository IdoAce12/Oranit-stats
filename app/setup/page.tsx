"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addPlayers, createMatch, listSquad } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { SquadPlayer } from "@/lib/types";
import { AppHeader } from "../components/AppHeader";
import { ConfigBanner } from "../components/ConfigBanner";

interface Selection {
  selected: boolean;
  number: string; // מספר לאותו משחק (ניתן לעקיפה)
}

export default function SetupPage() {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [opponent, setOpponent] = useState("");
  const [matchDate, setMatchDate] = useState(today);
  const [teamName, setTeamName] = useState("");

  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [sel, setSel] = useState<Record<string, Selection>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    listSquad()
      .then((all) => {
        // מציגים את כל הסגל; פעילים מסומנים כברירת מחדל
        setSquad(all);
        const initial: Record<string, Selection> = {};
        all.forEach((p) => {
          initial[p.id] = {
            selected: p.active !== false,
            number: String(p.shirt_number),
          };
        });
        setSel(initial);
      })
      .catch((e) => setError(e.message ?? "שגיאה"))
      .finally(() => setLoading(false));
  }, []);

  const selectedCount = Object.values(sel).filter((s) => s.selected).length;

  const toggle = (id: string) =>
    setSel((prev) => ({ ...prev, [id]: { ...prev[id], selected: !prev[id].selected } }));

  const setNumber = (id: string, number: string) =>
    setSel((prev) => ({ ...prev, [id]: { ...prev[id], number } }));

  const setAll = (value: boolean) =>
    setSel((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => (next[id] = { ...next[id], selected: value }));
      return next;
    });

  const handleSubmit = async () => {
    setError(null);
    if (!opponent.trim()) return setError("צריך להזין שם יריב");

    const chosen = squad
      .filter((p) => sel[p.id]?.selected)
      .map((p) => ({
        squad_player_id: p.id,
        shirt_number: parseInt(sel[p.id].number, 10) || p.shirt_number,
        name: p.name,
        position: p.position,
      }));

    if (chosen.length === 0) return setError("בחר לפחות שחקן אחד למשחק");

    setSaving(true);
    try {
      const match = await createMatch({
        opponent: opponent.trim(),
        match_date: matchDate,
        our_team_name: teamName.trim(),
      });
      await addPlayers(match.id, chosen);
      router.push(`/live/${match.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בשמירה");
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-6 pb-28">
      <AppHeader title="משחק חדש" backHref="/" />

      <ConfigBanner />

      <div className="card mb-4 flex flex-col gap-3 p-4">
        <label className="flex flex-col gap-1.5">
          <span className="label">שם היריב</span>
          <input
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="לדוגמה: הפועל מגדל"
            className="field w-full"
          />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="label">תאריך</span>
            <input
              type="date"
              value={matchDate}
              onChange={(e) => setMatchDate(e.target.value)}
              className="field w-full"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="label">הקבוצה שלנו</span>
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="אופציונלי"
              className="field w-full"
            />
          </label>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <span className="label">
          הרכב למשחק <span className="text-[var(--accent)]">({selectedCount})</span>
        </span>
        <div className="flex gap-2 text-xs">
          <button onClick={() => setAll(true)} className="btn btn-ghost h-8 px-3">
            הכל
          </button>
          <button onClick={() => setAll(false)} className="btn btn-ghost h-8 px-3">
            נקה
          </button>
        </div>
      </div>

      {loading && <p className="text-[var(--muted)]">טוען סגל...</p>}

      {!loading && squad.length === 0 && (
        <div className="card p-6 text-center text-sm text-[var(--muted)]">
          אין עדיין שחקנים בסגל.
          <Link href="/squad" className="mt-3 block font-bold text-[var(--accent)]">
            ← עבור לניהול הסגל
          </Link>
        </div>
      )}

      {!loading && squad.length > 0 && selectedCount === 0 && (
        <p className="mb-2 text-xs text-amber-300">
          אף שחקן לא מסומן. סמן לפחות אחד, או לחץ &quot;הכל&quot;.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {squad.map((p) => {
          const s = sel[p.id];
          const on = s?.selected;
          return (
            <li
              key={p.id}
              className={`card flex items-center gap-3 p-2.5 transition ${on ? "" : "opacity-45"}`}
            >
              <button
                type="button"
                onClick={() => toggle(p.id)}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-sm font-bold ${
                  on
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[#04150e]"
                    : "border-[var(--border-strong)] text-transparent"
                }`}
                aria-label={on ? "הסר מהרכב" : "הוסף להרכב"}
              >
                ✓
              </button>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={s?.number ?? ""}
                onChange={(e) =>
                  setNumber(p.id, e.target.value.replace(/[^\d]/g, "").slice(0, 2))
                }
                className="field w-14 shrink-0 px-0 text-center text-lg font-extrabold tabular"
                aria-label="מספר חולצה למשחק"
              />
              <div className="min-w-0 flex-1" onClick={() => toggle(p.id)}>
                <p className="truncate font-bold">{p.name}</p>
                <p className="truncate text-xs text-[var(--muted)]">
                  {p.position ? `${p.position} · ` : ""}
                  {p.active === false ? "לא פעיל בסגל" : "בסגל"}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-3 text-[var(--danger)]">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md p-4">
        <button
          onClick={handleSubmit}
          disabled={saving || !isSupabaseConfigured || squad.length === 0}
          className="btn btn-primary w-full py-4 text-lg shadow-2xl"
        >
          {saving ? "מתחיל..." : `התחל משחק ← ${selectedCount ? `(${selectedCount})` : ""}`}
        </button>
      </div>
    </main>
  );
}
