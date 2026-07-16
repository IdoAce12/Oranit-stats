"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getEvents, getMatch, getPlayers } from "@/lib/db";
import {
  deleteRemote,
  enqueue,
  flushQueue,
  getPending,
  pendingCount,
  removeFromQueue,
} from "@/lib/eventQueue";
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
  Zone,
  ZONE_LABELS,
} from "@/lib/types";
import { MatchClock } from "./MatchClock";

const ACTION_STYLES: Record<ActionType, string> = {
  ball_loss: "bg-red-500 text-white",
  tackle: "bg-green-500 text-black",
  key_pass: "bg-blue-500 text-white",
  shot: "bg-amber-400 text-black",
  corner: "bg-white/15 text-white",
};

const ACTION_ORDER: ActionType[] = ["ball_loss", "tackle", "key_pass", "shot", "corner"];

export default function LivePage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId;

  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);

  // מצב השעון - נשמר ומועבר מ-MatchClock
  const clockRef = useRef<{ half: Half; minute: number }>({ half: 1, minute: 0 });

  // מצב הפופ-אפ לבחירה מהירה
  const [modalAction, setModalAction] = useState<ActionType | null>(null);
  const [modalPlayerId, setModalPlayerId] = useState<string | null | undefined>(undefined);

  const refreshPending = useCallback(() => setPending(pendingCount()), []);

  const trySync = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const flushed = await flushQueue();
    if (flushed > 0) {
      setEvents((prev) => prev.map((e) => ({ ...e, synced: true })));
    }
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
      setError("Supabase לא מחובר. אי אפשר לטעון את המשחק.");
      return;
    }
    (async () => {
      try {
        const [m, ps, evs] = await Promise.all([
          getMatch(matchId),
          getPlayers(matchId),
          getEvents(matchId),
        ]);
        setMatch(m);
        setPlayers(ps);
        const pendingForMatch = getPending().filter((e) => e.match_id === matchId);
        const synced: LiveEvent[] = evs.map((e) => ({ ...e, synced: true }));
        const local: LiveEvent[] = pendingForMatch.map((e) => ({ ...e, synced: false }));
        // מיזוג ומניעת כפילויות לפי id
        const seen = new Set(synced.map((e) => e.id));
        setEvents([...synced, ...local.filter((e) => !seen.has(e.id))]);
        refreshPending();
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה בטעינה");
      } finally {
        setLoading(false);
      }
    })();
  }, [matchId, refreshPending]);

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
      // סגירת הפופ-אפ
      setModalAction(null);
      setModalPlayerId(undefined);
      // ניסיון סנכרון ברקע
      trySync();
    },
    [matchId, refreshPending, trySync]
  );

  const onActionClick = (action: ActionType) => {
    // קרן היא אירוע קבוצתי - נרשם מיד ללא שחקן
    if (action === "corner") {
      commit(action, null, null, null);
      return;
    }
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

  const modalPhase: "player" | "zone" | "box" | null = useMemo(() => {
    if (!modalAction) return null;
    if (modalPlayerId === undefined) return "player";
    if (ACTIONS_NEED_ZONE.includes(modalAction)) return "zone";
    if (ACTIONS_NEED_SHOT_LOCATION.includes(modalAction)) return "box";
    return null;
  }, [modalAction, modalPlayerId]);

  const recent = useMemo(() => [...events].slice(-8).reverse(), [events]);
  const playerLabel = (id: string | null) => {
    if (!id) return "—";
    const p = players.find((x) => x.id === id);
    return p ? `#${p.shirt_number}` : "?";
  };

  if (loading) {
    return <main className="p-6 text-center text-white/60">טוען משחק...</main>;
  }

  if (error) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-6">
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{error}</p>
        <Link href="/" className="mt-4 text-center text-white/60">
          ← חזרה לבית
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-3 pt-3 pb-4">
      <header className="mb-2 flex items-center justify-between text-sm">
        <Link href="/" className="text-white/60">
          ← בית
        </Link>
        <span className="font-semibold">מול {match?.opponent}</span>
        <Link href={`/report/${matchId}`} className="font-semibold text-green-400">
          דוח ←
        </Link>
      </header>

      <div className="mb-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
        <span className={online ? "text-green-400" : "text-amber-400"}>
          {online ? "● מחובר" : "● אופליין"}
        </span>
        <span className="text-white/60">
          ממתינים לסנכרון: <b className="text-white">{pending}</b>
        </span>
        <button onClick={trySync} className="rounded-lg bg-white/10 px-2 py-1 font-semibold active:scale-95">
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
        {ACTION_ORDER.map((action) => (
          <button
            key={action}
            onClick={() => onActionClick(action)}
            className={`rounded-2xl py-7 text-xl font-bold active:scale-[0.97] ${ACTION_STYLES[action]} ${
              action === "corner" ? "col-span-2 py-4 text-lg" : ""
            }`}
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white/70">אירועים אחרונים</h2>
        <button
          onClick={undoLast}
          disabled={events.length === 0}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold active:scale-95 disabled:opacity-40"
        >
          ↶ בטל אחרון
        </button>
      </div>

      <ul className="mt-2 flex flex-col gap-1.5">
        {recent.length === 0 && (
          <li className="rounded-xl border border-white/10 bg-white/5 p-3 text-center text-sm text-white/40">
            עדיין לא נרשמו אירועים
          </li>
        )}
        {recent.map((ev) => (
          <li
            key={ev.id}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
          >
            <span className="flex items-center gap-2">
              <span className="tabular-nums text-white/50">{ev.match_minute}׳</span>
              <span className="font-semibold">{ACTION_LABELS[ev.action_type]}</span>
              <span className="text-white/60">{playerLabel(ev.player_id)}</span>
              {ev.zone && <span className="text-white/40">· {ZONE_LABELS[ev.zone]}</span>}
              {ev.shot_location && <span className="text-white/40">· {SHOT_LABELS[ev.shot_location]}</span>}
              {!ev.synced && <span className="text-amber-400" title="ממתין לסנכרון">◌</span>}
            </span>
            <button
              onClick={() => deleteEvent(ev.id)}
              className="text-red-400/80 active:scale-95"
              aria-label="מחק"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {/* פופ-אפ בחירה מהירה */}
      {modalPhase && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/60"
          onClick={() => {
            setModalAction(null);
            setModalPlayerId(undefined);
          }}
        >
          <div
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#0f1830] p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-bold">
                {modalAction && ACTION_LABELS[modalAction]}
                {modalPhase === "zone" && " · באיזה אזור?"}
                {modalPhase === "box" && " · מאיפה הבעיטה?"}
                {modalPhase === "player" && " · איזה שחקן?"}
              </span>
              <button
                onClick={() => {
                  setModalAction(null);
                  setModalPlayerId(undefined);
                }}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-sm"
              >
                בטל
              </button>
            </div>

            {modalPhase === "player" && (
              <div className="grid grid-cols-4 gap-2.5">
                {players.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onPlayerPick(p.id)}
                    className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 py-3 active:scale-95"
                  >
                    <span className="text-2xl font-bold">{p.shirt_number}</span>
                    <span className="mt-0.5 max-w-full truncate text-[11px] text-white/60">{p.name}</span>
                  </button>
                ))}
                <button
                  onClick={() => onPlayerPick(null)}
                  className="col-span-4 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm text-white/60 active:scale-95"
                >
                  ללא שחקן
                </button>
              </div>
            )}

            {modalPhase === "zone" && (
              <div className="grid grid-cols-3 gap-2.5">
                {(["def", "mid", "att"] as Zone[]).map((z) => (
                  <button
                    key={z}
                    onClick={() => modalAction && commit(modalAction, modalPlayerId ?? null, z, null)}
                    className={`rounded-2xl py-8 text-lg font-bold active:scale-95 ${
                      z === "def" ? "bg-red-500/80 text-white" : z === "mid" ? "bg-white/15" : "bg-green-500/80 text-black"
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
                    className={`rounded-2xl py-8 text-lg font-bold active:scale-95 ${
                      loc === "in_box" ? "bg-green-500/80 text-black" : "bg-white/15"
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
    </main>
  );
}
