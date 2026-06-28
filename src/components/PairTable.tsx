import { useState, useMemo } from "react";
import type { PairRSI } from "../types";

interface PairTableProps {
  pairRSIMap: Map<string, PairRSI>;
  tfFast: string;
  tfSlow: string;
}

type SortKey = "symbol" | "rsiFast" | "rsiSlow" | "rsiBig" | "zone";
type ZoneFilter = "all" | "OB" | "XOB" | "OS" | "XOS" | "neutral";

function rsiToColor(rsi: number | null): string {
  if (rsi === null) return "#4a5568";
  if (rsi >= 90) return "#f97316";
  if (rsi >= 80) return "#ef4444";
  if (rsi >= 70) return "#f87171";
  if (rsi <= 10) return "#06b6d4";
  if (rsi <= 20) return "#22c55e";
  if (rsi <= 30) return "#4ade80";
  return "#a8b4c8";
}

function rsiBarColor(rsi: number | null): string {
  if (rsi === null) return "#1f2937";
  if (rsi >= 80) return "linear-gradient(90deg, #ef4444, #f97316)";
  if (rsi >= 70) return "linear-gradient(90deg, #b91c1c, #ef4444)";
  if (rsi <= 20) return "linear-gradient(90deg, #16a34a, #22c55e)";
  if (rsi <= 30) return "linear-gradient(90deg, #065f46, #16a34a)";
  return "linear-gradient(90deg, #1e3a5f, #2563eb)";
}

function rsiBarWidth(rsi: number | null): number {
  if (rsi === null) return 0;
  return Math.min(100, Math.max(0, rsi));
}

function zoneSortOrder(zone: PairRSI["zone"]): number {
  return { XOB: 0, OB: 1, XOS: 2, OS: 3, neutral: 4, scanning: 5 }[zone] ?? 5;
}

function getTradingViewUrl(symbol: string): string {
  const tvSymbol = symbol.replace("-", "");
  return `https://www.tradingview.com/chart/?symbol=BINGX:${encodeURIComponent(tvSymbol)}.P`;
}

