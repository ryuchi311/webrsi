// ─── BingX Public API — no key needed ────────────────────────────────────────

const BINGX_API = "/bingx"; // proxied through Vite dev server
const WEIGHT_KLINES = 5;
const WEIGHT_TICKER = 40;
const PER_REQUEST_SLEEP_MS = 220;

// ── Rate limiter (mirrors Python class) ──────────────────────────────────────
class RateLimiter {
  private maxWeight: number;
  private windowStart: number;
  private spent: number;

  constructor(maxWeightPerMin = 1200) {
    this.maxWeight = maxWeightPerMin;
    this.windowStart = Date.now();
    this.spent = 0;
  }

  async consume(weight: number): Promise<void> {
    const now = Date.now();
    if (now - this.windowStart >= 60_000) {
      this.windowStart = now;
      this.spent = 0;
    }
    if (this.spent + weight > this.maxWeight) {
      const sleepFor = 60_000 - (now - this.windowStart);
      if (sleepFor > 0) await sleep(sleepFor + 500);
      this.windowStart = Date.now();
      this.spent = 0;
    }
    this.spent += weight;
  }

  getSpent() {
    return this.spent;
  }

  getMax() {
    return this.maxWeight;
  }

  resetIfNeeded() {
    const now = Date.now();
    if (now - this.windowStart >= 60_000) {
      this.windowStart = now;
      this.spent = 0;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const rateLimiter = new RateLimiter(1200);

async function httpGet<T>(url: string, weight: number): Promise<T | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await rateLimiter.consume(weight);
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        const delay = retryAfter ? (parseInt(retryAfter) + 1) * 1000 : 10_000 * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }
      if (!res.ok) return null;
      const data = await res.json();
      await sleep(PER_REQUEST_SLEEP_MS);
      return data as T;
    } catch (error) {
      const delay = attempt === 0 ? 250 : attempt === 1 ? 750 : 1500;
      if (attempt === 2) break;
      await sleep(delay);
    }
  }
  return null;
}

// ── Symbol list ───────────────────────────────────────────────────────────────
interface TickerItem {
  symbol: string;
  volume: string | number;
}

interface TickerResponse {
  code: number;
  data: TickerItem[];
}

export async function getTopSymbols(n: number): Promise<string[]> {
  const res = await httpGet<TickerResponse>(
    `${BINGX_API}/openApi/swap/v2/quote/ticker`,
    WEIGHT_TICKER
  );
  if (!res || res.code !== 0 || !res.data) return [];
  const usdt = res.data
    .filter((d) => d.symbol?.endsWith("-USDT") && /^[\x00-\x7F]*$/.test(d.symbol))
    .sort((a, b) => parseFloat(String(b.volume || 0)) - parseFloat(String(a.volume || 0)));
  return usdt.slice(0, n).map((d) => d.symbol);
}

// ── Klines ────────────────────────────────────────────────────────────────────
interface KlineItem {
  time: number | string;
  close: number | string;
}

interface KlineResponse {
  code: number;
  data: KlineItem[];
}

export async function getCloses(symbol: string, interval: string, limit = 200): Promise<number[]> {
  const encoded = encodeURIComponent(symbol);
  const res = await httpGet<KlineResponse>(
    `${BINGX_API}/openApi/swap/v3/quote/klines?symbol=${encoded}&interval=${interval}&limit=${limit}`,
    WEIGHT_KLINES
  );
  if (!res || res.code !== 0 || !res.data) return [];

  const raw = [...res.data].reverse(); // oldest → newest
  const nowMs = Date.now();
  const closes: number[] = [];

  for (const k of raw) {
    try {
      const closeTime = parseInt(String(k.time));
      if (closeTime > nowMs) continue;
      const c = parseFloat(String(k.close));
      if (!isNaN(c)) closes.push(c);
    } catch {
      continue;
    }
  }
  return closes;
}
