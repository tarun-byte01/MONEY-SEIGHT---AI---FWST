import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildTrend,
  clockOf,
  makeTxn,
  money,
  seedHistory,
  type Txn,
} from "@/lib/fraud-engine";
import {
  FraudTypeBars,
  Panel,
  RiskBadge,
  ScoreTrend,
  StatCard,
  TxnRow,
  VolumeTrend,
} from "@/components/fraud/widgets";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Live Fraud Monitoring — Sentinel" },
      {
        name: "description",
        content:
          "Real-time transaction stream, behavioural risk scoring, fraud alerts and trend analytics in a single operations view.",
      },
      { property: "og:title", content: "Live Fraud Monitoring — Sentinel" },
      {
        property: "og:description",
        content:
          "Real-time transaction stream, behavioural risk scoring, fraud alerts and trend analytics in a single operations view.",
      },
    ],
  }),
  component: MonitoringDashboard,
});

const ANCHOR = 1790000000000;
const MAX_ROWS = 220;

function MonitoringDashboard() {
  const [txns, setTxns] = useState<Txn[]>(() => seedHistory(160, 5_000, ANCHOR));
  const [live, setLive] = useState(true);
  const [minBand, setMinBand] = useState<"all" | "flagged" | "critical">("all");
  const [selected, setSelected] = useState<Txn | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live stream: replace seeded history with a real-time clock once hydrated.
  useEffect(() => {
    setTxns(seedHistory(160, 5_000, Date.now()));
  }, []);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      setTxns((prev) => [makeTxn(Math.random, Date.now()), ...prev].slice(0, MAX_ROWS));
      timer.current = setTimeout(tick, 700 + Math.random() * 1400);
    };
    timer.current = setTimeout(tick, 900);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [live]);

  const trend = useMemo(() => buildTrend(txns), [txns]);
  const flagged = useMemo(
    () => txns.filter((t) => t.band === "high" || t.band === "critical"),
    [txns],
  );
  const blocked = useMemo(() => txns.filter((t) => t.decision === "Blocked"), [txns]);
  const exposure = blocked.reduce((a, t) => a + t.amount, 0);
  const flagRate = txns.length ? (flagged.length / txns.length) * 100 : 0;
  const avgScore = txns.length
    ? Math.round(txns.reduce((a, t) => a + t.score, 0) / txns.length)
    : 0;

  const typeData = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of flagged) if (t.fraudType) map.set(t.fraudType, (map.get(t.fraudType) ?? 0) + 1);
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [flagged]);

  const channelData = useMemo(() => {
    const map = new Map<string, { total: number; flagged: number }>();
    for (const t of txns) {
      const row = map.get(t.channel) ?? { total: 0, flagged: 0 };
      row.total += 1;
      if (t.band === "high" || t.band === "critical") row.flagged += 1;
      map.set(t.channel, row);
    }
    return [...map.entries()]
      .map(([channel, v]) => ({ channel, ...v, rate: (v.flagged / v.total) * 100 }))
      .sort((a, b) => b.rate - a.rate);
  }, [txns]);

  const streamRows = useMemo(() => {
    const base =
      minBand === "all" ? txns : minBand === "flagged" ? flagged : txns.filter((t) => t.band === "critical");
    return base.slice(0, 40);
  }, [txns, flagged, minBand]);

  const alerts = useMemo(() => flagged.slice(0, 8), [flagged]);
  const detail = selected ?? alerts[0] ?? txns[0] ?? null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-md border border-primary/40 bg-primary/10 text-primary">
              <span className="numeric text-sm font-semibold">S</span>
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">
                Sentinel <span className="text-muted-foreground">Fraud Operations</span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Continuous transaction monitoring · Retail &amp; payments portfolio
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="numeric flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground">
              <span className="live-dot inline-block size-1.5 rounded-full bg-low" />
              {txns[0] ? clockOf(txns[0].ts) : "--:--:--"} UTC
            </span>
            <button
              onClick={() => setLive((v) => !v)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                live
                  ? "border-primary/50 bg-primary/12 text-primary"
                  : "border-border bg-surface text-muted-foreground hover:bg-accent"
              }`}
            >
              {live ? "Live feed on" : "Feed paused"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-4 px-5 py-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Transactions monitored"
            value={txns.length.toLocaleString()}
            sub="rolling window"
          />
          <StatCard
            label="Open fraud alerts"
            value={flagged.length.toString()}
            tone="high"
            sub="high + critical"
          />
          <StatCard
            label="Blocked in-flight"
            value={blocked.length.toString()}
            tone="critical"
            sub={money(exposure) + " exposure held"}
          />
          <StatCard label="Flag rate" value={`${flagRate.toFixed(1)}%`} tone="low" sub="of volume" />
          <StatCard label="Avg risk score" value={String(avgScore)} sub="behavioural model v4" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
          <Panel
            title="Transaction volume vs flagged activity"
            hint="Last 12 minutes, one-minute buckets"
          >
            <VolumeTrend data={trend} />
            <div className="mt-3 flex gap-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <i className="inline-block size-2 rounded-full bg-chart-1" /> Transactions
              </span>
              <span className="flex items-center gap-2">
                <i className="inline-block size-2 rounded-full bg-chart-2" /> Flagged
              </span>
            </div>
          </Panel>

          <Panel title="Fraud typologies detected" hint="Alert count by pattern">
            <FraudTypeBars data={typeData} />
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
          <Panel
            title="Live transaction stream"
            hint="Scored on arrival by the behavioural engine"
            action={
              <div className="flex gap-1 rounded-md border border-border bg-surface p-0.5">
                {(["all", "flagged", "critical"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setMinBand(f)}
                    className={`rounded px-2.5 py-1 text-xs capitalize transition-colors ${
                      minBand === f
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            }
            className="overflow-hidden"
          >
            <div className="grid grid-cols-[78px_1fr_92px_110px_88px] gap-3 border-b border-border px-3 pb-2">
              <span className="label-caps">Time</span>
              <span className="label-caps">Merchant / context</span>
              <span className="label-caps">Amount</span>
              <span className="label-caps">Risk</span>
              <span className="label-caps">Decision</span>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {streamRows.map((t) => (
                <TxnRow key={t.id} txn={t} onSelect={setSelected} />
              ))}
              {streamRows.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No transactions match this filter yet.
                </p>
              )}
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel title="Priority alert queue" hint="Highest risk first, newest on top">
              <ul className="space-y-2">
                {alerts.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => setSelected(a)}
                      className={`w-full rounded-md border px-3 py-2.5 text-left transition-colors hover:bg-accent/60 ${
                        detail?.id === a.id ? "border-primary/50 bg-accent/40" : "border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="numeric text-xs text-muted-foreground">{a.id}</span>
                        <RiskBadge band={a.band} score={a.score} />
                      </div>
                      <p className="mt-1 text-sm">
                        {a.fraudType} · <span className="numeric">{money(a.amount)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.customer} · {a.channel} · {a.city}, {a.country}
                      </p>
                    </button>
                  </li>
                ))}
                {alerts.length === 0 && (
                  <li className="py-6 text-center text-sm text-muted-foreground">
                    No open alerts in this window.
                  </li>
                )}
              </ul>
            </Panel>

            <Panel title="Average risk score" hint="Portfolio drift over 12 minutes">
              <ScoreTrend data={trend} />
            </Panel>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Panel title="Channel risk breakdown" hint="Flag rate by acceptance channel">
            <ul className="space-y-3">
              {channelData.map((c) => (
                <li key={c.channel}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span>{c.channel}</span>
                    <span className="numeric text-xs text-muted-foreground">
                      {c.flagged}/{c.total} · {c.rate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${c.rate > 40 ? "bg-critical" : c.rate > 22 ? "bg-high" : "bg-primary"}`}
                      style={{ width: `${Math.min(100, c.rate * 2)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Investigation detail"
            hint={detail ? `Case context for ${detail.id}` : "Select a transaction"}
          >
            {detail ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <RiskBadge band={detail.band} score={detail.score} />
                  <span className="numeric text-lg font-semibold">{money(detail.amount)}</span>
                  <span className="text-sm text-muted-foreground">
                    {detail.merchant} · {detail.channel}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  {[
                    ["Customer", detail.customer],
                    ["Card", `••${detail.cardLast4}`],
                    ["Location", `${detail.city}, ${detail.country}`],
                    ["Decision", detail.decision],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="label-caps">{k}</dt>
                      <dd className="numeric mt-1">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <p className="label-caps mb-2">Model reason codes</p>
                  {detail.reasons.length ? (
                    <ul className="space-y-1.5">
                      {detail.reasons.map((r) => (
                        <li
                          key={r}
                          className="flex items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm"
                        >
                          <span className="size-1.5 rounded-full bg-high" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No adverse signals — behaviour consistent with customer baseline.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button className="rounded-md border border-critical/50 bg-critical/12 px-3 py-1.5 text-sm text-critical transition-colors hover:bg-critical/20">
                    Confirm fraud
                  </button>
                  <button className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm transition-colors hover:bg-accent">
                    Escalate to investigator
                  </button>
                  <button className="rounded-md border border-low/50 bg-low/12 px-3 py-1.5 text-sm text-low transition-colors hover:bg-low/20">
                    Mark legitimate
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Pick a transaction from the stream.</p>
            )}
          </Panel>
        </div>

        <p className="pb-6 text-center text-xs text-muted-foreground">
          Demonstration environment — transactions are simulated for monitoring and analytics review.
        </p>
      </main>
    </div>
  );
}
