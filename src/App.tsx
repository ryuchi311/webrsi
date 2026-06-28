import { useState, useCallback, useEffect } from "react";
import { useScanLoop } from "./hooks/useScanLoop";
import { AlertFeed } from "./components/AlertFeed";
import { PairTable } from "./components/PairTable";
import { ScanProgress } from "./components/ScanProgress";
import { ConfigPanel } from "./components/ConfigPanel";
import { DEFAULT_CONFIG, DEFAULT_TELEGRAM_SETTINGS } from "./types";
import type { ScanConfig, TelegramSettings } from "./types";

const SCAN_CONFIG_STORAGE_KEY = "webrsi.scanConfig";
const TELEGRAM_STORAGE_KEY = "webrsi.telegramSettings";

function loadScanConfig(): ScanConfig {
  const raw = localStorage.getItem(SCAN_CONFIG_STORAGE_KEY);
  if (!raw) return DEFAULT_CONFIG;

  try {
    const parsed = JSON.parse(raw) as Partial<ScanConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      tfFast: typeof parsed.tfFast === "string" ? parsed.tfFast : DEFAULT_CONFIG.tfFast,
      tfSlow: typeof parsed.tfSlow === "string" ? parsed.tfSlow : DEFAULT_CONFIG.tfSlow,
      tfBig: typeof parsed.tfBig === "string" ? parsed.tfBig : DEFAULT_CONFIG.tfBig,
      rsiPeriod:
        typeof parsed.rsiPeriod === "number" ? parsed.rsiPeriod : DEFAULT_CONFIG.rsiPeriod,
      overbought:
        typeof parsed.overbought === "number" ? parsed.overbought : DEFAULT_CONFIG.overbought,
      oversold:
        typeof parsed.oversold === "number" ? parsed.oversold : DEFAULT_CONFIG.oversold,
      extremeOb:
        typeof parsed.extremeOb === "number" ? parsed.extremeOb : DEFAULT_CONFIG.extremeOb,
      extremeOs:
        typeof parsed.extremeOs === "number" ? parsed.extremeOs : DEFAULT_CONFIG.extremeOs,
      resetFromOb:
        typeof parsed.resetFromOb === "number" ? parsed.resetFromOb : DEFAULT_CONFIG.resetFromOb,
      resetFromOs:
        typeof parsed.resetFromOs === "number" ? parsed.resetFromOs : DEFAULT_CONFIG.resetFromOs,
      resetFromExtremeOb:
        typeof parsed.resetFromExtremeOb === "number"
          ? parsed.resetFromExtremeOb
          : DEFAULT_CONFIG.resetFromExtremeOb,
      resetFromExtremeOs:
        typeof parsed.resetFromExtremeOs === "number"
          ? parsed.resetFromExtremeOs
          : DEFAULT_CONFIG.resetFromExtremeOs,
      topN: typeof parsed.topN === "number" ? parsed.topN : DEFAULT_CONFIG.topN,
      pollIntervalS:
        typeof parsed.pollIntervalS === "number"
          ? parsed.pollIntervalS
          : DEFAULT_CONFIG.pollIntervalS,
    };
  } catch (error) {
    console.warn("Failed to load scan config:", error);
    return DEFAULT_CONFIG;
  }
}

function loadTelegramSettings(): TelegramSettings {
  const raw = localStorage.getItem(TELEGRAM_STORAGE_KEY);
  if (!raw) return DEFAULT_TELEGRAM_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as Partial<TelegramSettings>;
    return {
      ...DEFAULT_TELEGRAM_SETTINGS,
      ...parsed,
      enabled: Boolean(parsed.enabled),
      botToken: typeof parsed.botToken === "string" ? parsed.botToken : "",
      chatId: typeof parsed.chatId === "string" ? parsed.chatId : "",
      topicThreadId:
        typeof parsed.topicThreadId === "string" ? parsed.topicThreadId : "",
      messageMode:
        parsed.messageMode === "custom" ? "custom" : "default",
      customMessage:
        typeof parsed.customMessage === "string"
          ? parsed.customMessage
          : DEFAULT_TELEGRAM_SETTINGS.customMessage,
    };
  } catch (error) {
    console.warn("Failed to load Telegram settings:", error);
    return DEFAULT_TELEGRAM_SETTINGS;
  }
}

