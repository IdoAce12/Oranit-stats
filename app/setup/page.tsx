"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LineupPitch } from "../components/LineupPitch";
import { AppHeader } from "../components/AppHeader";
import { ConfigBanner } from "../components/ConfigBanner";
import { addPlayers, createMatch, listSquad } from "@/lib/db";
import { autoAssignSlots, LINEUP_SIZE, PitchOccupant } from "@/lib/formation";
import { MAX_STARTERS } from "@/lib/playingMinutes";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { SquadPlayer } from "@/lib/types";

type Step = 1 | 2;

interface Selection {
  selected: boolean;
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
  const [slots, setSlots] = useState<(string | null)[]>(() => Array(LINEUP_SIZE).fill(null));
  const [pickId, setPickId] = useState<string | null>(null);
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
  const starterCount = slots.filter(Boolean).length;

  const occupants = useMemo((): (PitchOccupant | null)[] => {
    return slots.map((id) => {
      if (!id) return null;
      const p = squad.find((s) => s.id === id);
      if (!p) return null;
      return {
        id: p.id,
        shirt_number: parseInt(sel[p.id]?.number ?? "", 10) || p.shirt_number,
        name: p.name,
      };
    });
  }, [slots, squad, sel]);

  const onPitchIds = useMemo(() => new Set(slots.filter(Boolean) as string[]), [slots]);
  const benchSquad = useMemo(
    () => selectedSquad.filter((p) => !onPitchIds.has(p.id)),
    [selectedSquad, onPitchIds]
  );

  const toggle = (id: string) =>
    setSel((prev) => ({
      ...prev,
      [id]: { ...prev[id], selected: !prev[id].selected },
    }));

  const setNumber = (id: string, number: string) =>
    setSel((prev) => ({ ...prev, [id]: { ...prev[id], number } }));

