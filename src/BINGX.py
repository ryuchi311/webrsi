#!/usr/bin/env python3
"""
RSI Scanner — Multi-Timeframe (5m + 15m Confirmation) [BingX Edition - 500 Pairs]
====================================================================

Scans the top USDT perpetual pairs on BingX and alerts ONLY
when a token's RSI is extreme on BOTH the 5-minute AND 15-minute
timeframe at the same time:

  • BOTH 5m RSI > 80 AND 15m RSI > 80   → OVERBOUGHT alert
  • BOTH 5m RSI < 20 AND 15m RSI < 20   → OVERSOLD alert

Console alerts + sound. No API key needed (public market data).

Run:  python final.py
Stop: Ctrl+C
"""

import json
import time
import sys
import platform
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime

# ════════════════════════════════════════════════════════════════
# CONFIG
# ════════════════════════════════════════════════════════════════
TF_FAST         = "5m"      # fast timeframe
TF_SLOW         = "15m"     # slow timeframe — must confirm the fast one
RSI_PERIOD      = 14        # standard RSI lookback
OVERBOUGHT      = 80.0      # tier-1: both TFs above this → alert
OVERSOLD        = 20.0      # tier-1: both TFs below this → alert
# ── Tier-2 (extreme) thresholds ──
EXTREME_OB      = 90.0      # tier-2: both TFs above this → escalation alert
EXTREME_OS      = 10.0      # tier-2: both TFs below this → escalation alert
# ── Hysteresis reset levels ──
RESET_FROM_OB   = 70.0      # tier-1 OB re-arms after 5m RSI drops to/below this
RESET_FROM_OS   = 30.0      # tier-1 OS re-arms after 5m RSI rises to/above this
RESET_FROM_EXTREME_OB = 80.0  # tier-2 OB re-arms after 5m RSI drops to/below this
RESET_FROM_EXTREME_OS = 20.0  # tier-2 OS re-arms after 5m RSI rises to/above this

TOP_N           = 500       # Scaled up to monitor top 500 pairs by volume
POLL_INTERVAL_S = 100       # Target interval changed to 100 seconds per scan cycle.
ALERT_BEEPS     = 3

# Official BingX API endpoint
BINGX_API = "https://open-api.bingx.com"


# ════════════════════════════════════════════════════════════════
# RATE LIMITER — weight budgeting
# ════════════════════════════════════════════════════════════════
class RateLimiter:
    def __init__(self, max_weight_per_min=1500):
        self.max_weight = max_weight_per_min
        self.window_start = time.time()
        self.spent = 0

    def consume(self, weight):
        now = time.time()
        if now - self.window_start >= 60.0:
            self.window_start = now
            self.spent = 0
        if self.spent + weight > self.max_weight:
            sleep_for = 60.0 - (now - self.window_start)
            if sleep_for > 0:
                time.sleep(sleep_for + 0.5)
            self.window_start = time.time()
            self.spent = 0
        self.spent += weight


# Global limiter instance for BingX pacing
_rate = RateLimiter(max_weight_per_min=1200)
WEIGHT_KLINES = 5
WEIGHT_TICKER = 40

# Pacing slightly adjusted to smoothly cycle requests without API threshold hits
PER_REQUEST_SLEEP_S = 0.22


# ════════════════════════════════════════════════════════════════
# SOUND
# ════════════════════════════════════════════════════════════════
def play_alert():
    try:
        if platform.system() == "Windows":
            import winsound
            for freq in (880, 1100, 1320)[:max(1, ALERT_BEEPS)]:
                winsound.Beep(freq, 180)
        else:
            for _ in range(max(1, ALERT_BEEPS)):
                sys.stdout.write("\a"); sys.stdout.flush()
                time.sleep(0.25)
    except Exception:
        try:
            sys.stdout.write("\a"); sys.stdout.flush()
        except Exception:
            pass


