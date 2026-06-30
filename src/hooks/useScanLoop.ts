import { useState, useRef, useCallback, useEffect } from "react";
import { getTopSymbols, getCloses } from "../api/bingx";
import { sendTelegramMessage, sendTelegramScanStart } from "../api/telegram";
import { computeRSI } from "../lib/rsi";
import type {
  Alert,
  PairRSI,
  ScanConfig,
  ScanState,
  AlertZone,
  TelegramSettings,
} from "../types";

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function playAlert(beeps = 3) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const freqs = [880, 1100, 1320].slice(0, beeps);
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.18);
      osc.start(ctx.currentTime + i * 0.22);
      osc.stop(ctx.currentTime + i * 0.22 + 0.2);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch {
    // silently fail if AudioContext not available
  }
}

export function useScanLoop(config: ScanConfig, telegram: TelegramSettings) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pairRSIMap, setPairRSIMap] = useState<Map<string, PairRSI>>(new Map());
  const [scanState, setScanState] = useState<ScanState>({
    running: false,
    scanCount: 0,
    currentSymbol: null,
    currentIndex: 0,
    totalSymbols: 0,
    phaseLabel: "Idle",
    lastScanDurationS: null,
    nextScanInS: null,
  });

  const armedOb = useRef<Record<string, boolean>>({});
  const armedOs = useRef<Record<string, boolean>>({});
  const armedXob = useRef<Record<string, boolean>>({});
  const armedXos = useRef<Record<string, boolean>>({});
  const symbolsRef = useRef<string[]>([]);
  const cancelRef = useRef<boolean>(true);
  const configRef = useRef(config);
  const runningRef = useRef(false);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const classifyMtf = (
    rsiFast: number,
    rsiSlow: number,
    cfg: ScanConfig
  ): AlertZone | "neutral" => {
    if (rsiFast > cfg.overbought && rsiSlow > cfg.overbought) return "OB";
    if (rsiFast < cfg.oversold && rsiSlow < cfg.oversold) return "OS";
    return "neutral";
  };

  const runScan = useCallback(async () => {
    const cfg = configRef.current;
    const symbols = symbolsRef.current;
    const newAlerts: Alert[] = [];

    for (let i = 0; i < symbols.length; i++) {
      if (cancelRef.current) return;
      const sym = symbols[i];

      setScanState((s) => ({
        ...s,
        currentSymbol: sym,
        currentIndex: i + 1,
        phaseLabel: "Scanning",
      }));

      const [closesFast, closesSlow, closesBig] = await Promise.all([
        getCloses(sym, cfg.tfFast),
        getCloses(sym, cfg.tfSlow),
        getCloses(sym, cfg.tfBig),
      ]);

      if (cancelRef.current) return;

      const rsiFast = computeRSI(closesFast, cfg.rsiPeriod);
      const rsiSlow = computeRSI(closesSlow, cfg.rsiPeriod);
      const rsiBig = computeRSI(closesBig, cfg.rsiPeriod);
      if (rsiFast === null || rsiSlow === null || rsiBig === null) continue;

      const zone = classifyMtf(rsiFast, rsiSlow, cfg);

      if (!(sym in armedOb.current)) {
        armedOb.current[sym] = true;
        armedOs.current[sym] = true;
        armedXob.current[sym] = true;
        armedXos.current[sym] = true;
      }

      if (rsiFast <= cfg.resetFromOb) armedOb.current[sym] = true;
      if (zone === "OB" && armedOb.current[sym]) {
        armedOb.current[sym] = false;
        newAlerts.push({
          id: `${sym}-OB-${Date.now()}`,
          symbol: sym,
          rsiFast,
          rsiSlow,
          rsiBig,
          zone: "OB",
          timestamp: new Date(),
        });
      }

      if (rsiFast <= cfg.resetFromExtremeOb) armedXob.current[sym] = true;
      if (rsiFast > cfg.extremeOb && rsiSlow > cfg.extremeOb && armedXob.current[sym]) {
        armedXob.current[sym] = false;
        newAlerts.push({
          id: `${sym}-XOB-${Date.now()}`,
          symbol: sym,
          rsiFast,
          rsiSlow,
          rsiBig,
          zone: "XOB",
          timestamp: new Date(),
        });
      }

      if (rsiFast >= cfg.resetFromOs) armedOs.current[sym] = true;
      if (zone === "OS" && armedOs.current[sym]) {
        armedOs.current[sym] = false;
        newAlerts.push({
          id: `${sym}-OS-${Date.now()}`,
          symbol: sym,
          rsiFast,
          rsiSlow,
          rsiBig,
          zone: "OS",
          timestamp: new Date(),
        });
      }

      if (rsiFast >= cfg.resetFromExtremeOs) armedXos.current[sym] = true;
      if (rsiFast < cfg.extremeOs && rsiSlow < cfg.extremeOs && armedXos.current[sym]) {
        armedXos.current[sym] = false;
        newAlerts.push({
          id: `${sym}-XOS-${Date.now()}`,
          symbol: sym,
          rsiFast,
          rsiSlow,
          rsiBig,
          zone: "XOS",
          timestamp: new Date(),
        });
      }

      const pairZone: PairRSI["zone"] =
        rsiFast > cfg.extremeOb && rsiSlow > cfg.extremeOb
          ? "XOB"
          : rsiFast > cfg.overbought && rsiSlow > cfg.overbought
          ? "OB"
          : rsiFast < cfg.extremeOs && rsiSlow < cfg.extremeOs
          ? "XOS"
          : rsiFast < cfg.oversold && rsiSlow < cfg.oversold
          ? "OS"
          : "neutral";

      setPairRSIMap((prev) => {
        const next = new Map(prev);
        next.set(sym, {
          symbol: sym,
          rsiFast,
          rsiSlow,
          rsiBig,
          zone: pairZone,
          lastUpdated: new Date(),
        });
        return next;
      });
    }

    if (newAlerts.length > 0) {
      setAlerts((prev) => [...newAlerts.reverse(), ...prev].slice(0, 200));
      playAlert(3);
      for (const alert of newAlerts) {
        void sendTelegramMessage(alert, cfg, telegram).catch((error) => {
          console.error("Telegram notification error:", error);
        });
      }
    }
  }, [telegram]);

  const start = useCallback(async (launchConfig?: ScanConfig) => {
    if (runningRef.current) return;
    runningRef.current = true;
    cancelRef.current = false;

    if (launchConfig) {
      configRef.current = launchConfig;
    }

    armedOb.current = {};
    armedOs.current = {};
    armedXob.current = {};
    armedXos.current = {};

    setScanState((s) => ({
      ...s,
      running: true,
      phaseLabel: "Fetching symbols…",
      currentIndex: 0,
      scanCount: 0,
    }));

    const cfg = configRef.current;

    void sendTelegramScanStart(cfg, telegram).catch((error) => {
      console.error("Telegram scan-start notification error:", error);
    });

    const symbols = await getTopSymbols(cfg.topN);
    if (cancelRef.current) {
      runningRef.current = false;
      return;
    }

    symbolsRef.current = symbols;
    setScanState((s) => ({
      ...s,
      totalSymbols: symbols.length,
      phaseLabel: "Scanning",
    }));

    let scanCount = 0;

    while (!cancelRef.current) {
      scanCount++;
      const t0 = Date.now();
      setScanState((s) => ({ ...s, scanCount, nextScanInS: null }));

      try {
        await runScan();
      } catch (err) {
        console.error("Scan error:", err);
      }

      if (cancelRef.current) break;

      const elapsed = (Date.now() - t0) / 1000;
      const wait = Math.max(5, configRef.current.pollIntervalS - elapsed);

      setScanState((s) => ({
        ...s,
        currentSymbol: null,
        phaseLabel: "Waiting",
        lastScanDurationS: elapsed,
        nextScanInS: wait,
        scanCount,
      }));

      const waitMs = wait * 1000;
      const step = 1000;
      for (let elapsed2 = 0; elapsed2 < waitMs; elapsed2 += step) {
        if (cancelRef.current) break;
        await sleep(step);
        const remaining = Math.max(0, Math.round((waitMs - elapsed2 - step) / 1000));
        setScanState((s) => ({ ...s, nextScanInS: remaining }));
      }
    }

    runningRef.current = false;
    setScanState((s) => ({
      ...s,
      running: false,
      phaseLabel: "Idle",
      currentSymbol: null,
    }));
  }, [runScan]);

  const stop = useCallback(() => {
    cancelRef.current = true;
    setScanState((s) => ({ ...s, running: false, phaseLabel: "Stopping…" }));
  }, []);

  const clearAlerts = useCallback(() => setAlerts([]), []);

  return { alerts, pairRSIMap, scanState, start, stop, clearAlerts };
}