  const setAll = (value: boolean) =>
    setSel((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => (next[id] = { ...next[id], selected: value }));
      return next;
    });

  const pruneSlots = (selected: Record<string, Selection>) =>
    setSlots((prev) => prev.map((id) => (id && selected[id]?.selected ? id : null)));

  const placeOnPitch = (playerId: string, slot: number) => {
    setSlots((prev) => {
      const next = [...prev];
      const from = next.findIndex((id) => id === playerId);
      const occupant = next[slot];
      if (from >= 0) next[from] = occupant ?? null;
      else if (occupant) {
        /* swap with whoever is there — incoming from bench */
      }
      next[slot] = playerId;
      return next;
    });
    setPickId(null);
    setError(null);
  };

  const removeFromPitch = (playerId: string) => {
    setSlots((prev) => prev.map((id) => (id === playerId ? null : id)));
    setPickId(null);
  };

  const autoFill = () => {
    const assigned = autoAssignSlots(selectedSquad);
    setSlots(assigned);
    setPickId(null);
    setError(null);
  };

  const onSlotClick = (slot: number, player: PitchOccupant | null) => {
    if (pickId) {
      placeOnPitch(pickId, slot);
      return;
    }
    if (player) {
      setPickId(player.id);
      return;
    }
  };

  const goStep2 = () => {
    setError(null);
    if (!opponent.trim()) return setError("צריך להזין שם יריב");
    if (selectedCount === 0) return setError("בחר לפחות שחקן אחד לסגל המשחק");
    const pruned = slots.map((id) => (id && sel[id]?.selected ? id : null));
    const filled = pruned.filter(Boolean).length;
    setSlots(filled > 0 ? pruned : autoAssignSlots(selectedSquad));
    setPickId(null);
    setStep(2);
  };

  const handleSubmit = async () => {
    setError(null);
    if (starterCount === 0) return setError("מקם לפחות שחקן אחד על המגרש");
    if (starterCount > MAX_STARTERS) {
      return setError(`מקסימום ${MAX_STARTERS} שחקני שדה בהרכב הפותח`);
    }

    const slotById = new Map<string, number>();
    slots.forEach((id, i) => {
      if (id) slotById.set(id, i);
    });

    const chosen = selectedSquad.map((p) => {
      const slot = slotById.get(p.id);
      const starter = slot !== undefined;
      return {
        squad_player_id: p.id,
        shirt_number: parseInt(sel[p.id].number, 10) || p.shirt_number,
        name: p.name,
        position: p.position,
        is_starter: starter,
        on_pitch: starter,
        lineup_slot: starter ? slot! : null,
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
      const msg = e instanceof Error ? e.message : "שגיאה בשמירה";
      if (/lineup_slot/i.test(msg)) {
        setError("חסרה עמודת הרכב ב-Supabase — הרץ את db/migration_v6.sql");
      } else {
        setError(msg);
      }
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-6 pb-28">
      <AppHeader
        title={step === 1 ? "משחק חדש — סגל" : "משחק חדש — הרכב"}
        subtitle={
          step === 1
            ? "שלב 1 מתוך 2 · בחירת סגל למשחק"
            : `שלב 2 מתוך 2 · פורמציה 4-3-3 · עד ${MAX_STARTERS} שחקני שדה`
        }
        backHref={step === 1 ? "/" : undefined}
      />

      {step === 2 && (
        <button
          type="button"
          onClick={() => {
            pruneSlots(sel);
            setPickId(null);
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
            בשלב הזה בוחרים מי בסגל המשחק בלבד — ההרכב על המגרש בשלב הבא.
          </p>
        </>
      )}

      {step === 2 && (
        <>
          <div className="card mb-3 px-4 py-3 text-sm">
            <p className="font-bold">מול {opponent}</p>
            <p className="text-[var(--muted)]">
              על המגרש:{" "}
              <span className="tabular text-[var(--accent)]">
                {starterCount}/{MAX_STARTERS}
              </span>
              {" · "}
              ספסל: <span className="tabular">{benchSquad.length}</span>
            </p>
          </div>
          <p className="mb-2 text-[11px] text-[var(--muted-2)]">
            לחץ על שחקן מהספסל ואז על עמדה במגרש. לחיצה על שחקן במגרש ואז על עמדה אחרת מחליפה מקום.
          </p>
          <div className="mb-3 flex gap-2">
            <button type="button" onClick={autoFill} className="btn btn-ghost h-9 flex-1 text-xs">
              סדר אוטומטית
            </button>
            {pickId && onPitchIds.has(pickId) && (
              <button
                type="button"
                onClick={() => removeFromPitch(pickId)}
                className="btn btn-danger h-9 flex-1 text-xs"
              >
                הורד לספסל
              </button>
            )}
          </div>
          <LineupPitch
            occupants={occupants}
            onSlotClick={onSlotClick}
            highlightPlayerId={pickId}
            showSlotLabels
          />
          <p className="label mt-3 mb-2">ספסל — לחץ ואז בחר עמדה</p>
          <div className="grid grid-cols-4 gap-2">
            {benchSquad.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPickId((cur) => (cur === p.id ? null : p.id))}
                className={`btn card flex-col py-2.5 active:scale-95 ${
                  pickId === p.id ? "border-[var(--accent)] bg-[var(--accent)]/15" : ""
                }`}
              >
                <span className="text-xl font-black tabular">
                  {sel[p.id]?.number || p.shirt_number}
                </span>
                <span className="max-w-full truncate text-[11px] text-[var(--muted)]">{p.name}</span>
              </button>
            ))}
            {benchSquad.length === 0 && (
              <p className="col-span-4 text-center text-sm text-[var(--muted)]">הספסל ריק</p>
            )}
          </div>
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

      {error && <p className="mt-3 text-[var(--danger)]">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md p-4">
        {step === 1 ? (
          <button
            onClick={goStep2}
            disabled={!isSupabaseConfigured || squad.length === 0}
            className="btn btn-primary w-full py-4 text-lg shadow-2xl"
          >
            המשך להרכב ← ({selectedCount})
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={saving || starterCount === 0}
            className="btn btn-primary w-full py-4 text-lg shadow-2xl"
          >
            {saving
              ? "מתחיל..."
              : `התחל משחק ← (${starterCount} על המגרש · ${benchSquad.length} ספסל)`}
          </button>
        )}
      </div>
    </main>
  );
}
