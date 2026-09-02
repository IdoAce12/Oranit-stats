import { MATCH_TYPE_LABELS, MATCH_TYPE_ORDER, MatchType } from "@/lib/types";
import { toggleMatchType } from "@/lib/matchFilter";
import { RateMode } from "@/lib/rates";

export function MatchTypeChips({
  selected,
  onChange,
  typeCounts,
  total,
}: {
  selected: MatchType[];
  onChange: (next: MatchType[]) => void;
  typeCounts: Record<MatchType, number>;
  total: number;
}) {
  const allActive = selected.length === 0;
  return (
    <>
      <p className="mb-1.5 text-[11px] text-[var(--muted-2)]">סוג משחק — אפשר לבחור כמה</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange([])}
          className={`btn h-8 px-3 text-xs ${allActive ? "btn-primary" : "btn-ghost"}`}
        >
          הכל ({total})
        </button>
        {MATCH_TYPE_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(toggleMatchType(selected, t))}
            className={`btn h-8 px-3 text-xs ${selected.includes(t) ? "btn-primary" : "btn-ghost"}`}
          >
            {MATCH_TYPE_LABELS[t]} ({typeCounts[t]})
          </button>
        ))}
      </div>
    </>
  );
}

export function RateModeToggle({
  mode,
  onChange,
}: {
  mode: RateMode;
  onChange: (mode: RateMode) => void;
}) {
  return (
    <div className="mb-3">
      <p className="mb-1.5 text-[11px] text-[var(--muted-2)]">
        תרומה לדקות — סה״כ או קצב ל־90 דקות
      </p>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => onChange("total")}
          className={`btn h-8 flex-1 px-3 text-xs ${mode === "total" ? "btn-primary" : "btn-ghost"}`}
        >
          סה״כ
        </button>
        <button
          type="button"
          onClick={() => onChange("per90")}
          className={`btn h-8 flex-1 px-3 text-xs ${mode === "per90" ? "btn-primary" : "btn-ghost"}`}
        >
          ל־90׳
        </button>
      </div>
    </div>
  );
}
