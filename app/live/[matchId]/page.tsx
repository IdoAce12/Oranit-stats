"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addPlayers,
  addSquadPlayer,
  finishMatch,
  getEvents,
  getMatch,
  getPlayers,
  listSquad,
  updatePlayerStarter,
} from "@/lib/db";
import {
  deleteRemote,
  enqueue,
  flushQueue,
  getPending,
  pendingCount,
  removeFromQueue,
} from "@/lib/eventQueue";
import { tapFeedback } from "@/lib/haptics";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  ACTION_LABELS,
  ACTIONS_NEED_SHOT_LOCATION,
  ACTIONS_NEED_ZONE,
  ActionType,
  EventRow,
  Half,
  LiveEvent,
  Match,
  Player,
  SHOT_LABELS,
  ShotLocation,
  SquadPlayer,
  TEAM_ACTIONS,
  Zone,
  ZONE_LABELS,
} from "@/lib/types";
import { MatchClock } from "./MatchClock";

const PRIMARY_ACTIONS: ActionType[] = ["ball_loss", "tackle", "key_pass", "shot"];
const SCORE_ACTIONS: ActionType[] = ["goal", "assist"];
const CORNER_ACTIONS: ActionType[] = ["corner_for", "corner_against"];

const ACTION_BTN: Record<ActionType, string> = {
  ball_loss: "bg-gradient-to-b from-red-500 to-red-600 text-white shadow-[0_10px_30px_-12px_rgba(239,68,68,0.8)]",
  tackle: "bg-gradient-to-b from-emerald-400 to-emerald-500 text-[#04150e] shadow-[0_10px_30px_-12px_rgba(16,185,129,0.8)]",
  key_pass: "bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-[0_10px_30px_-12px_rgba(59,130,246,0.8)]",
  shot: "bg-gradient-to-b from-amber-400 to-amber-500 text-[#241a00] shadow-[0_10px_30px_-12px_rgba(245,158,11,0.8)]",
  goal: "bg-gradient-to-b from-violet-500 to-violet-600 text-white shadow-[0_10px_30px_-12px_rgba(139,92,246,0.85)]",
  assist: "bg-gradient-to-b from-cyan-400 to-cyan-500 text-[#042f2e] shadow-[0_10px_30px_-12px_rgba(34,211,238,0.8)]",
  corner_for: "border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]",
  corner_against: "border border-red-400/40 bg-red-500/10 text-red-300",
};

