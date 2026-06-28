import { useEffect, useState } from "react";
import type { Alert, AlertZone } from "../types";

interface AlertFeedProps {
  alerts: Alert[];
  onClear: () => void;
  tfFast: string;
  tfSlow: string;
}

const ZONE_SHORT: Record<AlertZone, string> = {
  OB: "OB",
  XOB: "XOB",
  OS: "OS",
  XOS: "XOS",
};

function rsiColor(rsi: number | null): string {
  if (rsi === null) return "#8892a4";
  if (rsi > 80) return "#f87171";
  if (rsi > 70) return "#fb923c";
  if (rsi < 20) return "#4ade80";
  if (rsi < 30) return "#86efac";
  return "#a8b4c8";
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getZoneSummary(zone: AlertZone, tfFast: string, tfSlow: string): string {
  if (zone === "OB") return `Both ${tfFast} & ${tfSlow} RSI > 80 — extended up move.`;
  if (zone === "XOB") return `Both ${tfFast} & ${tfSlow} RSI > 90 — extended up move.`;
  if (zone === "OS") return `Both ${tfFast} & ${tfSlow} RSI < 20 — extended down move.`;
  return `Both ${tfFast} & ${tfSlow} RSI < 10 — extended down move.`;
}

export function AlertFeed({ alerts, onClear, tfFast, tfSlow }: AlertFeedProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">
          Alert Feed <span className="alert-feed-clock">{fmtTime(now)}</span>
        </span>
        <div className="alert-feed-actions">
          {alerts.length > 0 && (
            <span className="alert-count-badge">{alerts.length}</span>
          )}
          {alerts.length > 0 && (
            <button
              className="btn btn-ghost"
              style={{ padding: "3px 10px", fontSize: 11 }}
              onClick={onClear}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="alert-list">
        {alerts.length === 0 ? (
          <div className="alert-empty">
            <span className="alert-empty-icon">📡</span>
            <span>No alerts yet.</span>
            <span className="alert-empty-copy">
              Alerts fire when both
              <br />
              {tfFast} &amp; {tfSlow} RSI agree.
            </span>
          </div>
        ) : (
          alerts.map((a) => {
            const short = a.symbol.replace("-USDT", "");
            const summary = getZoneSummary(a.zone, tfFast, tfSlow);

            return (
              <div key={a.id} className={`alert-card ${a.zone}`}>
                <div className="alert-card-header">
                  <div className="alert-card-title">
                    <a
                      className="alert-symbol alert-symbol-link"
                      href={`https://www.tradingview.com/chart/?symbol=BINGX:${encodeURIComponent(a.symbol.replace("-", ""))}.P`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open ${a.symbol} on TradingView`}
                    >
                      {short}
                    </a>
                    <span className={`alert-zone-pill zone-${a.zone}`}>
                      {ZONE_SHORT[a.zone]}
                    </span>
                  </div>
                  <span className="alert-card-time">{fmtTime(a.timestamp)}</span>
                </div>

                <div className="alert-card-values">
                  <span className="alert-rsi-value">
                    <span className="alert-rsi-label">{tfFast}</span>
                    <span className="alert-rsi-number" style={{ color: rsiColor(a.rsiFast) }}>
                      {a.rsiFast.toFixed(1)}
                    </span>
                  </span>
                  <span className="alert-rsi-value">
                    <span className="alert-rsi-label">{tfSlow}</span>
                    <span className="alert-rsi-number" style={{ color: rsiColor(a.rsiSlow) }}>
                      {a.rsiSlow.toFixed(1)}
                    </span>
                  </span>
                  <span className="alert-rsi-value">
                    <span className="alert-rsi-label">4hrs</span>
                    <span className="alert-rsi-number" style={{ color: rsiColor(a.rsiBig) }}>
                      {a.rsiBig.toFixed(1)}
                    </span>
                  </span>
                </div>

                <div className="alert-card-summary">{summary}</div>
              </div>
            );
          })
        )}
      </div>

      <div className="alert-hint">
        <span className="hint-item">
          <span className="hint-dot" style={{ background: "#ef4444" }} />
          OB &gt;80
        </span>
        <span className="hint-item">
          <span className="hint-dot" style={{ background: "#f97316" }} />
          XOB &gt;90
        </span>
        <span className="hint-item">
          <span className="hint-dot" style={{ background: "#22c55e" }} />
          OS &lt;20
        </span>
        <span className="hint-item">
          <span className="hint-dot" style={{ background: "#14b8a6" }} />
          XOS &lt;10
        </span>
      </div>
    </>
  );
}