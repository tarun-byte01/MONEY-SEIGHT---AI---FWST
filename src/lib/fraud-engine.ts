export type Channel = "Card Present" | "E-Commerce" | "Mobile Wallet" | "Wire" | "ATM" | "P2P";
export type FraudType =
  | "Card Testing"
  | "Account Takeover"
  | "Velocity Abuse"
  | "Impossible Travel"
  | "Mule Account"
  | "Synthetic Identity";

export type RiskBand = "critical" | "high" | "medium" | "low";

export interface Txn {
  id: string;
  ts: number;
  amount: number;
  currency: "USD";
  channel: Channel;
  merchant: string;
  city: string;
  country: string;
  customer: string;
  cardLast4: string;
  score: number;
  band: RiskBand;
  reasons: string[];
  fraudType: FraudType | null;
  decision: "Approved" | "Step-up" | "Blocked";
}

const CHANNELS: Channel[] = [
  "Card Present",
  "E-Commerce",
  "Mobile Wallet",
  "Wire",
  "ATM",
  "P2P",
];

const MERCHANTS = [
  "Northgate Fuel",
  "Luma Electronics",
  "BlueCart Online",
  "Skyline Airways",
  "CryptoBridge Exchange",
  "Metro Grocery",
  "Vantage Jewellers",
  "GameKey Digital",
  "Helios Travel",
  "QuickCash ATM",
];

const PLACES: Array<[string, string]> = [
  ["Chicago", "US"],
  ["Newark", "US"],
  ["Austin", "US"],
  ["London", "GB"],
  ["Lagos", "NG"],
  ["Bucharest", "RO"],
  ["Singapore", "SG"],
  ["São Paulo", "BR"],
  ["Mumbai", "IN"],
  ["Kyiv", "UA"],
];

const CUSTOMERS = [
  "CUS-40218",
  "CUS-77310",
  "CUS-11904",
  "CUS-65002",
  "CUS-28841",
  "CUS-93157",
  "CUS-50623",
  "CUS-31188",
];

const REASON_POOL: Array<[string, number]> = [
  ["New device fingerprint", 14],
  ["3 declines in 60s", 22],
  ["Amount 8x customer average", 20],
  ["Geo mismatch with last auth", 24],
  ["High-risk merchant category", 16],
  ["Beneficiary added < 1h ago", 26],
  ["Night-time activity pattern", 9],
  ["IP on proxy/VPN list", 18],
  ["Velocity: 6 txns in 5 min", 25],
  ["Name/account mismatch", 21],
];

const FRAUD_TYPES: FraudType[] = [
  "Card Testing",
  "Account Takeover",
  "Velocity Abuse",
  "Impossible Travel",
  "Mule Account",
  "Synthetic Identity",
];

function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)]!;
}

export function bandOf(score: number): RiskBand {
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  return "low";
}

let seq = 0;

export function makeTxn(rnd: () => number = Math.random, at = Date.now()): Txn {
  const channel = pick(CHANNELS, rnd);
  const [city, country] = pick(PLACES, rnd);
  const suspicious = rnd() < 0.34;

  const reasons: string[] = [];
  let score = 6 + rnd() * 22;
  const draws = suspicious ? 2 + Math.floor(rnd() * 3) : rnd() < 0.5 ? 1 : 0;
  const shuffled = [...REASON_POOL].sort(() => rnd() - 0.5);
  for (let i = 0; i < draws; i++) {
    const [text, weight] = shuffled[i]!;
    reasons.push(text);
    score += weight * (0.7 + rnd() * 0.6);
  }
  score = Math.max(2, Math.min(99, Math.round(score)));
  const band = bandOf(score);

  const base = channel === "Wire" ? 4000 : channel === "ATM" ? 300 : 120;
  const amount = Math.round(base * (0.2 + rnd() * (band === "low" ? 3 : 14)) * 100) / 100;

  seq += 1;
  return {
    id: `TX-${(at % 100000).toString().padStart(5, "0")}-${seq.toString().padStart(4, "0")}`,
    ts: at,
    amount,
    currency: "USD",
    channel,
    merchant: pick(MERCHANTS, rnd),
    city,
    country,
    customer: pick(CUSTOMERS, rnd),
    cardLast4: String(1000 + Math.floor(rnd() * 8999)).slice(0, 4),
    score,
    band,
    reasons,
    fraudType: band === "low" ? null : pick(FRAUD_TYPES, rnd),
    decision: band === "critical" ? "Blocked" : band === "high" ? "Step-up" : "Approved",
  };
}

/** Deterministic seeded RNG so server and client first paint agree. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function seedHistory(count: number, spacingMs: number, anchor: number): Txn[] {
  const rnd = seeded(20260926);
  const out: Txn[] = [];
  for (let i = count - 1; i >= 0; i--) {
    out.push(makeTxn(rnd, anchor - i * spacingMs));
  }
  return out.reverse();
}

export interface TrendPoint {
  label: string;
  minute: number;
  volume: number;
  flagged: number;
  blocked: number;
  avgScore: number;
}

export function buildTrend(txns: Txn[], buckets = 12, bucketMs = 60_000): TrendPoint[] {
  const now = txns.length ? Math.max(...txns.map((t) => t.ts)) : Date.now();
  const points: TrendPoint[] = [];
  for (let i = buckets - 1; i >= 0; i--) {
    const end = now - i * bucketMs;
    const start = end - bucketMs;
    const slice = txns.filter((t) => t.ts > start && t.ts <= end);
    const flagged = slice.filter((t) => t.band === "high" || t.band === "critical");
    points.push({
      label: `-${i}m`,
      minute: i,
      volume: slice.length,
      flagged: flagged.length,
      blocked: slice.filter((t) => t.decision === "Blocked").length,
      avgScore: slice.length
        ? Math.round(slice.reduce((a, t) => a + t.score, 0) / slice.length)
        : 0,
    });
  }
  return points;
}

export function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function clockOf(ts: number) {
  return new Date(ts).toISOString().slice(11, 19);
}