export function PairTable({ pairRSIMap, tfFast, tfSlow }: PairTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("zone");
  const [sortDesc, setSortDesc] = useState(true);
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>("all");

  const pairs = useMemo(() => {
    let arr = Array.from(pairRSIMap.values());

    if (zoneFilter !== "all") {
      arr = arr.filter((p) => p.zone === zoneFilter);
    }

    if (search.trim()) {
      const q = search.trim().toUpperCase();
      arr = arr.filter((p) => p.symbol.toUpperCase().includes(q));
    }

    arr.sort((a, b) => {
      let diff = 0;
      if (sortKey === "symbol") {
        diff = a.symbol.localeCompare(b.symbol);
      } else if (sortKey === "rsiFast") {
        diff = (a.rsiFast ?? -1) - (b.rsiFast ?? -1);
      } else if (sortKey === "rsiSlow") {
        diff = (a.rsiSlow ?? -1) - (b.rsiSlow ?? -1);
      } else {
        diff = zoneSortOrder(a.zone) - zoneSortOrder(b.zone);
      }
      return sortDesc ? -diff : diff;
    });

    return arr;
  }, [pairRSIMap, search, sortKey, sortDesc, zoneFilter]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const zoneFilters: { label: string; value: ZoneFilter }[] = [
    { label: "All", value: "all" },
    { label: "🔴 OB", value: "OB" },
    { label: "🔥 XOB", value: "XOB" },
    { label: "🟢 OS", value: "OS" },
    { label: "🔥 XOS", value: "XOS" },
  ];

  return (
    <>
      <div className="main-toolbar">
        <a
          className="main-toolbar-title"
          href="https://www.tradingview.com/chart/"
          target="_blank"
          rel="noopener noreferrer"
          title="Open TradingView charts"
        >
          Live RSI Grid • 5m / 15m / 4hrs
        </a>
        <span className="pair-count">{pairs.length} pairs</span>
        <input
          className="search-input"
          placeholder="Search symbol…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="zone-tabs">
          {zoneFilters.map((f) => (
            <button
              key={f.value}
              className={`zone-tab ${zoneFilter === f.value ? `active-${f.value}` : ""}`}
              onClick={() => setZoneFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="sort-group">
          {(["zone", "rsiFast", "rsiSlow", "rsiBig", "symbol"] as SortKey[]).map((k) => (
            <button
              key={k}
              className={`sort-btn ${sortKey === k ? "active" : ""}`}
              onClick={() => handleSort(k)}
            >
              {k === "rsiFast"
                ? tfFast
                : k === "rsiSlow"
                ? tfSlow
                : k === "rsiBig" ? "4hrs" : k.charAt(0).toUpperCase() + k.slice(1)}
              {sortKey === k ? (sortDesc ? " ↓" : " ↑") : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="pair-table-wrap">
        {pairs.length === 0 ? (
          <div className="pair-empty">
            <span className="pair-empty-icon">📊</span>
            <span>
              {pairRSIMap.size === 0
                ? "Start the scanner to see live RSI data."
                : "No pairs match your filter."}
            </span>
          </div>
        ) : (
          <div className="pair-grid">
            {pairs.map((p) => (
              <PairCard key={p.symbol} pair={p} tfFast={tfFast} tfSlow={tfSlow} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function PairCard({
  pair,
  tfFast,
  tfSlow,
}: {
  pair: PairRSI;
  tfFast: string;
  tfSlow: string;
}) {
  const { symbol, rsiFast, rsiSlow, rsiBig, zone, lastUpdated } = pair;
  const shortSym = symbol.replace("-USDT", "");

  return (
    <div className={`pair-card zone-${zone}`}>
      <a
        className="pair-sym"
        href={getTradingViewUrl(symbol)}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open ${symbol} on TradingView`}
      >
        <span>{shortSym}</span>
        <span className="tv-link">🔗</span>
      </a>

      <div className="rsi-row">
        <span className="rsi-label">{tfFast}</span>
        <span className="rsi-value" style={{ color: rsiToColor(rsiFast) }}>
          {rsiFast !== null ? rsiFast.toFixed(1) : "—"}
        </span>
      </div>
      <div className="rsi-bar-wrap">
        <div
          className="rsi-bar-fill"
          style={{
            width: `${rsiBarWidth(rsiFast)}%`,
            background: rsiBarColor(rsiFast),
          }}
        />
      </div>

      <div className="rsi-row">
        <span className="rsi-label">{tfSlow}</span>
        <span className="rsi-value" style={{ color: rsiToColor(rsiSlow) }}>
          {rsiSlow !== null ? rsiSlow.toFixed(1) : "—"}
        </span>
      </div>
      <div className="rsi-bar-wrap">
        <div
          className="rsi-bar-fill"
          style={{
            width: `${rsiBarWidth(rsiSlow)}%`,
            background: rsiBarColor(rsiSlow),
          }}
        />
      </div>

      <div className="rsi-row">
        <span className="rsi-label">4hrs</span>
        <span className="rsi-value" style={{ color: rsiToColor(rsiBig) }}>
          {rsiBig !== null ? rsiBig.toFixed(1) : "—"}
        </span>
      </div>
      <div className="rsi-bar-wrap">
        <div
          className="rsi-bar-fill"
          style={{
            width: `${rsiBarWidth(rsiBig)}%`,
            background: rsiBarColor(rsiBig),
          }}
        />
      </div>

      <div className="pair-card-bottom">
        {zone !== "neutral" && zone !== "scanning" ? (
          <span className={`pair-zone-tag zone-${zone}`}>{zone}</span>
        ) : (
          <span />
        )}
        <span className="pair-updated">
          {lastUpdated
            ? lastUpdated.toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""}
        </span>
      </div>
    </div>
  );
}