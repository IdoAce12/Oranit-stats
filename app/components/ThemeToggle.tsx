"use client";

import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const light = theme === "light";
  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-ghost no-print h-9 w-9 shrink-0 text-sm"
      aria-label={light ? "מצב כהה" : "מצב בהיר"}
      title={light ? "מצב כהה" : "מצב בהיר"}
    >
      {light ? "☾" : "☀"}
    </button>
  );
}
