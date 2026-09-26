import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RiskBand, TrendPoint, Txn } from "@/lib/fraud-engine";
import { clockOf, money } from "@/lib/fraud-engine";

const bandStyles: Record<RiskBand, string> = {
  critical: "bg-critical/15 text-critical border-critical/40",
  high: "bg-high/15 text-high border-high/40",
  medium: "bg-medium/15 text-medium border-medium/40",
  low: "bg-low/15 text-low border-low/40",
};

export function RiskBadge({ band, score }: { band: RiskBand; score?: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider ${bandStyles[band]}`}
    >
      {band}
      {score !== undefined && <span className="numeric text-xs opacity-80">{score}</span>}
    </span>
  );
}

export function Panel({
  title,
  hint,
  action,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel flex flex-col ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </header>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  delta,
  tone = "neutral",
  sub,
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: "neutral" | "critical" | "low" | "high";
  sub?: string;
}) {
  const toneRing =
    tone === "critical"
      ? "glow-alert"
      : tone === "neutral"
        ? "glow-ring"
        : "border border-border";
  const toneText =
    tone === "critical"
      ? "text-critical"
      : tone === "high"
        ? "text-high"
        : tone === "low"
          ? "text-low"
          : "text-primary";
  return (
    <div className={`panel-raised px-4 py-3.5 ${toneRing}`}>
      <p className="label-caps">{label}</p>
      <p className={`numeric mt-2 text-2xl font-semibold ${toneText}`}>{value}</p>
      <div className="mt-1 flex items-baseline gap-2 text-xs text-muted-foreground">
        {delta && <span className="numeric">{delta}</span>}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="panel-raised px-3 py-2 text-xs shadow-lg">
      <p className="label-caps mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="numeric" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

const axis = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export function VolumeTrend({ data }: { data: TrendPoint[] }) {
  if (!useMounted()) return <div className="h-56" />;
  return (
    <ResponsiveContainer width="100%" height={224}>
      <AreaChart data={data} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gVol" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gFlag" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.55} />
            <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="volume"
          name="Transactions"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          fill="url(#gVol)"
        />
        <Area
          type="monotone"
          dataKey="flagged"
          name="Flagged"
          stroke="var(--color-chart-2)"
          strokeWidth={2}
          fill="url(#gFlag)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ScoreTrend({ data }: { data: TrendPoint[] }) {
  if (!useMounted()) return <div className="h-40" />;
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis domain={[0, 100]} {...axis} />
        <Tooltip content={<ChartTooltip />} />
        <Line
          type="monotone"
          dataKey="avgScore"
          name="Avg risk score"
          stroke="var(--color-chart-3)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function FraudTypeBars({ data }: { data: Array<{ name: string; count: number }> }) {
  if (!useMounted()) return <div className="h-52" />;
  const palette = [
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-1)",
    "var(--color-chart-5)",
    "var(--color-chart-4)",
    "var(--color-high)",
  ];
  return (
    <ResponsiveContainer width="100%" height={208}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 24, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-border)" horizontal={false} />
        <XAxis type="number" {...axis} />
        <YAxis type="category" dataKey="name" width={112} {...axis} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="count" name="Alerts" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TxnRow({ txn, onSelect }: { txn: Txn; onSelect: (t: Txn) => void }) {
  return (
    <button
      onClick={() => onSelect(txn)}
      className="row-in grid w-full grid-cols-[78px_1fr_92px_110px_88px] items-center gap-3 border-b border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-accent/60"
    >
      <span className="numeric text-xs text-muted-foreground">{clockOf(txn.ts)}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm">{txn.merchant}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {txn.channel} · {txn.city}, {txn.country} · ••{txn.cardLast4}
        </span>
      </span>
      <span className="numeric text-sm">{money(txn.amount)}</span>
      <RiskBadge band={txn.band} score={txn.score} />
      <span className="text-xs text-muted-foreground">{txn.decision}</span>
    </button>
  );
}
