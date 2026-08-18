"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LineupPitch } from "../components/LineupPitch";
import { AppHeader } from "../components/AppHeader";
import { ConfigBanner } from "../components/ConfigBanner";
import { addPlayers, createMatch, listSquad } from "@/lib/db";
import { LINEUP_SIZE, PitchOccupant } from "@/lib/formation";
import { MAX_STARTERS } from "@/lib/playingMinutes";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { MATCH_TYPE_FULL_LABELS, MATCH_TYPE_ORDER, MatchType, SquadPlayer } from "@/lib/types";

type Step = 1 | 2 | 3;

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
  const [matchType, setMatchType] = useState<MatchType>("league");

  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [sel, setSel] = useState<Record<string, Selection>>({});
  const [slots, setSlots] = useState<(string | null)[]>(() => Array(LINEUP_SIZE).fill(null));
  const [pickId, setPickId] = useState<string | null>(null);
  const [pickSlot, setPickSlot] = useState<number | null>(null);
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
  const xiSquad = useMemo(
    () => selectedSquad.filter((p) => sel[p.id]?.starter),
    [selectedSquad, sel]
  );
  const starterCount = xiSquad.length;
  const placedCount = slots.filter(Boolean).length;

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
  const unplacedXi = useMemo(
    () => xiSquad.filter((p) => !onPitchIds.has(p.id)),
    [xiSquad, onPitchIds]
  );
  const matchBenchCount = selectedCount - starterCount;
  const allXiPlaced = starterCount > 0 && unplacedXi.length === 0;

  const toggle = (id: string) =>
    setSel((prev) => ({
      ...prev,
      [id]: { ...prev[id], selected: !prev[id].selected, starter: false },
    }));

  const toggleStarter = (id: string) => {
    const cur = sel[id];
    if (!cur?.selected) return;
    if (cur.starter) {
      setSel((prev) => ({ ...prev, [id]: { ...prev[id], starter: false } }));
      setSlots((prev) => prev.map((sid) => (sid === id ? null : sid)));
      setError(null);
      return;
    }
    if (starterCount >= MAX_STARTERS) {
      setError(`אפשר לבחור עד ${MAX_STARTERS} שחקני שדה בהרכב הפותח`);
      return;
    }
    setError(null);
    setSel((prev) => ({ ...prev, [id]: { ...prev[id], starter: true } }));
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

  const clearPicks = () => {
    setPickId(null);
    setPickSlot(null);
  };

  const placeOnPitch = (playerId: string, slot: number) => {
    setSlots((prev) => {
      const next = [...prev];
      const from = next.findIndex((id) => id === playerId);
      const occupant = next[slot];
      if (from >= 0) next[from] = occupant ?? null;
      next[slot] = playerId;
      return next;
    });
    clearPicks();
    setError(null);
  };

  const removeFromPitch = (playerId: string) => {
    setSlots((prev) => prev.map((id) => (id === playerId ? null : id)));
    clearPicks();
  };

  const onSlotClick = (slot: number, player: PitchOccupant | null) => {
    if (pickId) {
      placeOnPitch(pickId, slot);
      return;
    }
    if (player) {
      setPickId(player.id);
      setPickSlot(null);
      return;
    }
    setPickSlot((cur) => (cur === slot ? null : slot));
  };

  const onUnplacedClick = (id: string) => {
    if (pickSlot != null) {
      placeOnPitch(id, pickSlot);
      return;
    }
    setPickId((cur) => (cur === id ? null : id));
  };

  const pruneSlotsToStarters = (selection: Record<string, Selection>) =>
    setSlots((prev) => prev.map((id) => (id && selection[id]?.starter ? id : null)));

  const goStep2 = () => {
    setError(null);
    if (!opponent.trim()) return setError("צריך להזין שם יריב");
    if (selectedCount === 0) return setError("בחר לפחות שחקן אחד לסגל המשחק");
    setStep(2);
  };

  const goStep3 = () => {
    setError(null);
    if (starterCount === 0) return setError("בחר לפחות שחקן אחד בהרכב הפותח");
    if (starterCount > MAX_STARTERS) {
      return setError(`מקסימום ${MAX_STARTERS} שחקני שדה בהרכב הפותח`);
    }
    pruneSlotsToStarters(sel);
    clearPicks();
    setStep(3);
  };

  const handleSubmit = async () => {
    setError(null);
    if (starterCount === 0) return setError("בחר הרכב פותח");
    if (!allXiPlaced) return setError("מקם כל שחקן פותח על המגרש לפני תחילת המשחק");

    const slotById = new Map<string, number>();
    slots.forEach((id, i) => {
      if (id) slotById.set(id, i);
    });

    const chosen = selectedSquad.map((p) => {
      const slot = slotById.get(p.id);
      const starter = sel[p.id].starter === true;
      return {
        squad_player_id: p.id,
        shirt_number: parseInt(sel[p.id].number, 10) || p.shirt_number,
        name: p.name,
        position: p.position,
        is_starter: starter,
        on_pitch: starter,
        lineup_slot: starter && slot !== undefined ? slot : null,
      };
    });

    setSaving(true);
    try {
      const match = await createMatch({
        opponent: opponent.trim(),
        match_date: matchDate,
        our_team_name: teamName.trim(),
        match_type: matchType,
      });
      await addPlayers(match.id, chosen);
      router.push(`/live/${match.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "שגיאה בשמירה";
      if (/lineup_slot/i.test(msg)) {
        setError("חסרה עמודת הרכב ב-Supabase — הרץ את db/migration_v6.sql");
      } else if (/match_type/i.test(msg)) {
        setError("חסרה עמודת סוג משחק ב-Supabase — הרץ את db/migration_v7.sql");
      } else {
        setError(msg);
      }
      setSaving(false);
    }
  };

  const titles: Record<Step, { title: string; subtitle: string }> = {
    1: { title: "משחק חדש — סגל", subtitle: "שלב 1 מתוך 3 · בחירת סגל למשחק" },
    2: {
      title: "משחק חדש — הרכב פותח",
      subtitle: `שלב 2 מתוך 3 · עד ${MAX_STARTERS} שחקני שדה`,
    },
    3: { title: "משחק חדש — עמדות", subtitle: "שלב 3 מתוך 3 · מקם כל פותח על המגרש" },
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-6 pb-28">
      <AppHeader
        title={titles[step].title}
        subtitle={titles[step].subtitle}
        backHref={step === 1 ? "/" : undefined}
      />

      {step !== 1 && (
        <button
          type="button"
          onClick={() => {
            if (step === 3) {
              pruneSlotsToStarters(sel);
              clearPicks();
              setStep(2);
            } else {
              setStep(1);
            }
            setError(null);
          }}
          className="mb-3 text-sm font-bold text-[var(--muted)]"
        >
          {step === 3 ? "← חזרה להרכב הפותח" : "← חזרה לסגל"}
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
            <div className="flex flex-col gap-1.5">
              <span className="label">סוג משחק</span>
              <div className="grid grid-cols-3 gap-2">
                {MATCH_TYPE_ORDER.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMatchType(t)}
                    className={`btn h-10 text-sm ${matchType === t ? "btn-primary" : "btn-ghost"}`}
                  >
                    {MATCH_TYPE_FULL_LABELS[t]}
                  </button>
                ))}
              </div>
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
            בשלב הזה בוחרים מי בסגל המשחק בלבד — ההרכב הפותח בשלב הבא, והעמדות אחריו.
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
              ספסל: <span className="tabular">{matchBenchCount}</span>
            </p>
          </div>
          <p className="mb-2 text-[11px] text-[var(--muted-2)]">
            לחץ XI על עד {MAX_STARTERS} שחקני שדה. בשלב הבא תמקם אותם על המגרש בעצמך.
          </p>
        </>
      )}

      {step === 3 && (
        <>
          <div className="card mb-3 px-4 py-3 text-sm">
            <p className="font-bold">מול {opponent}</p>
            <p className="text-[var(--muted)]">
              מוקמו:{" "}
              <span className="tabular text-[var(--accent)]">
                {placedCount}/{starterCount}
              </span>
              {unplacedXi.length > 0 && (
                <>
                  {" · "}נותרו <span className="tabular">{unplacedXi.length}</span>
                </>
              )}
            </p>
          </div>
          <p className="mb-3 text-[11px] text-[var(--muted-2)]">
            לחץ על שחקן ואז על עמדה במגרש — או קודם על עמדה ריקה ואז על שחקן. ריק = תווית העמדה.
          </p>
          {pickId && onPitchIds.has(pickId) && (
            <button
              type="button"
              onClick={() => removeFromPitch(pickId)}
              className="btn btn-danger mb-3 h-9 w-full text-xs"
            >
              הורד מהמגרש
            </button>
          )}
          <LineupPitch
            occupants={occupants}
            onSlotClick={onSlotClick}
            highlightPlayerId={pickId}
            highlightSlot={pickSlot}
            showSlotLabels
          />
          <p className="label mt-3 mb-2">
            {unplacedXi.length > 0 ? "פותחים שטרם מוקמו" : "כל הפותחים על המגרש"}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {unplacedXi.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onUnplacedClick(p.id)}
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
            {unplacedXi.length === 0 && (
              <p className="col-span-4 text-center text-sm text-[var(--accent)]">
                אפשר להתחיל. אפשר עדיין להחליף מקומות בלחיצה על שחקן במגרש ואז על עמדה אחרת.
              </p>
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
        {step === 1 && (
          <button
            onClick={goStep2}
            disabled={!isSupabaseConfigured || squad.length === 0}
            className="btn btn-primary w-full py-4 text-lg shadow-2xl"
          >
            המשך להרכב פותח ← ({selectedCount})
          </button>
        )}
        {step === 2 && (
          <button
            onClick={goStep3}
            disabled={starterCount === 0}
            className="btn btn-primary w-full py-4 text-lg shadow-2xl"
          >
            המשך לעמדות ← ({starterCount} פותחים)
          </button>
        )}
        {step === 3 && (
          <button
            onClick={handleSubmit}
            disabled={saving || !allXiPlaced}
            className="btn btn-primary w-full py-4 text-lg shadow-2xl"
          >
            {saving
              ? "מתחיל..."
              : allXiPlaced
                ? `התחל משחק ← (${placedCount} על המגרש · ${matchBenchCount} ספסל)`
                : `מקם עוד ${unplacedXi.length} על המגרש`}
          </button>
        )}
      </div>
    </main>
  );
}
