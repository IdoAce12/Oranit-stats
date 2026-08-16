"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LineupPitch } from "../../components/LineupPitch";
import {
  addPlayers,
  addSquadPlayer,
  finishMatch,
  getEvents,
  getMatch,
  getPlayers,
  getSubstitutions,
  listSquad,
  recordSubstitution,
  updatePlayerSlots,
} from "@/lib/db";
import { resolveOccupants, slotOfPlayer } from "@/lib/formation";
import { clockDisplay, readClockState } from "@/lib/matchClock";
import { MAX_STARTERS } from "@/lib/playingMinutes";
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
  Substitution,
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

type SubPhase = "out" | "in" | null;
type ModalPhase = "action" | "zone" | "box" | null;

export default function LivePage() {
  const params = useParams<{ matchId: string }>();
  const router = useRouter();
  const matchId = params.matchId;

  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [subs, setSubs] = useState<Substitution[]>([]);
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

  const [subPhase, setSubPhase] = useState<SubPhase>(null);
  const [subOutId, setSubOutId] = useState<string | null>(null);
  const [subBusy, setSubBusy] = useState(false);

  const clockRef = useRef<{ half: Half; minute: number }>({ half: 1, minute: 0 });

  const [modalPlayerId, setModalPlayerId] = useState<string | null>(null);
  const [modalAction, setModalAction] = useState<ActionType | null>(null);
  const [modalPhase, setModalPhase] = useState<ModalPhase>(null);

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
        const [m, ps, evs, sq, subList] = await Promise.all([
          getMatch(matchId),
          getPlayers(matchId),
          getEvents(matchId),
          listSquad(),
          getSubstitutions(matchId).catch(() => [] as Substitution[]),
        ]);
        if (m?.status === "finished") {
          router.replace(`/report/${matchId}`);
          return;
        }
        setMatch(m);

        const occupants = resolveOccupants(ps);
        const patched = ps.map((p) => {
          const slot = occupants.findIndex((o) => o?.id === p.id);
          if (slot >= 0) return { ...p, lineup_slot: slot };
          if (p.on_pitch === false && p.lineup_slot != null) return { ...p, lineup_slot: null };
          return p;
        });
        setPlayers(patched);
        const slotFixes = patched
          .filter((p, i) => p.lineup_slot !== ps[i].lineup_slot)
          .map((p) => ({ id: p.id, lineup_slot: p.lineup_slot ?? null }));
        if (slotFixes.length > 0) {
          updatePlayerSlots(slotFixes).catch((e) => {
            const msg = e instanceof Error ? e.message : "";
            if (/lineup_slot/i.test(msg)) {
              setNotice("חסרה עמודת הרכב — הרץ db/migration_v6.sql ב-Supabase");
            }
          });
        }

        setSquad(sq);
        setSubs(subList);
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
      setModalPlayerId(null);
      setModalPhase(null);
      tapFeedback();
      trySync();
    },
    [matchId, refreshPending, trySync]
  );

  const openPlayerActions = (playerId: string) => {
    tapFeedback(8);
    setModalPlayerId(playerId);
    setModalAction(null);
    setModalPhase("action");
  };

  const onTeamAction = (action: ActionType) => {
    commit(action, null, null, null);
  };

  const onActionPick = (action: ActionType) => {
    if (!modalPlayerId) return;
    tapFeedback(8);
    if (ACTIONS_NEED_ZONE.includes(action)) {
      setModalAction(action);
      setModalPhase("zone");
      return;
    }
    if (ACTIONS_NEED_SHOT_LOCATION.includes(action)) {
      setModalAction(action);
      setModalPhase("box");
      return;
    }
    commit(action, modalPlayerId, null, null);
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
    const clock = clockDisplay(readClockState(matchId));
    try {
      await finishMatch(matchId, { half: clock.half, minute: clock.minute });
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

  const pitchPlayers = useMemo(() => {
    const hasFlag = players.some((p) => p.on_pitch === true || p.on_pitch === false);
    if (!hasFlag) return players.filter((p) => p.is_starter !== false);
    return players.filter((p) => p.on_pitch === true);
  }, [players]);

  const benchPlayers = useMemo(() => {
    const pitchIds = new Set(pitchPlayers.map((p) => p.id));
    return players.filter((p) => !pitchIds.has(p.id));
  }, [players, pitchPlayers]);

  const occupants = useMemo(() => resolveOccupants(pitchPlayers), [pitchPlayers]);

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
        {
          squad_player_id: s.id,
          shirt_number: s.shirt_number,
          name: s.name,
          position: s.position,
          is_starter: false,
          on_pitch: false,
          lineup_slot: null,
        },
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
        {
          squad_player_id: squadId,
          shirt_number: num,
          name: newName.trim(),
          is_starter: false,
          on_pitch: false,
          lineup_slot: null,
        },
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

  const openSub = () => {
    setSubPhase("out");
    setSubOutId(null);
    setNotice(null);
    closeModal();
  };

  const closeSub = () => {
    setSubPhase(null);
    setSubOutId(null);
  };

  const confirmSub = async (inId: string) => {
    if (!subOutId) return;
    setSubBusy(true);
    const slot = slotOfPlayer(occupants, subOutId);
    try {
      const sub = await recordSubstitution({
        match_id: matchId,
        player_out_id: subOutId,
        player_in_id: inId,
        half: clockRef.current.half,
        match_minute: clockRef.current.minute,
        lineup_slot: slot,
      });
      setSubs((prev) => [...prev, sub]);
      setPlayers((prev) =>
        prev.map((p) => {
          if (p.id === subOutId) return { ...p, on_pitch: false, lineup_slot: null };
          if (p.id === inId) return { ...p, on_pitch: true, lineup_slot: slot };
          return p;
        })
      );
      tapFeedback();
      closeSub();
    } catch {
      setNotice("חילוף נכשל — הרץ migration_v5.sql / migration_v6.sql ב-Supabase");
    } finally {
      setSubBusy(false);
    }
  };

  const recent = useMemo(() => [...events].slice(-6).reverse(), [events]);

  const playerLabel = (id: string | null) => {
    if (!id) return "—";
    const p = players.find((x) => x.id === id);
    return p ? `#${p.shirt_number}` : "?";
  };

  const modalPlayer = modalPlayerId ? players.find((p) => p.id === modalPlayerId) : null;

  const closeModal = () => {
    setModalAction(null);
    setModalPlayerId(null);
    setModalPhase(null);
  };

  const onPitchSlot = (_slot: number, player: { id: string } | null) => {
    if (!player) return;
    if (subPhase === "out") {
      setSubOutId(player.id);
      setSubPhase("in");
      tapFeedback(8);
      return;
    }
    if (subPhase === "in") return;
    openPlayerActions(player.id);
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
          <p className="text-[11px] text-[var(--muted)]">לחץ על שחקן במגרש</p>
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

      {subPhase && (
        <div className="mt-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-amber-200">
              {subPhase === "out"
                ? "חילוף — לחץ על מי שיוצא במגרש"
                : `מי נכנס במקום #${players.find((p) => p.id === subOutId)?.shirt_number ?? "?"}? לחץ בספסל`}
            </p>
            <button onClick={closeSub} className="btn btn-ghost h-7 shrink-0 px-3 text-xs">
              בטל
            </button>
          </div>
        </div>
      )}

      <div className="mt-3">
        <LineupPitch
          occupants={occupants}
          onSlotClick={onPitchSlot}
          highlightPlayerId={subOutId ?? modalPlayerId}
          disabled={subBusy}
        />
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="label">ספסל</p>
          <span className="text-[10px] text-[var(--muted-2)]">
            {pitchPlayers.length}/{MAX_STARTERS} על המגרש
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {benchPlayers.length === 0 && (
            <p className="text-xs text-[var(--muted-2)]">אין שחקנים בספסל</p>
          )}
          {benchPlayers.map((p) => (
            <button
              key={p.id}
              disabled={subBusy || (subPhase !== null && subPhase !== "in")}
              onClick={() => {
                if (subPhase === "in") confirmSub(p.id);
              }}
              className={`btn card shrink-0 flex-col px-3 py-2 ${
                subPhase === "in" ? "border-[var(--accent)]/40" : ""
              }`}
            >
              <span className="text-lg font-black tabular">{p.shirt_number}</span>
              <span className="max-w-[4.5rem] truncate text-[10px] text-[var(--muted)]">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        {CORNER_ACTIONS.map((action) => (
          <button
            key={action}
            onClick={() => onTeamAction(action)}
            className={`btn rounded-2xl py-3 text-sm ${ACTION_BTN[action]}`}
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <button onClick={openSub} className="btn btn-ghost rounded-2xl py-3 text-base font-extrabold">
          ⟳ חילוף
        </button>
        <button onClick={() => setRosterOpen(true)} className="btn btn-ghost rounded-2xl py-3 text-base">
          סגל · {players.length}
        </button>
      </div>

      {subs.length > 0 && (
        <p className="mt-2 text-center text-[11px] text-[var(--muted-2)]">
          {subs.length} חילופים במשחק
        </p>
      )}

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

      {modalPhase && modalPlayer && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={closeModal}>
          <div
            className="sheet max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border-t border-[var(--border-strong)] bg-[#0c1322] p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-extrabold">
                #{modalPlayer.shirt_number} {modalPlayer.name}
                {modalPhase === "action" && " · מה קרה?"}
                {modalPhase === "zone" && modalAction && ` · ${ACTION_LABELS[modalAction]} · אזור?`}
                {modalPhase === "box" && " · מאיפה הבעיטה?"}
              </span>
              <button onClick={closeModal} className="btn btn-ghost h-8 px-3 text-sm">
                בטל
              </button>
            </div>

            {modalPhase === "action" && (
              <div className="flex flex-col gap-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  {PRIMARY_ACTIONS.map((action) => (
                    <button
                      key={action}
                      onClick={() => onActionPick(action)}
                      className={`btn rounded-2xl py-7 text-lg ${ACTION_BTN[action]}`}
                    >
                      {ACTION_LABELS[action]}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {SCORE_ACTIONS.map((action) => (
                    <button
                      key={action}
                      onClick={() => onActionPick(action)}
                      className={`btn rounded-2xl py-6 text-lg ${ACTION_BTN[action]}`}
                    >
                      {ACTION_LABELS[action]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {modalPhase === "zone" && (
              <div className="grid grid-cols-3 gap-2.5">
                {(["def", "mid", "att"] as Zone[]).map((z) => (
                  <button
                    key={z}
                    onClick={() => modalAction && commit(modalAction, modalPlayerId, z, null)}
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
                    onClick={() => modalAction && commit(modalAction, modalPlayerId, null, loc)}
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

      {rosterOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={() => setRosterOpen(false)}>
          <div
            className="sheet max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border-t border-[var(--border-strong)] bg-[#0c1322] p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-extrabold">סגל המשחק</span>
              <button onClick={() => setRosterOpen(false)} className="btn btn-ghost h-8 px-3 text-sm">
                סגור
              </button>
            </div>

            <div className="mb-4">
              <p className="label mb-2">על המגרש ({pitchPlayers.length}/{MAX_STARTERS})</p>
              <div className="mb-3 flex flex-col gap-2">
                {pitchPlayers.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2"
                  >
                    <span className="text-sm">
                      <b className="tabular">#{p.shirt_number}</b> {p.name}
                    </span>
                    <span className="text-[10px] font-black text-[var(--accent)]">
                      {p.is_starter ? "פותח" : "נכנס"}
                    </span>
                  </div>
                ))}
              </div>
              <p className="label mb-2">ספסל ({benchPlayers.length})</p>
              <div className="flex flex-col gap-2">
                {benchPlayers.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2"
                  >
                    <span className="text-sm text-[var(--muted)]">
                      <b className="tabular">#{p.shirt_number}</b> {p.name}
                    </span>
                    <span className="text-[10px] font-bold text-[var(--muted-2)]">ספסל</span>
                  </div>
                ))}
              </div>
            </div>

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