export default function LivePage() {
  const params = useParams<{ matchId: string }>();
  const router = useRouter();
  const matchId = params.matchId;

  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const [rosterOpen, setRosterOpen] = useState(false);
  const [newNum, setNewNum] = useState("");
  const [newName, setNewName] = useState("");
  const [alsoSquad, setAlsoSquad] = useState(true);
  const [rosterBusy, setRosterBusy] = useState(false);

  const clockRef = useRef<{ half: Half; minute: number }>({ half: 1, minute: 0 });

  const [modalAction, setModalAction] = useState<ActionType | null>(null);
  const [modalPlayerId, setModalPlayerId] = useState<string | null | undefined>(undefined);

  const refreshPending = useCallback(() => setPending(pendingCount()), []);

  const trySync = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const flushed = await flushQueue();
    if (flushed > 0) setEvents((prev) => prev.map((e) => ({ ...e, synced: true })));
    refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    if (typeof navigator !== "undefined") setOnline(navigator.onLine);
    const goOnline = () => {
      setOnline(true);
      trySync();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const interval = setInterval(trySync, 15000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(interval);
    };
  }, [trySync]);

  useEffect(() => {
    if (!matchId) return;
    if (!isSupabaseConfigured) {
      setLoading(false);
      setFatalError("Supabase לא מחובר. אי אפשר לטעון את המשחק.");
      return;
    }
    (async () => {
      try {
        const [m, ps, evs, sq] = await Promise.all([
          getMatch(matchId),
          getPlayers(matchId),
          getEvents(matchId),
          listSquad(),
        ]);
        if (m?.status === "finished") {
          router.replace(`/report/${matchId}`);
          return;
        }
        setMatch(m);
        setPlayers(ps);
        setSquad(sq);
        const pendingForMatch = getPending().filter((e) => e.match_id === matchId);
        const synced: LiveEvent[] = evs.map((e) => ({ ...e, synced: true }));
        const seen = new Set(synced.map((e) => e.id));
        const local: LiveEvent[] = pendingForMatch
          .filter((e) => !seen.has(e.id))
          .map((e) => ({ ...e, synced: false }));
        setEvents([...synced, ...local]);
        refreshPending();
      } catch (e) {
        setFatalError(e instanceof Error ? e.message : "שגיאה בטעינה");
      } finally {
        setLoading(false);
      }
    })();
  }, [matchId, refreshPending, router]);

  const commit = useCallback(
    (action: ActionType, playerId: string | null, zone: Zone | null, shot: ShotLocation | null) => {
      const row: EventRow = {
        id: crypto.randomUUID(),
        match_id: matchId,
        player_id: playerId,
        action_type: action,
        zone,
        shot_location: shot,
        half: clockRef.current.half,
        match_minute: clockRef.current.minute,
        created_at: new Date().toISOString(),
      };
      enqueue(row);
      setEvents((prev) => [...prev, { ...row, synced: false }]);
      refreshPending();
      setModalAction(null);
      setModalPlayerId(undefined);
      tapFeedback();
      trySync();
    },
    [matchId, refreshPending, trySync]
  );

  const onActionClick = (action: ActionType) => {
    if (TEAM_ACTIONS.includes(action)) {
      commit(action, null, null, null);
      return;
    }
    tapFeedback(8);
    setModalAction(action);
    setModalPlayerId(undefined);
  };

  const onPlayerPick = (playerId: string | null) => {
    if (!modalAction) return;
    const needsZone = ACTIONS_NEED_ZONE.includes(modalAction);
    const needsShot = ACTIONS_NEED_SHOT_LOCATION.includes(modalAction);
    if (needsZone || needsShot) {
      setModalPlayerId(playerId);
      return;
    }
    commit(modalAction, playerId, null, null);
  };

  const undoLast = async () => {
    const last = events[events.length - 1];
    if (!last) return;
    tapFeedback([6, 30, 6]);
    setEvents((prev) => prev.slice(0, -1));
    removeFromQueue(last.id);
    refreshPending();
    await deleteRemote(last.id);
  };

  const deleteEvent = async (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    removeFromQueue(id);
    refreshPending();
    await deleteRemote(id);
  };

  const endMatch = async () => {
    await trySync();
    try {
      await finishMatch(matchId);
    } catch {
      /* גם אם הסימון נכשל, ננווט לדוח */
    }
    router.push(`/report/${matchId}`);
  };

  const availableSquad = useMemo(
    () =>
      squad.filter(
        (s) => s.active && !players.some((p) => p.squad_player_id === s.id)
      ),
    [squad, players]
  );

  const parseShirt = (raw: string): number | null => {
    const digits = raw.replace(/[^\d]/g, "");
    if (!digits) return null;
    const num = parseInt(digits, 10);
    if (Number.isNaN(num) || num < 0 || num > 99) return null;
    return num;
  };

  const addFromSquad = async (s: SquadPlayer) => {
    setRosterBusy(true);
    setNotice(null);
    try {
      const [added] = await addPlayers(matchId, [
        { squad_player_id: s.id, shirt_number: s.shirt_number, name: s.name, position: s.position },
      ]);
      if (added) setPlayers((prev) => [...prev, added].sort((a, b) => a.shirt_number - b.shirt_number));
    } catch {
      setNotice("הוספת שחקן נכשלה");
    } finally {
      setRosterBusy(false);
    }
  };

  const addNewPlayer = async () => {
    setNotice(null);
    const num = parseShirt(newNum);
    if (num === null) return setNotice("מספר חולצה לא תקין (0–99)");
    if (!newName.trim()) return setNotice("צריך שם שחקן");
    setRosterBusy(true);
    try {
      let squadId: string | null = null;
      if (alsoSquad) {
        const s = await addSquadPlayer({ shirt_number: num, name: newName.trim() });
        squadId = s.id;
        setSquad((prev) => [...prev, s].sort((a, b) => a.shirt_number - b.shirt_number));
      }
      const [added] = await addPlayers(matchId, [
        { squad_player_id: squadId, shirt_number: num, name: newName.trim() },
      ]);
      if (added) setPlayers((prev) => [...prev, added].sort((a, b) => a.shirt_number - b.shirt_number));
      setNewNum("");
      setNewName("");
    } catch {
      setNotice("הוספת שחקן נכשלה");
    } finally {
      setRosterBusy(false);
    }
  };

  const modalPhase: "player" | "zone" | "box" | null = useMemo(() => {
    if (!modalAction) return null;
    if (modalPlayerId === undefined) return "player";
    if (ACTIONS_NEED_ZONE.includes(modalAction)) return "zone";
    if (ACTIONS_NEED_SHOT_LOCATION.includes(modalAction)) return "box";
    return null;
  }, [modalAction, modalPlayerId]);

  const recent = useMemo(() => [...events].slice(-8).reverse(), [events]);

  /** שחקנים אחרונים שנרשמו — לקיצור בבחירה */
  const recentPlayerIds = useMemo(() => {
    const ids: string[] = [];
    for (let i = events.length - 1; i >= 0 && ids.length < 4; i--) {
      const id = events[i].player_id;
      if (id && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }, [events]);

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const as = a.is_starter === false ? 1 : 0;
      const bs = b.is_starter === false ? 1 : 0;
      if (as !== bs) return as - bs;
      return a.shirt_number - b.shirt_number;
    });
  }, [players]);

  const toggleStarter = async (p: Player) => {
    const next = !(p.is_starter !== false);
    setPlayers((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_starter: next } : x)));
    try {
      await updatePlayerStarter(p.id, next);
    } catch {
      setPlayers((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_starter: p.is_starter } : x)));
      setNotice("עדכון פותח/ספסל נכשל (הרץ migration_v4.sql אם חסר)");
    }
  };

  const playerLabel = (id: string | null) => {
    if (!id) return "—";
    const p = players.find((x) => x.id === id);
    return p ? `#${p.shirt_number}` : "?";
  };
  const closeModal = () => {
    setModalAction(null);
    setModalPlayerId(undefined);
  };

  if (loading) return <main className="p-8 text-center text-[var(--muted)]">טוען משחק...</main>;

  if (fatalError) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-8">
        <p className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{fatalError}</p>
        <Link href="/" className="mt-4 text-center text-[var(--muted)]">
          ← חזרה לבית
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-3 pt-4 pb-6">
      <header className="mb-3 flex items-center justify-between">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] active:scale-95"
        >
          ›
        </Link>
        <div className="text-center">
          <p className="text-sm font-extrabold">מול {match?.opponent}</p>
          <p className="text-[11px] text-[var(--muted)]">משחק חי</p>
        </div>
        <Link
          href={`/report/${matchId}`}
          className="flex h-9 items-center rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 text-xs font-bold text-[var(--accent)] active:scale-95"
        >
          דוח
        </Link>
      </header>

      {notice && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="btn btn-ghost h-7 shrink-0 px-3 text-xs">
            סגור
          </button>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs">
        <span className={`flex items-center gap-1.5 font-bold ${online ? "text-[var(--accent)]" : "text-amber-400"}`}>
          <span className={`h-2 w-2 rounded-full ${online ? "bg-[var(--accent)]" : "bg-amber-400"}`} />
          {online ? "מחובר" : "אופליין"}
        </span>
        <span className="text-[var(--muted)]">
          ממתינים: <b className="tabular text-[var(--text)]">{pending}</b>
        </span>
        <button onClick={trySync} className="btn btn-ghost h-7 px-3 text-xs">
          סנכרן
        </button>
      </div>

      <MatchClock
        matchId={matchId}
        onChange={(half, minute) => {
          clockRef.current = { half, minute };
        }}
      />

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {PRIMARY_ACTIONS.map((action) => (
          <button
            key={action}
            onClick={() => onActionClick(action)}
            className={`btn rounded-2xl py-8 text-xl ${ACTION_BTN[action]}`}
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        {SCORE_ACTIONS.map((action) => (
          <button
            key={action}
            onClick={() => onActionClick(action)}
            className={`btn rounded-2xl py-6 text-xl ${ACTION_BTN[action]}`}
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        {CORNER_ACTIONS.map((action) => (
          <button
            key={action}
            onClick={() => onActionClick(action)}
            className={`btn rounded-2xl py-4 text-base ${ACTION_BTN[action]}`}
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>

      <button onClick={() => setRosterOpen(true)} className="btn btn-ghost mt-3 w-full py-2.5 text-sm">
        נהל הרכב · {players.length} שחקנים
      </button>

      <div className="mt-4 flex items-center justify-between">
        <h2 className="label">אירועים אחרונים</h2>
        <button onClick={undoLast} disabled={events.length === 0} className="btn btn-ghost h-8 px-3 text-xs">
          ↶ בטל אחרון
        </button>
      </div>

      <ul className="mt-2 flex flex-col gap-1.5">
        {recent.length === 0 && (
          <li className="card p-3 text-center text-sm text-[var(--muted-2)]">עדיין לא נרשמו אירועים</li>
        )}
        {recent.map((ev) => (
          <li key={ev.id} className="card flex items-center justify-between px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <span className="tabular text-[var(--muted-2)]">{ev.match_minute}׳</span>
              <span className="font-bold">{ACTION_LABELS[ev.action_type]}</span>
              <span className="text-[var(--muted)]">{playerLabel(ev.player_id)}</span>
              {ev.zone && <span className="text-[var(--muted-2)]">· {ZONE_LABELS[ev.zone]}</span>}
              {ev.shot_location && <span className="text-[var(--muted-2)]">· {SHOT_LABELS[ev.shot_location]}</span>}
              {!ev.synced && (
                <span className="text-amber-400" title="ממתין לסנכרון">
                  ◌
                </span>
              )}
            </span>
            <button onClick={() => deleteEvent(ev.id)} className="text-red-400/80 active:scale-95" aria-label="מחק">
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-5">
        <button onClick={() => setConfirmEnd(true)} className="btn btn-danger w-full py-3.5">
          סיום משחק
        </button>
      </div>

      {/* פופ-אפ בחירה מהירה */}
      {modalPhase && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={closeModal}>
          <div
            className="sheet max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border-t border-[var(--border-strong)] bg-[#0c1322] p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-extrabold">
                {modalAction && ACTION_LABELS[modalAction]}
                {modalPhase === "zone" && " · באיזה אזור?"}
                {modalPhase === "box" && " · מאיפה הבעיטה?"}
                {modalPhase === "player" && " · איזה שחקן?"}
              </span>
              <button onClick={closeModal} className="btn btn-ghost h-8 px-3 text-sm">
                בטל
              </button>
            </div>

            {modalPhase === "player" && (
              <div className="flex flex-col gap-3">
                {recentPlayerIds.length > 0 && (
                  <div>
                    <p className="label mb-2">אחרונים</p>
                    <div className="grid grid-cols-4 gap-2">
                      {recentPlayerIds.map((id) => {
                        const p = players.find((x) => x.id === id);
                        if (!p) return null;
                        return (
                          <button
                            key={id}
                            onClick={() => onPlayerPick(id)}
                            className="btn rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 py-3 active:scale-95"
                          >
                            <span className="text-2xl font-black">{p.shirt_number}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div>
                  <p className="label mb-2">הרכב (פותחים קודם)</p>
                  <div className="grid grid-cols-4 gap-2.5">
                    {sortedPlayers.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => onPlayerPick(p.id)}
                        className={`btn card flex-col py-3 active:scale-95 ${
                          p.is_starter === false ? "opacity-70" : ""
                        }`}
                      >
                        <span className="text-2xl font-black">{p.shirt_number}</span>
                        <span className="mt-0.5 max-w-full truncate text-[11px] font-medium text-[var(--muted)]">
                          {p.name}
                        </span>
                        {p.is_starter === false && (
                          <span className="text-[9px] text-[var(--muted-2)]">ספסל</span>
                        )}
                      </button>
                    ))}
                    <button
                      onClick={() => onPlayerPick(null)}
                      className="btn card col-span-4 py-3 text-sm text-[var(--muted)]"
                    >
                      ללא שחקן
                    </button>
                  </div>
                </div>
              </div>
            )}

            {modalPhase === "zone" && (
              <div className="grid grid-cols-3 gap-2.5">
                {(["def", "mid", "att"] as Zone[]).map((z) => (
                  <button
                    key={z}
                    onClick={() => modalAction && commit(modalAction, modalPlayerId ?? null, z, null)}
                    className={`btn rounded-2xl py-9 text-lg ${
                      z === "def"
                        ? "bg-red-500/80 text-white"
                        : z === "mid"
                          ? "btn-ghost"
                          : "bg-emerald-500/80 text-[#04150e]"
                    }`}
                  >
                    {ZONE_LABELS[z]}
                  </button>
                ))}
              </div>
            )}

            {modalPhase === "box" && (
              <div className="grid grid-cols-2 gap-2.5">
                {(["in_box", "out_box"] as ShotLocation[]).map((loc) => (
                  <button
                    key={loc}
                    onClick={() => modalAction && commit(modalAction, modalPlayerId ?? null, null, loc)}
                    className={`btn rounded-2xl py-9 text-lg ${
                      loc === "in_box" ? "bg-emerald-500/80 text-[#04150e]" : "btn-ghost"
                    }`}
                  >
                    {SHOT_LABELS[loc]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* אישור סיום משחק */}
      {confirmEnd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={() => setConfirmEnd(false)}>
          <div className="sheet card w-full max-w-xs p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-extrabold">לסיים את המשחק?</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              נסנכרן את כל האירועים ונעבור לדוח. אחרי הסיום אי אפשר לערוך או להוסיף אירועים.
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setConfirmEnd(false)} className="btn btn-ghost flex-1 py-3">
                חזרה
              </button>
              <button onClick={endMatch} className="btn btn-primary flex-1 py-3">
                סיום ←
              </button>
            </div>
          </div>
        </div>
      )}

      {/* גיליון ניהול הרכב */}
      {rosterOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={() => setRosterOpen(false)}>
          <div
            className="sheet max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border-t border-[var(--border-strong)] bg-[#0c1322] p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-extrabold">הרכב המשחק</span>
              <button onClick={() => setRosterOpen(false)} className="btn btn-ghost h-8 px-3 text-sm">
                סגור
              </button>
            </div>

            {/* שחקנים במשחק */}
            <div className="mb-4 flex flex-col gap-2">
              {sortedPlayers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2"
                >
                  <span className="text-sm">
                    <b className="tabular">#{p.shirt_number}</b> {p.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleStarter(p)}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-black ${
                      p.is_starter !== false
                        ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                        : "bg-[var(--panel-strong)] text-[var(--muted)]"
                    }`}
                  >
                    {p.is_starter !== false ? "XI" : "ספסל"}
                  </button>
                </div>
              ))}
            </div>

            {/* הוספה מהסגל */}
            {availableSquad.length > 0 && (
              <div className="mb-4">
                <p className="label mb-2">הוסף מהסגל</p>
                <div className="grid grid-cols-4 gap-2">
                  {availableSquad.map((s) => (
                    <button
                      key={s.id}
                      disabled={rosterBusy}
                      onClick={() => addFromSquad(s)}
                      className="btn card flex-col py-2.5 active:scale-95"
                    >
                      <span className="text-xl font-black">{s.shirt_number}</span>
                      <span className="max-w-full truncate text-[11px] text-[var(--muted)]">{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* הוספת שחקן חדש */}
            <div>
              <p className="label mb-2">הוסף שחקן חדש</p>
              <div className="flex items-stretch gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  value={newNum}
                  onChange={(e) => setNewNum(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addNewPlayer();
                    }
                  }}
                  placeholder="מס׳"
                  aria-label="מספר חולצה"
                  className="field w-16 shrink-0 text-center tabular"
                />
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addNewPlayer();
                    }
                  }}
                  placeholder="שם השחקן"
                  aria-label="שם השחקן"
                  className="field min-w-0 flex-1"
                />
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={alsoSquad}
                  onChange={(e) => setAlsoSquad(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                שמור גם בסגל הקבוע
              </label>
              <button
                onClick={addNewPlayer}
                disabled={rosterBusy}
                className="btn btn-primary mt-3 w-full py-3"
              >
                {rosterBusy ? "מוסיף..." : "+ הוסף להרכב"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
