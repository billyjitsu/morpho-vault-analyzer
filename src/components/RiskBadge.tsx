"use client";

type RiskLevel = "low" | "medium" | "high" | "critical" | "extreme" | "unknown";

const config: Record<RiskLevel, { bg: string; text: string; label: string; dot: string }> = {
  low: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "LOW", dot: "bg-emerald-400" },
  medium: { bg: "bg-amber-500/10", text: "text-amber-400", label: "MEDIUM", dot: "bg-amber-400" },
  high: { bg: "bg-orange-500/10", text: "text-orange-400", label: "HIGH", dot: "bg-orange-400" },
  critical: { bg: "bg-red-500/10", text: "text-red-400", label: "CRITICAL", dot: "bg-red-400" },
  extreme: { bg: "bg-red-500/10", text: "text-red-400", label: "EXTREME", dot: "bg-red-400" },
  unknown: { bg: "bg-zinc-500/10", text: "text-zinc-400", label: "UNKNOWN", dot: "bg-zinc-400" },
};

export function RiskBadge({ level, size = "sm" }: { level: RiskLevel; size?: "sm" | "lg" }) {
  const c = config[level];
  const sizeClasses = size === "lg" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide ${c.bg} ${c.text} ${sizeClasses}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

export function RiskBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  let color = "bg-emerald-400";
  if (pct >= 95) color = "bg-red-400";
  else if (pct >= 85) color = "bg-orange-400";
  else if (pct >= 70) color = "bg-amber-400";

  return (
    <div className="h-1.5 w-full rounded-full bg-zinc-800">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function UtilizationGauge({ utilization }: { utilization: number }) {
  const pct = Math.round(utilization * 100);
  let color = "text-emerald-400";
  if (pct >= 95) color = "text-red-400";
  else if (pct >= 85) color = "text-orange-400";
  else if (pct >= 70) color = "text-amber-400";

  return (
    <div className="flex items-center gap-2">
      <RiskBar value={pct} />
      <span className={`text-xs font-mono font-semibold ${color} min-w-[3rem] text-right`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}
