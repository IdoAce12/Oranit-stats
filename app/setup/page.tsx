"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { addPlayers, createMatch } from "@/lib/db";
import { listSquad } from "@/lib/db";
import { MAX_STARTERS } from "@/lib/playingMinutes";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { SquadPlayer } from "@/lib/types";
import { AppHeader } from "../components/AppHeader";
import { ConfigBanner } from "../components/ConfigBanner";

type Step = 1 | 2;

interface Selection {
  selected: boolean;
  starter: boolean;
  number: string;
}

export default function SetupPage() {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [step, setStep] = useState<Step>(1);
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
        setSquad(all);
        const initial: Record<string, Selection> = {};
        all.forEach((p) => {
          initial[p.id] = {
            selected: p.active !== false,
            starter: false,
            number: String(p.shirt_number),
          };
        });
        setSel(initial);
      })
      .catch((e) => setError(e.message ?? "שגיאה"))
      .finally(() => setLoading(false));
  }, []);

  const selectedSquad = useMemo(
    () => squad.filter((p) => sel[p.id]?.selected),
    [squad, sel]
  );
  const selectedCount = selectedSquad.length;
  const starterCount = selectedSquad.filter((p) => sel[p.id]?.starter).length;

  const toggle = (id: string) =>
    setSel((prev) => ({
      ...prev,
      [id]: { ...prev[id], selected: !prev[id].selected, starter: false },
    }));

  const toggleStarter = (id: string) => {
    setSel((prev) => {
      const cur = prev[id];
      if (!cur?.selected) return prev;
      if (cur.starter) {
        return { ...prev, [id]: { ...cur, starter: false } };
      }
      const currentStarters = Object.values(prev).filter((s) => s.selected && s.starter).length;
      if (currentStarters >= MAX_STARTERS) {
        setError(`אפשר לבחור עד ${MAX_STARTERS} שחקני שדה בהרכב הפותח`);
        return prev;
      }
      setError(null);
      return { ...prev, [id]: { ...cur, starter: true } };
    });
  };

  const setNumber = (id: string, number: string) =>
    setSel((prev) => ({ ...prev, [id]: { ...prev[id], number } }));

  const setAll = (value: boolean) =>
    setSel((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach(
        (id) => (next[id] = { ...next[id], selected: value, starter: value ? next[id].starter : false })
      );
      return next;
    });

  const goStep2 = () => {
    setError(null);
    if (!opponent.trim()) return setError("צריך להזין שם יריב");
    if (selectedCount === 0) return setError("בחר לפחות שחקן אחד לסגל המשחק");
    setStep(2);
  };

  const handleSubmit = async () => {
    setError(null);
    if (starterCount === 0) return setError("בחר לפחות שחקן אחד בהרכב הפותח");
    if (starterCount > MAX_STARTERS) {
      return setError(`מקסימום ${MAX_STARTERS} שחקני שדה בהרכב הפותח`);
    }

    const chosen = selectedSquad.map((p) => {
      const starter = sel[p.id].starter === true;
      return {
        squad_player_id: p.id,
        shirt_number: parseInt(sel[p.id].number, 10) || p.shirt_number,
        name: p.name,
        position: p.position,
        is_starter: starter,
        on_pitch: starter,
      };
    });

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
      <AppHeader
        title={step === 1 ? "משחק חדש — סגל" : "משחק חדש — הרכב פותח"}
        subtitle={
          step === 1
            ? "שלב 1 מתוך 2 · בחירת סגל למשחק"
            : `שלב 2 מתוך 2 · עד ${MAX_STARTERS} שחקני שדה`
        }
        backHref={step === 1 ? "/" : undefined}
      />

      {step === 2 && (
        <button
          type="button"
          onClick={() => {
            setStep(1);
            setError(null);
          }}
          className="mb-3 text-sm font-bold text-[var(--muted)]"
        >
          ← חזרה לסגל
        </button>
      )}

      <ConfigBanner />

      {step === 1 && (
        <>
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
              סגל למשחק <span className="text-[var(--accent)]">({selectedCount})</span>
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
          <p className="mb-2 text-[11px] text-[var(--muted-2)]">
            בשלב הזה בוחרים מי בסגל המשחק בלבד — ההרכב הפותח בשלב הבא.
          </p>
        </>
      )}

      {step === 2 && (
        <>
          <div className="card mb-3 px-4 py-3 text-sm">
            <p className="font-bold">מול {opponent}</p>
            <p className="text-[var(--muted)]">
              פותחים:{" "}
              <span className="tabular text-[var(--accent)]">
                {starterCount}/{MAX_STARTERS}
              </span>
              {" · "}
              ספסל: <span className="tabular">{selectedCount - starterCount}</span>
            </p>
          </div>
          <p className="mb-2 text-[11px] text-[var(--muted-2)]">
            לחץ XI על עד {MAX_STARTERS} שחקני שדה. השאר יישמרו כספסל לחילופים.
          </p>
        </>
      )}

      {loading && <p className="text-[var(--muted)]">טוען סגל...</p>}

      {!loading && squad.length === 0 && (
        <div className="card p-6 text-center text-sm text-[var(--muted)]">
          אין עדיין שחקנים בסגל.
          <Link href="/squad" className="mt-3 block font-bold text-[var(--accent)]">
            ← עבור לניהול הסגל
          </Link>
        </div>
      )}

      {step === 1 && (
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
                  aria-label={on ? "הסר מהסגל" : "הוסף לסגל"}
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
      )}

      {step === 2 && (
        <ul className="flex flex-col gap-2">
          {selectedSquad.map((p) => {
            const s = sel[p.id];
            const isXi = s?.starter === true;
            return (
              <li
                key={p.id}
                className={`card flex items-center gap-3 p-2.5 ${isXi ? "border-[var(--accent)]/40" : ""}`}
              >
                <span className="field flex h-11 w-14 shrink-0 items-center justify-center px-0 text-lg font-extrabold tabular">
                  {s?.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{p.name}</p>
                  <p className="text-xs text-[var(--muted)]">{isXi ? "הרכב פותח" : "ספסל"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleStarter(p.id)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-xs font-black ${
                    isXi
                      ? "bg-[var(--accent)] text-[#04150e]"
                      : "bg-[var(--panel-strong)] text-[var(--muted)]"
                  }`}
                >
                  {isXi ? "XI" : "ספסל"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="mt-3 text-[var(--danger)]">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md p-4">
        {step === 1 ? (
          <button
            onClick={goStep2}
            disabled={!isSupabaseConfigured || squad.length === 0}
            className="btn btn-primary w-full py-4 text-lg shadow-2xl"
          >
            המשך להרכב פותח ← ({selectedCount})
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={saving || starterCount === 0}
            className="btn btn-primary w-full py-4 text-lg shadow-2xl"
          >
            {saving
              ? "מתחיל..."
              : `התחל משחק ← (${starterCount} פותחים · ${selectedCount - starterCount} ספסל)`}
          </button>
        )}
      </div>
    </main>
  );
}
