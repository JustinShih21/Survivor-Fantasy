"use client";

const BUDGET = 1_000_000;

interface BudgetBarProps {
  total: number;
}

export function BudgetBar({ total }: BudgetBarProps) {
  const pct = Math.min(100, (total / BUDGET) * 100);
  const isOver = total > BUDGET;

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm font-medium mb-1 text-stone-300">
        <span>Budget</span>
        <span className={isOver ? "text-red-400" : "text-stone-200"}>
          ${total.toLocaleString()} / ${BUDGET.toLocaleString()}
        </span>
      </div>
      <div className="h-2 w-full bg-stone-700/80 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            isOver ? "bg-red-500" : "bg-emerald-500"
          }`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}
