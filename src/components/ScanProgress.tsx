import type { ScanState } from "../types";

interface ScanProgressProps {
  scanState: ScanState;
}

function fmtDur(s: number | null): string {
  if (s === null) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function fmtSpeed(totalSymbols: number, durationS: number | null): string {
  if (!durationS || totalSymbols <= 0) return "—";
  const speed = totalSymbols / durationS;
  return `${speed.toFixed(speed >= 10 ? 0 : 1)} pairs/s`;
}

export function ScanProgress({ scanState }: ScanProgressProps) {
  const {
    running,
    scanCount,
    currentSymbol,
    currentIndex,
    totalSymbols,
    phaseLabel,
    lastScanDurationS,
    nextScanInS,
  } = scanState;

  const pct =
    totalSymbols > 0 ? Math.round((currentIndex / totalSymbols) * 100) : 0;

  return (
    <div className="progress-area">
      <div className={`pulse-dot ${running ? "" : "idle"}`} />
      <span className="progress-label">
        {phaseLabel}
        {currentSymbol ? ` — ${currentSymbol.replace("-USDT", "")}` : ""}
      </span>

      <div className="progress-bar-wrap">
        <div
          className="progress-bar-fill"
          style={{ width: running ? `${pct}%` : "0%" }}
        />
      </div>

      <span className="progress-right">
        <span className="progress-meta">
          {running && phaseLabel === "Scanning" && totalSymbols > 0
            ? `${currentIndex} / ${totalSymbols} (${pct}%)`
            : phaseLabel === "Waiting" && nextScanInS !== null
            ? `Next scan in ${nextScanInS}s`
            : phaseLabel === "Fetching symbols…"
            ? "Loading pairs…"
            : ""}
        </span>
        {scanCount > 0 && (
          <span className="progress-scan-count">
            #{scanCount}
            {lastScanDurationS !== null ? ` · ${fmtDur(lastScanDurationS)}` : ""}
            {totalSymbols > 0 && lastScanDurationS !== null
              ? ` · ${fmtSpeed(totalSymbols, lastScanDurationS)}`
              : ""}
          </span>
        )}
      </span>
    </div>
  );
}