export default function App() {
  const [config, setConfig] = useState<ScanConfig>(loadScanConfig);
  const [showConfig, setShowConfig] = useState(false);
  const [telegram, setTelegram] = useState<TelegramSettings>(loadTelegramSettings);

  const { alerts, pairRSIMap, scanState, start, stop, clearAlerts } =
    useScanLoop(config, telegram);

  const handleConfigChange = useCallback((c: ScanConfig) => {
    setConfig(c);
  }, []);

  const handleQuickStart = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    setShowConfig(false);
    void start(DEFAULT_CONFIG);
  }, [start]);

  useEffect(() => {
    localStorage.setItem(SCAN_CONFIG_STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem(TELEGRAM_STORAGE_KEY, JSON.stringify(telegram));
  }, [telegram]);

  const toggleScan = () => {
    if (scanState.running) stop();
    else start();
  };

  const obCount = alerts.filter(
    (a) => a.zone === "OB" || a.zone === "XOB"
  ).length;
  const osCount = alerts.filter(
    (a) => a.zone === "OS" || a.zone === "XOS"
  ).length;

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <div className="header-logo">
            <span className="logo-icon">📡</span>
            RSI Scanner
            <span className="logo-exchange">BingX</span>
          </div>
          <div className="header-subtitle">
            Live momentum monitor built for fast reads and sharp entries.
          </div>
        </div>

        <div className="header-badges">
          <span className="badge badge-cyan">
            {config.tfFast} + {config.tfSlow}
          </span>
          <span className="badge badge-purple">4hrs</span>
          <span className="badge badge-purple">RSI {config.rsiPeriod}</span>
          <span className="badge badge-red">OB &gt; {config.overbought}</span>
          <span className="badge badge-green">OS &lt; {config.oversold}</span>
          <span className="badge badge-orange">XOB &gt; {config.extremeOb}</span>
          <span className="badge badge-blue">TOP {config.topN}</span>
          <span className="badge badge-purple">⏱ {config.pollIntervalS}s</span>
        </div>

        <div className="header-actions">
          {scanState.scanCount > 0 && (
            <div className="header-metrics">
              <span className="metric metric-ob">🔴 {obCount}</span>
              <span className="metric metric-os">🟢 {osCount}</span>
              <span className="metric metric-scan">#{scanState.scanCount}</span>
            </div>
          )}
          <button
            id="scan-toggle-btn"
            className={`btn ${scanState.running ? "btn-stop" : "btn-start"}`}
            onClick={toggleScan}
          >
            {scanState.running ? "⏹ Stop" : "▶ Start Scan"}
          </button>
        </div>
      </header>

      <ScanProgress scanState={scanState} />

      <section className="quick-launch">
        <div>
          <div className="quick-launch-title">Quick start</div>
          <div className="quick-launch-copy">
            Launch with safe defaults, then open Advanced only if you want to tune it.
          </div>
        </div>
        <button
          className="btn btn-start btn-launch"
          onClick={handleQuickStart}
          disabled={scanState.running}
        >
          Start now
        </button>
      </section>

      <aside className="sidebar">
        <AlertFeed
          alerts={alerts}
          onClear={clearAlerts}
          tfFast={config.tfFast}
          tfSlow={config.tfSlow}
        />

        <div
          className="config-toggle"
          onClick={() => setShowConfig((s) => !s)}
          id="config-toggle"
        >
          <span>{showConfig ? "▲" : "▼"}</span>
          <span>Advanced settings</span>
        </div>

        {showConfig && (
          <div className="config-area">
            <ConfigPanel
              config={config}
              onChange={handleConfigChange}
              disabled={scanState.running}
              telegram={telegram}
              onTelegramChange={setTelegram}
            />
          </div>
        )}
      </aside>

      <main className="main">
        <PairTable
          pairRSIMap={pairRSIMap}
          tfFast={config.tfFast}
          tfSlow={config.tfSlow}
        />
      </main>
    </div>
  );
}