# ════════════════════════════════════════════════════════════════
# BINGX API IMPLEMENTATION
# ════════════════════════════════════════════════════════════════
def _http_get(url, weight=WEIGHT_KLINES):
    """GET a URL, return parsed JSON payload, or None on error."""
    for attempt in range(3):
        _rate.consume(weight)
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "rsi-scanner-mtf/1.0",
                "Accept": "application/json"
            })
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            time.sleep(PER_REQUEST_SLEEP_S)
            return data
        except urllib.error.HTTPError as e:
            if e.code == 429:
                retry_after = e.headers.get("Retry-After")
                delay = int(retry_after) + 1 if (retry_after and str(retry_after).isdigit()) else 10 * (2 ** attempt)
                print(f"  ⚠️  429 rate limited — backing off {delay}s (attempt {attempt + 1}/3)…")
                time.sleep(delay)
                _rate.window_start = time.time()
                _rate.spent = 0
                continue
            else:
                print(f"  ⚠️  HTTP error: {e}")
                return None
        except (urllib.error.URLError, json.JSONDecodeError, TimeoutError, ConnectionError) as e:
            print(f"  ⚠️  Network error: {e} — retrying…")
            time.sleep(3)
            continue
    print("  ⚠️  Giving up on request after 3 attempts.")
    return None


def get_top_symbols(n=TOP_N):
    """Fetches USDT perpetual symbols sorted by 24h volume from BingX."""
    url = f"{BINGX_API}/openApi/swap/v2/quote/ticker"
    res = _http_get(url, weight=WEIGHT_TICKER)
    if not res or res.get("code") != 0 or "data" not in res:
        return []
    
    data = res["data"]
    usdt = []
    for d in data:
        sym = d.get("symbol", "")
        if not sym.endswith("-USDT"):
            continue
        if not sym.isascii():
            continue
        usdt.append(d)
        
    usdt.sort(key=lambda d: float(d.get("volume", 0) or 0), reverse=True)
    return [d["symbol"] for d in usdt[:n]]


def get_closes(symbol, interval, limit=200):
    """Fetches recent closed candle close-prices from BingX."""
    if not symbol.isascii():
        return []
    safe_symbol = urllib.parse.quote(symbol, safe="")
    url = f"{BINGX_API}/openApi/swap/v3/quote/klines?symbol={safe_symbol}&interval={interval}&limit={limit}"
    
    res = _http_get(url, weight=WEIGHT_KLINES)
    if not res or res.get("code") != 0 or "data" not in res:
        return []
    
    raw = res["data"]
    
    # CRITICAL FIX FOR BINGX: Reverse the raw array so index elements process 
    # from oldest to newest. This matches the mathematical expectations of Wilder's RSI loop.
    raw.reverse()
    
    now_ms = int(time.time() * 1000)
    closes = []
    
    for k in raw:
        try:
            close_time = int(k.get("time", 0))
            if close_time > now_ms:
                continue  
            closes.append(float(k.get("close", 0)))
        except (TypeError, ValueError, KeyError):
            continue
    return closes


# ════════════════════════════════════════════════════════════════
# RSI CALCULATION (Wilder's)
# ════════════════════════════════════════════════════════════════
def compute_rsi(closes, period=RSI_PERIOD):
    if len(closes) < period + 1:
        return None
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains  = [d if d > 0 else 0.0 for d in deltas]
    losses = [-d if d < 0 else 0.0 for d in deltas]
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


# ════════════════════════════════════════════════════════════════
# STATE & CLASSIFICATION
# ════════════════════════════════════════════════════════════════
armed_ob = {}
armed_os = {}
armed_xob = {}
armed_xos = {}


def classify_mtf(rsi_fast, rsi_slow):
    if rsi_fast is None or rsi_slow is None:
        return "neutral"
    if rsi_fast > OVERBOUGHT and rsi_slow > OVERBOUGHT:
        return "OB"
    if rsi_fast < OVERSOLD and rsi_slow < OVERSOLD:
        return "OS"
    return "neutral"


# ════════════════════════════════════════════════════════════════
# SCAN SYSTEM
# ════════════════════════════════════════════════════════════════
def scan(symbols):
    alerts = []
    for sym in symbols:
        closes_fast = get_closes(sym, TF_FAST)
        closes_slow = get_closes(sym, TF_SLOW)

        rsi_fast = compute_rsi(closes_fast)
        rsi_slow = compute_rsi(closes_slow)
        if rsi_fast is None or rsi_slow is None:
            continue

        zone = classify_mtf(rsi_fast, rsi_slow)

        if sym not in armed_ob:
            armed_ob[sym] = True
            armed_os[sym] = True
            armed_xob[sym] = True
            armed_xos[sym] = True

        # ── OVERBOUGHT tier-1 ──
        if rsi_fast <= RESET_FROM_OB:
            armed_ob[sym] = True
        if zone == "OB" and armed_ob[sym]:
            armed_ob[sym] = False
            alerts.append((sym, rsi_fast, rsi_slow, "OB"))

        # ── OVERBOUGHT tier-2 ──
        if rsi_fast <= RESET_FROM_EXTREME_OB:
            armed_xob[sym] = True
        if rsi_fast > EXTREME_OB and rsi_slow > EXTREME_OB and armed_xob[sym]:
            armed_xob[sym] = False
            alerts.append((sym, rsi_fast, rsi_slow, "XOB"))

        # ── OVERSOLD tier-1 ──
        if rsi_fast >= RESET_FROM_OS:
            armed_os[sym] = True
        if zone == "OS" and armed_os[sym]:
            armed_os[sym] = False
            alerts.append((sym, rsi_fast, rsi_slow, "OS"))

        # ── OVERSOLD tier-2 ──
        if rsi_fast >= RESET_FROM_EXTREME_OS:
            armed_xos[sym] = True
        if rsi_fast < EXTREME_OS and rsi_slow < EXTREME_OS and armed_xos[sym]:
            armed_xos[sym] = False
            alerts.append((sym, rsi_fast, rsi_slow, "XOS"))

    return alerts


