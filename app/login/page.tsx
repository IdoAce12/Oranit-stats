"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../components/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "שם או סיסמה שגויים");
        return;
      }
      await refresh();
      router.replace("/");
      router.refresh();
    } catch {
      setError("אין חיבור");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="login-screen relative mx-auto flex min-h-full w-full max-w-md flex-1 flex-col px-4 page-shell pb-10">
      <div className="photo-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/club/08.jpg" alt="" className="photo-slide is-active" />
        <div className="photo-veil" aria-hidden />
      </div>
      <div className="relative z-10">
        <div className="mb-8 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hapoel-oranit.png"
            alt="הפועל אורנית"
            className="h-14 w-14 rounded-full object-cover ring-2 ring-white/25"
          />
          <div>
            <p className="home-kicker">הפועל אורנית</p>
            <h1 className="home-hello text-[1.85rem]">כניסה</h1>
          </div>
          <div className="ms-auto">
            <ThemeToggle />
          </div>
        </div>

        <form onSubmit={onSubmit} className="match-glass flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="label">שם</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="field w-full"
              placeholder="השם שקיבלת"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">סיסמה</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="field w-full"
              required
            />
          </label>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button type="submit" disabled={saving} className="btn btn-primary mt-1 w-full py-3.5 text-lg">
            {saving ? "נכנס..." : "כניסה"}
          </button>
        </form>
      </div>
    </main>
  );
}
