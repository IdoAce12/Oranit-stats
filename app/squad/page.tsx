"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { ConfigBanner } from "../components/ConfigBanner";
import {
  addSquadPlayer,
  deleteSquadPlayer,
  listSquad,
  updateSquadPlayer,
} from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { SquadPlayer } from "@/lib/types";

/** מנקה ספרות בלבד (כולל ספרות ערביות־מזרחיות) ומחזיר מספר חולצה או null */
function parseShirtNumber(raw: string): number | null {
  const digits = raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[^\d]/g, "");
  if (!digits) return null;
  const num = parseInt(digits, 10);
  if (Number.isNaN(num) || num < 0 || num > 99) return null;
  return num;
}

export default function SquadPage() {
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newNumber, setNewNumber] = useState("");
  const [newName, setNewName] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [adding, setAdding] = useState(false);

  const load = () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    listSquad()
      .then(setSquad)
      .catch((e) => setError(e.message ?? "שגיאה"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleAdd = async () => {
    setError(null);
    const num = parseShirtNumber(newNumber);
    if (num === null) return setError("מספר חולצה לא תקין (0–99)");
    if (!newName.trim()) return setError("צריך שם שחקן");
    setAdding(true);
    try {
      const player = await addSquadPlayer({
        shirt_number: num,
        name: newName.trim(),
        position: newPosition.trim() || null,
      });
      setSquad((prev) =>
        [...prev, player].sort((a, b) => a.shirt_number - b.shirt_number)
      );
      setNewNumber("");
      setNewName("");
      setNewPosition("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "שגיאה בהוספה";
      if (/relation .*squad_players.* does not exist|Could not find the table/i.test(msg)) {
        setError("טבלת הסגל חסרה ב-Supabase — הרץ את db/migration_v2.sql");
      } else {
        setError(msg);
      }
    } finally {
      setAdding(false);
    }
  };

  const onNumberChange = (raw: string) => {
    const cleaned = raw
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
      .replace(/[^\d]/g, "")
      .slice(0, 2);
    setNewNumber(cleaned);
  };

  const patchLocal = (id: string, patch: Partial<SquadPlayer>) => {
    setSquad((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const saveField = async (
    id: string,
    field: "shirt_number" | "name",
    value: string
  ) => {
    if (field === "shirt_number") {
      const num = parseShirtNumber(value);
      if (num === null) {
        setError("מספר חולצה לא תקין (0–99)");
        return;
      }
      try {
        await updateSquadPlayer(id, { shirt_number: num });
        patchLocal(id, { shirt_number: num });
      } catch {
        setError("שמירה נכשלה");
      }
      return;
    }
    const name = value.trim();
    if (!name) {
      setError("שם שחקן לא יכול להיות ריק");
      return;
    }
    try {
      await updateSquadPlayer(id, { name });
      patchLocal(id, { name });
    } catch {
      setError("שמירה נכשלה");
    }
  };

  const toggleActive = async (p: SquadPlayer) => {
    patchLocal(p.id, { active: !p.active });
    try {
      await updateSquadPlayer(p.id, { active: !p.active });
    } catch {
      patchLocal(p.id, { active: p.active });
    }
  };

  const remove = async (id: string) => {
    const prev = squad;
    setSquad((s) => s.filter((p) => p.id !== id));
    try {
      await deleteSquadPlayer(id);
    } catch {
      setSquad(prev);
      setError("מחיקה נכשלה");
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-6 pb-10">
      <AppHeader
        title="הסגל שלי"
        subtitle={`${squad.length} שחקנים`}
        backHref="/"
      />

      <ConfigBanner />

      {/* הוספת שחקן */}
      <div className="card mb-5 p-4">
        <p className="label mb-3">הוספת שחקן לסגל</p>
        <div className="flex items-stretch gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={newNumber}
            onChange={(e) => onNumberChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
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
                handleAdd();
              }
            }}
            placeholder="שם השחקן"
            aria-label="שם השחקן"
            className="field min-w-0 flex-1"
          />
        </div>
        <input
          type="text"
          value={newPosition}
          onChange={(e) => setNewPosition(e.target.value)}
          placeholder="עמדה (אופציונלי) — למשל בלם / קשר"
          className="field mt-2 w-full"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !isSupabaseConfigured}
          className="btn btn-primary mt-3 w-full py-3"
        >
          {adding ? "מוסיף..." : "+ הוסף לסגל"}
        </button>
      </div>

      {error && <p className="mb-3 text-[var(--danger)]">{error}</p>}

      {loading && <p className="text-[var(--muted)]">טוען...</p>}

      {!loading && squad.length === 0 && (
        <div className="card p-6 text-center text-sm text-[var(--muted)]">
          הסגל ריק. הוסף שחקנים כדי שתוכל לבחור אותם בכל משחק בלחיצה.
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {squad.map((p) => (
          <li
            key={p.id}
            className={`card flex items-center gap-2 p-2.5 ${p.active ? "" : "opacity-45"}`}
          >
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={p.shirt_number}
              onBlur={(e) => saveField(p.id, "shirt_number", e.target.value)}
              aria-label="מספר חולצה"
              className="field w-14 shrink-0 px-0 text-center text-lg font-extrabold tabular"
            />
            <input
              type="text"
              defaultValue={p.name}
              onBlur={(e) => saveField(p.id, "name", e.target.value)}
              aria-label="שם השחקן"
              className="field min-w-0 flex-1"
            />
            <button
              onClick={() => toggleActive(p)}
              className={`btn h-10 shrink-0 px-2 text-xs ${
                p.active ? "btn-ghost text-[var(--accent)]" : "btn-ghost text-[var(--muted-2)]"
              }`}
              title={p.active ? "פעיל בסגל" : "לא פעיל — לחץ להפעלה"}
            >
              {p.active ? "פעיל" : "כבוי"}
            </button>
            <button
              onClick={() => remove(p.id)}
              className="btn btn-danger h-10 w-10 shrink-0"
              aria-label="מחק"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {squad.length > 0 && (
        <p className="mt-4 text-center text-xs text-[var(--muted-2)]">
          שינויים נשמרים אוטומטית. ✓ = שחקן פעיל שיוצג בבחירה למשחק.
        </p>
      )}
    </main>
  );
}