def print_alert(sym, rsi_fast, rsi_slow, zone):
    ts = datetime.now().strftime("%H:%M:%S")
    if zone == "OB":
        tag = "\033[91m🔴 OVERBOUGHT\033[0m"
        hint = f"Both {TF_FAST} & {TF_SLOW} RSI > {OVERBOUGHT:.0f} — extended up move."
    elif zone == "XOB":
        tag = "\033[1;91m🔥 EXTREME OVERBOUGHT\033[0m"
        hint = f"Both {TF_FAST} & {TF_SLOW} RSI > {EXTREME_OB:.0f} — extended into extreme thresholds."
    elif zone == "OS":
        tag = "\033[92m🟢 OVERSOLD\033[0m"
        hint = f"Both {TF_FAST} & {TF_SLOW} RSI < {OVERSOLD:.0f} — extended down move."
    else:
        tag = "\033[1;92m🔥 EXTREME OVERSOLD\033[0m"
        hint = f"Both {TF_FAST} & {TF_SLOW} RSI < {EXTREME_OS:.0f} — deeply compressed down move."
        
    print(f"  [{ts}]  {tag}  \033[1m{sym:14s}\033[0m")
    print(f"           {TF_FAST} RSI = \033[1m{rsi_fast:.1f}\033[0m   {TF_SLOW} RSI = \033[1m{rsi_slow:.1f}\033[0m")
    print(f"           \033[90m{hint}\033[0m")


# ════════════════════════════════════════════════════════════════
# MAIN MAIN LOOP
# ════════════════════════════════════════════════════════════════
def main():
    print("═" * 62)
    print(f"  RSI SCANNER — BingX Multi-Timeframe ({TF_FAST} + {TF_SLOW})")
    print(f"  Alert ONLY when BOTH timeframes agree:")
    print(f"    • {TF_FAST} & {TF_SLOW} RSI > {OVERBOUGHT:.0f}  → overbought")
    print(f"    • {TF_FAST} & {TF_SLOW} RSI < {OVERSOLD:.0f}  → oversold")
    print(f"  Top {TOP_N} pairs. Scan interval: {POLL_INTERVAL_S}s. Ctrl+C to stop.")
    print("═" * 62)

    print("  Fetching top symbols by volume from BingX…")
    symbols = get_top_symbols(TOP_N)
    if not symbols:
        print("\033[91m  Could not fetch symbol list. Check network connectivity.\033[0m")
        return
    print(f"  Monitoring {len(symbols)} pairs.\n")

    scan_count = 0
    while True:
        scan_count += 1
        t0 = time.time()
        try:
            alerts = scan(symbols)
        except Exception as e:
            import traceback
            print(f"\033[91m  ⚠️  Scan #{scan_count} error: {e}\033[0m")
            traceback.print_exc()
            print("  Continuing — next scan in 30s…")
            time.sleep(30)
            continue

        if alerts:
            play_alert()
            for sym, rf, rs, zone in alerts:
                print_alert(sym, rf, rs, zone)

        elapsed = time.time() - t0
        wait = max(5.0, POLL_INTERVAL_S - elapsed)
        time.sleep(wait)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n  Stopped. Bye.")
    except Exception as e:
        import traceback
        print("\n" + "=" * 62)
        print("  FATAL ERROR — the script crashed:")
        print("=" * 62)
        traceback.print_exc()
        print("=" * 62)
        try:
            input("\n  Press Enter to close…")
        except Exception:
            pass