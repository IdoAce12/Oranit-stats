"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addPlayers, createMatch } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { ConfigBanner } from "../components/ConfigBanner";

interface RosterRow {
  shirt_number: string;
  name: string;
}

function defaultRoster(): RosterRow[] {
  return Array.from({ length: 11 }, (_, i) => ({
    shirt_number: String(i + 1),
    name: "",
  }));
}

export default function SetupPage() {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [opponent, setOpponent] = useState("");
  const [matchDate, setMatchDate] = useState(today);
  const [teamName, setTeamName] = useState("");
  const [roster, setRoster] = useState<RosterRow[]>(defaultRoster());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateRow = (index: number, field: keyof RosterRow, value: string) => {
    setRoster((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const addRow = () => {
    const nextNumber = roster.length + 1;
    setRoster((prev) => [...prev, { shirt_number: String(nextNumber), name: "" }]);
  };

  const removeRow = (index: number) => {
    setRoster((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!opponent.trim()) {
      setError("צריך להזין שם יריב");
      return;
    }
    const validPlayers = roster
      .filter((r) => r.shirt_number.trim() !== "")
      .map((r) => ({
        shirt_number: parseInt(r.shirt_number, 10),
        name: r.name.trim() || `שחקן ${r.shirt_number}`,
      }))
      .filter((r) => !Number.isNaN(r.shirt_number));

    if (validPlayers.length === 0) {
      setError("צריך להזין לפחות שחקן אחד");
      return;
    }

    setSaving(true);
    try {
      const match = await createMatch({
        opponent: opponent.trim(),
        match_date: matchDate,
        our_team_name: teamName.trim(),
      });
      await addPlayers(match.id, validPlayers);
      router.push(`/live/${match.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בשמירה");
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-5 pb-10">
      <header className="mb-5 flex items-center justify-between">
        <Link href="/" className="text-sm text-white/60">
          ← חזרה
        </Link>
        <h1 className="text-xl font-bold">משחק חדש</h1>
        <span className="w-12" />
      </header>

      <ConfigBanner />

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-white/70">שם היריב</span>
          <input
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="לדוגמה: הפועל מגדל"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-base outline-none focus:border-green-500"
          />
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm text-white/70">תאריך</span>
            <input
              type="date"
              value={matchDate}
              onChange={(e) => setMatchDate(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-base outline-none focus:border-green-500"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm text-white/70">הקבוצה שלנו</span>
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="אופציונלי"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-base outline-none focus:border-green-500"
            />
          </label>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-white/70">סגל שחקנים</span>
            <button
              onClick={addRow}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold active:scale-95"
            >
              + הוסף שחקן
            </button>
          </div>

          <ul className="flex flex-col gap-2">
            {roster.map((row, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  inputMode="numeric"
                  value={row.shirt_number}
                  onChange={(e) => updateRow(i, "shirt_number", e.target.value)}
                  className="w-14 rounded-xl border border-white/10 bg-white/5 px-2 py-2.5 text-center text-base outline-none focus:border-green-500"
                />
                <input
                  value={row.name}
                  onChange={(e) => updateRow(i, "name", e.target.value)}
                  placeholder={`שם שחקן ${row.shirt_number}`}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-base outline-none focus:border-green-500"
                />
                <button
                  onClick={() => removeRow(i)}
                  className="rounded-xl bg-red-500/20 px-3 py-2.5 text-red-300 active:scale-95"
                  aria-label="הסר"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>

        {error && <p className="text-red-400">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={saving || !isSupabaseConfigured}
          className="mt-2 rounded-2xl bg-green-500 px-4 py-4 text-lg font-bold text-black active:scale-[0.98] disabled:opacity-40"
        >
          {saving ? "שומר..." : "התחל משחק ←"}
        </button>
      </div>
    </main>
  );
}
