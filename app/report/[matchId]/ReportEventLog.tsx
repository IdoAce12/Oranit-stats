"use client";

import { useMemo, useState } from "react";
import { updateEventPlayer } from "@/lib/db";
import { deleteRemote, enqueue, flushQueue, removeFromQueue } from "@/lib/eventQueue";
import {
  GK_OUTCOME_GROUPS,
  GK_SAVE_ACTION,
  isGkAction,
  playerIsGoalkeeper,
  type GkOutcomeGroup,
} from "@/lib/gk";
import {
  ACTION_LABELS,
  ACTIONS_NEED_SHOT_LOCATION,
  ACTIONS_NEED_ZONE,
  ActionType,
  DuelKind,
  DUEL_KIND_LABELS,
  duelAction,
  EventRow,
  Half,
  Match,
  MatchEvent,
  Player,
  SHOT_LABELS,
  ShotLocation,
  TEAM_ACTIONS,
  Zone,
  ZONE_LABELS,
} from "@/lib/types";

const PRIMARY_ACTIONS: ActionType[] = ["ball_loss", "tackle", "key_pass", "shot"];
const SCORE_ACTIONS: ActionType[] = ["goal", "assist"];
const CORNER_ACTIONS: ActionType[] = ["corner_for", "corner_against"];
const DUEL_KINDS: DuelKind[] = ["aerial", "ground"];

const ACTION_BTN: Record<ActionType, string> = {
  ball_loss: "bg-gradient-to-b from-red-500 to-red-600 text-white",
  tackle: "bg-gradient-to-b from-emerald-400 to-emerald-500 text-[#04150e]",
  key_pass: "bg-gradient-to-b from-blue-500 to-blue-600 text-white",
  shot: "bg-gradient-to-b from-amber-400 to-amber-500 text-[#241a00]",
  goal: "bg-gradient-to-b from-violet-500 to-violet-600 text-white",
  assist: "bg-gradient-to-b from-cyan-400 to-cyan-500 text-[#042f2e]",
  corner_for: "border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]",
  corner_against: "border border-red-400/40 bg-red-500/10 text-red-300",
  aerial_won: "bg-gradient-to-b from-sky-400 to-sky-600 text-white",
  aerial_lost: "bg-gradient-to-b from-slate-500 to-slate-700 text-white",
  ground_won: "bg-gradient-to-b from-lime-400 to-lime-600 text-[#14320a]",
  ground_lost: "bg-gradient-to-b from-orange-500 to-orange-700 text-white",
  gk_save: "bg-gradient-to-b from-violet-400 to-violet-600 text-white",
  gk_pass_ok: "bg-gradient-to-b from-sky-400 to-sky-600 text-white",
  gk_pass_miss: "bg-gradient-to-b from-slate-500 to-slate-700 text-white",
  gk_exit_ok: "bg-gradient-to-b from-fuchsia-400 to-fuchsia-600 text-white",
  gk_exit_bad: "bg-gradient-to-b from-orange-500 to-orange-700 text-white",
  gk_aerial_ok: "bg-gradient-to-b from-indigo-400 to-indigo-600 text-white",
  gk_aerial_miss: "bg-gradient-to-b from-slate-500 to-slate-700 text-white",
  gk_accurate_pass: "bg-gradient-to-b from-sky-400 to-sky-600 text-white",
  gk_aerial: "bg-gradient-to-b from-indigo-400 to-indigo-600 text-white",
  gk_exit: "bg-gradient-to-b from-fuchsia-400 to-fuchsia-600 text-white",
};

type AddPhase = "pick" | "action" | "zone" | "box" | "duel" | "gk_outcome";

function sortChronological(events: MatchEvent[]): MatchEvent[] {
  return [...events].sort(
    (a, b) =>
      a.half - b.half ||
      a.match_minute - b.match_minute ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id)
  );
}

function playerLabel(players: Player[], id: string | null): string {
  if (!id) return "קבוצתי";
  const p = players.find((x) => x.id === id);
  return p ? `#${p.shirt_number} ${p.name}` : "שחקן לא ידוע";
}

function defaultClock(match: Match | null, events: MatchEvent[]): { half: Half; minute: number } {
  if (match?.final_half && match.final_minute != null) {
    return { half: match.final_half === 2 ? 2 : 1, minute: match.final_minute };
  }
  const last = sortChronological(events).at(-1);
  if (last) return { half: last.half, minute: last.match_minute };
  return { half: 1, minute: 0 };
}

export function ReportEventLog({
  matchId,
  match,
  players,
  events,
  isCoach,
  onEventsChange,
  onError,
}: {
  matchId: string;
  match: Match | null;
  players: Player[];
  events: MatchEvent[];
  isCoach: boolean;
  onEventsChange: (events: MatchEvent[]) => void;
  onError: (msg: string | null) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reassignId, setReassignId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addPhase, setAddPhase] = useState<AddPhase>("pick");
  const [addPlayerId, setAddPlayerId] = useState<string | null>(null);
  const [addAction, setAddAction] = useState<ActionType | null>(null);
  const [duelKind, setDuelKind] = useState<DuelKind | null>(null);
  const [gkGroup, setGkGroup] = useState<GkOutcomeGroup | null>(null);
  const clockDefaults = defaultClock(match, events);
  const [half, setHalf] = useState<Half>(clockDefaults.half);
  const [minute, setMinute] = useState(String(clockDefaults.minute));

  const chronological = useMemo(() => sortChronological(events), [events]);
  const gkPlayers = useMemo(() => players.filter((p) => playerIsGoalkeeper(p)), [players]);
  const fieldPlayers = useMemo(() => players.filter((p) => !playerIsGoalkeeper(p)), [players]);
  const addPlayer = addPlayerId ? players.find((p) => p.id === addPlayerId) ?? null : null;
  const reassignEvent = reassignId ? events.find((e) => e.id === reassignId) ?? null : null;
  const reassignCandidates = useMemo(() => {
    if (!reassignEvent) return [];
    if (TEAM_ACTIONS.includes(reassignEvent.action_type)) return [];
    const list = isGkAction(reassignEvent.action_type) ? gkPlayers : fieldPlayers;
    return [...list].sort((a, b) => a.shirt_number - b.shirt_number);
  }, [reassignEvent, gkPlayers, fieldPlayers]);

  const parseMinute = (): number => {
    const n = parseInt(minute.replace(/[^\d]/g, ""), 10);
    if (Number.isNaN(n) || n < 0) return 0;
    return Math.min(n, 130);
  };

  const persistNew = async (row: EventRow) => {
    enqueue(row);
    onEventsChange([...events, row]);
    const flushed = await flushQueue();
    if (flushed === 0) {
      onError("האירוע נשמר במכשיר — יסתנכרן כשיהיה רשת");
    } else {
      onError(null);
    }
  };

  const commitNew = async (
    action: ActionType,
    playerId: string | null,
    zone: Zone | null,
    shot: ShotLocation | null
  ) => {
    const row: EventRow = {
      id: crypto.randomUUID(),
      match_id: matchId,
      player_id: playerId,
      action_type: action,
      zone,
      shot_location: shot,
      half,
      match_minute: parseMinute(),
      created_at: new Date().toISOString(),
    };
    try {
      await persistNew(row);
    } catch {
      onError("הוספת אירוע נכשלה");
    }
    closeAdd();
  };

  const closeAdd = () => {
    setAdding(false);
    setAddPhase("pick");
    setAddPlayerId(null);
    setAddAction(null);
    setDuelKind(null);
    setGkGroup(null);
  };

  const openAdd = () => {
    const clock = defaultClock(match, events);
    setHalf(clock.half);
    setMinute(String(clock.minute));
    setAdding(true);
    setAddPhase("pick");
    onError(null);
  };

  const onActionPick = (action: ActionType) => {
    if (!addPlayerId) return;
    if (ACTIONS_NEED_ZONE.includes(action)) {
      setAddAction(action);
      setAddPhase("zone");
      return;
    }
    if (ACTIONS_NEED_SHOT_LOCATION.includes(action)) {
      setAddAction(action);
      setAddPhase("box");
      return;
    }
    void commitNew(action, addPlayerId, null, null);
  };

  const deleteEvent = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    const prev = events;
    onEventsChange(events.filter((e) => e.id !== id));
    removeFromQueue(id);
    const ok = await deleteRemote(id);
    setBusyId(null);
    if (!ok) {
      onEventsChange(prev);
      onError("מחיקת האירוע נכשלה");
    } else {
      onError(null);
    }
  };

  const reassignTo = async (playerId: string) => {
    if (!reassignEvent || busyId) return;
    setBusyId(reassignEvent.id);
    const next: MatchEvent = { ...reassignEvent, player_id: playerId };
    onEventsChange(events.map((e) => (e.id === next.id ? next : e)));
    removeFromQueue(next.id);
    enqueue(next);
    try {
      await updateEventPlayer(next.id, playerId);
      removeFromQueue(next.id);
      await flushQueue();
      onError(null);
    } catch {
      const flushed = await flushQueue();
      if (flushed === 0) onError("ההעברה נשמרה במכשיר — יסתנכרן כשיהיה רשת");
    }
    setBusyId(null);
    setReassignId(null);
  };

  return (
    <section className="mb-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="label">יומן אירועים מלא ({chronological.length})</h2>
        {isCoach && (
          <button type="button" onClick={openAdd} className="btn btn-ghost h-8 px-3 text-xs no-print">
            + הוסף אירוע
          </button>
        )}
      </div>
      {isCoach && (
        <p className="mb-2 text-[11px] text-[var(--muted-2)] no-print">
          כאן אפשר לבטל אירוע ספציפי או להעביר את אותה פעולה לשחקן הנכון — גם אחרי סיום המשחק.
        </p>
      )}
      {chronological.length === 0 ? (
        <div className="card p-4 text-center text-sm text-[var(--muted)]">עדיין לא נרשמו אירועים</div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {chronological.map((ev) => (
            <li key={ev.id} className="card flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-bold">
                  <span className="tabular text-[var(--muted-2)]">
                    מחצית {ev.half} · {ev.match_minute}׳
                  </span>
                  {" · "}
                  {ACTION_LABELS[ev.action_type]}
                </p>
                <p className="truncate text-[12px] text-[var(--muted)]">
                  {playerLabel(players, ev.player_id)}
                  {ev.zone ? ` · ${ZONE_LABELS[ev.zone]}` : ""}
                  {ev.shot_location ? ` · ${SHOT_LABELS[ev.shot_location]}` : ""}
                </p>
              </div>
              {isCoach && (
                <div className="no-print flex shrink-0 items-center gap-1">
                  {!TEAM_ACTIONS.includes(ev.action_type) && (
                    <button
                      type="button"
                      disabled={busyId === ev.id}
                      onClick={() => setReassignId(ev.id)}
                      className="btn btn-ghost h-8 px-2 text-[11px]"
                    >
                      שחקן אחר
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId === ev.id}
                    onClick={() => void deleteEvent(ev.id)}
                    className="text-red-400/90 px-1 text-base active:scale-95"
                    aria-label="מחק אירוע"
                  >
                    ✕
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {reassignEvent && (
        <div
          className="sheet-overlay fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6 no-print"
          onClick={() => setReassignId(null)}
        >
          <div
            className="sheet-panel sheet max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t border-[var(--border-strong)] bg-[var(--bg)] p-4 pb-8 sm:rounded-3xl sm:border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold text-[var(--muted)]">העבר אירוע</p>
                <h3 className="text-lg font-extrabold">
                  {ACTION_LABELS[reassignEvent.action_type]} · {playerLabel(players, reassignEvent.player_id)}
                </h3>
              </div>
              <button type="button" onClick={() => setReassignId(null)} className="btn btn-ghost h-8 px-3 text-sm">
                בטל
              </button>
            </div>
            <p className="mb-3 text-sm text-[var(--muted)]">בחר את השחקן הנכון לאותה פעולה.</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {reassignCandidates.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={busyId === reassignEvent.id || p.id === reassignEvent.player_id}
                  onClick={() => void reassignTo(p.id)}
                  className="card flex flex-col items-center py-3 active:scale-95"
                >
                  <span className="text-xl font-black tabular">{p.shirt_number}</span>
                  <span className="mt-0.5 max-w-full truncate px-1 text-[11px] text-[var(--muted)]">{p.name}</span>
                  {playerIsGoalkeeper(p) && (
                    <span className="mt-1 text-[10px] font-bold text-violet-300">שוער</span>
                  )}
                </button>
              ))}
            </div>
            {reassignCandidates.length === 0 && (
              <p className="card p-4 text-center text-sm text-[var(--muted)]">אין שחקנים מתאימים להעברה.</p>
            )}
          </div>
        </div>
      )}

      {adding && (
        <div
          className="sheet-overlay fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6 no-print"
          onClick={closeAdd}
        >
          <div
            className="sheet-panel sheet max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t border-[var(--border-strong)] bg-[var(--bg)] p-4 pb-8 sm:rounded-3xl sm:border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-lg font-extrabold">
                {addPhase === "pick" && "הוסף אירוע"}
                {addPhase === "action" && addPlayer && `#${addPlayer.shirt_number} ${addPlayer.name} · מה קרה?`}
                {addPhase === "zone" && addAction && `${ACTION_LABELS[addAction]} · אזור?`}
                {addPhase === "box" && "מאיפה הבעיטה?"}
                {addPhase === "duel" && duelKind && `${DUEL_KIND_LABELS[duelKind]} · תוצאה?`}
                {addPhase === "gk_outcome" && gkGroup && `${gkGroup.label} · תוצאה?`}
              </h3>
              <button type="button" onClick={closeAdd} className="btn btn-ghost h-8 px-3 text-sm">
                בטל
              </button>
            </div>

            {addPhase === "pick" && (
              <>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div>
                    <p className="label mb-1">מחצית</p>
                    <div className="grid grid-cols-2 gap-1">
                      {([1, 2] as Half[]).map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setHalf(h)}
                          className={`btn py-2 text-sm ${half === h ? "btn-primary" : "btn-ghost"}`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="label mb-1">דקה</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={minute}
                      onChange={(e) => setMinute(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                      className="field w-full text-center tabular"
                      aria-label="דקת משחק"
                    />
                  </div>
                </div>

                <p className="label mb-2">פעולה קבוצתית</p>
                <div className="mb-4 grid grid-cols-2 gap-2">
                  {CORNER_ACTIONS.map((action) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => void commitNew(action, null, null, null)}
                      className={`btn rounded-2xl py-3 text-sm ${ACTION_BTN[action]}`}
                    >
                      {ACTION_LABELS[action]}
                    </button>
                  ))}
                </div>

                {gkPlayers.length > 0 && (
                  <>
                    <p className="label mb-2">שוערים</p>
                    <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {gkPlayers.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setAddPlayerId(p.id);
                            setAddPhase("action");
                          }}
                          className="card flex flex-col items-center py-3 active:scale-95"
                        >
                          <span className="text-xl font-black tabular">{p.shirt_number}</span>
                          <span className="mt-0.5 max-w-full truncate px-1 text-[11px] text-[var(--muted)]">
                            {p.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <p className="label mb-2">שחקני שדה</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {fieldPlayers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setAddPlayerId(p.id);
                        setAddPhase("action");
                      }}
                      className="card flex flex-col items-center py-3 active:scale-95"
                    >
                      <span className="text-xl font-black tabular">{p.shirt_number}</span>
                      <span className="mt-0.5 max-w-full truncate px-1 text-[11px] text-[var(--muted)]">
                        {p.name}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {addPhase === "action" && addPlayer && playerIsGoalkeeper(addPlayer) && (
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => onActionPick(GK_SAVE_ACTION)}
                  className={`btn rounded-2xl py-7 text-lg ${ACTION_BTN[GK_SAVE_ACTION]}`}
                >
                  {ACTION_LABELS[GK_SAVE_ACTION]}
                </button>
                {GK_OUTCOME_GROUPS.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      setGkGroup(group);
                      setAddPhase("gk_outcome");
                    }}
                    className={`btn rounded-2xl py-7 text-lg ${ACTION_BTN[group.ok]}`}
                  >
                    {group.label}
                  </button>
                ))}
              </div>
            )}

            {addPhase === "gk_outcome" && gkGroup && (
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => onActionPick(gkGroup.ok)}
                  className="btn rounded-2xl bg-emerald-500/85 py-9 text-xl font-black text-[#04150e]"
                >
                  {gkGroup.okLabel}
                </button>
                <button
                  type="button"
                  onClick={() => onActionPick(gkGroup.miss)}
                  className="btn rounded-2xl bg-red-500/80 py-9 text-xl font-black text-white"
                >
                  {gkGroup.missLabel}
                </button>
              </div>
            )}

            {addPhase === "action" && addPlayer && !playerIsGoalkeeper(addPlayer) && (
              <div className="flex flex-col gap-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  {PRIMARY_ACTIONS.map((action) => (
                    <button
                      key={action}
                      type="button"
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
                      type="button"
                      onClick={() => onActionPick(action)}
                      className={`btn rounded-2xl py-6 text-lg ${ACTION_BTN[action]}`}
                    >
                      {ACTION_LABELS[action]}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {DUEL_KINDS.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => {
                        setDuelKind(kind);
                        setAddPhase("duel");
                      }}
                      className={`btn rounded-2xl py-6 text-lg ${
                        kind === "aerial"
                          ? "bg-gradient-to-b from-sky-400 to-sky-600 text-white"
                          : "bg-gradient-to-b from-lime-400 to-lime-600 text-[#14320a]"
                      }`}
                    >
                      {DUEL_KIND_LABELS[kind]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {addPhase === "duel" && (
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => addPlayerId && duelKind && void commitNew(duelAction(duelKind, "won"), addPlayerId, null, null)}
                  className="btn rounded-2xl bg-emerald-500/85 py-9 text-xl font-black text-[#04150e]"
                >
                  זכה ✓
                </button>
                <button
                  type="button"
                  onClick={() => addPlayerId && duelKind && void commitNew(duelAction(duelKind, "lost"), addPlayerId, null, null)}
                  className="btn rounded-2xl bg-red-500/80 py-9 text-xl font-black text-white"
                >
                  הפסיד ✕
                </button>
              </div>
            )}

            {addPhase === "zone" && (
              <div className="grid grid-cols-3 gap-2.5">
                {(["def", "mid", "att"] as Zone[]).map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => addAction && void commitNew(addAction, addPlayerId, z, null)}
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

            {addPhase === "box" && (
              <div className="grid grid-cols-2 gap-2.5">
                {(["in_box", "out_box"] as ShotLocation[]).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => addAction && void commitNew(addAction, addPlayerId, null, loc)}
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
    </section>
  );
}
