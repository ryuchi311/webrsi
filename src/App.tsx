import { useState, useCallback, useEffect } from "react";
import { useScanLoop } from "./hooks/useScanLoop";
import { AlertFeed } from "./components/AlertFeed";
import { PairTable } from "./components/PairTable";
import { ScanProgress } from "./components/ScanProgress";
import { ConfigPanel } from "./components/ConfigPanel";
import { DEFAULT_CONFIG, DEFAULT_TELEGRAM_SETTINGS } from "./types";
import type { ScanConfig, TelegramDestination, TelegramSettings } from "./types";
import { startTelegramCommandListener } from "./api/telegram";

const SCAN_CONFIG_STORAGE_KEY = "webrsi.scanConfig";
const TELEGRAM_STORAGE_KEY = "webrsi.telegramSettings";
const SETTINGS_API = "http://127.0.0.1:8788/settings";

type PersistedSettings = {
  scanConfig: ScanConfig;
  telegramSettings: TelegramSettings;
};

function normalizeScanConfig(raw: Partial<ScanConfig>): ScanConfig {
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    tfFast: typeof raw.tfFast === "string" ? raw.tfFast : DEFAULT_CONFIG.tfFast,
    tfSlow: typeof raw.tfSlow === "string" ? raw.tfSlow : DEFAULT_CONFIG.tfSlow,
    tfBig: typeof raw.tfBig === "string" ? raw.tfBig : DEFAULT_CONFIG.tfBig,
    rsiPeriod: typeof raw.rsiPeriod === "number" ? raw.rsiPeriod : DEFAULT_CONFIG.rsiPeriod,
    overbought: typeof raw.overbought === "number" ? raw.overbought : DEFAULT_CONFIG.overbought,
    oversold: typeof raw.oversold === "number" ? raw.oversold : DEFAULT_CONFIG.oversold,
    extremeOb: typeof raw.extremeOb === "number" ? raw.extremeOb : DEFAULT_CONFIG.extremeOb,
    extremeOs: typeof raw.extremeOs === "number" ? raw.extremeOs : DEFAULT_CONFIG.extremeOs,
    resetFromOb: typeof raw.resetFromOb === "number" ? raw.resetFromOb : DEFAULT_CONFIG.resetFromOb,
    resetFromOs: typeof raw.resetFromOs === "number" ? raw.resetFromOs : DEFAULT_CONFIG.resetFromOs,
    resetFromExtremeOb:
      typeof raw.resetFromExtremeOb === "number"
        ? raw.resetFromExtremeOb
        : DEFAULT_CONFIG.resetFromExtremeOb,
    resetFromExtremeOs:
      typeof raw.resetFromExtremeOs === "number"
        ? raw.resetFromExtremeOs
        : DEFAULT_CONFIG.resetFromExtremeOs,
    topN: typeof raw.topN === "number" ? raw.topN : DEFAULT_CONFIG.topN,
    pollIntervalS:
      typeof raw.pollIntervalS === "number" ? raw.pollIntervalS : DEFAULT_CONFIG.pollIntervalS,
  };
}

function normalizeTelegramDestination(
  raw: Partial<TelegramDestination> | undefined
): TelegramDestination {
  return {
    enabled: typeof raw?.enabled === "boolean" ? raw.enabled : true,
    chatId: typeof raw?.chatId === "string" ? raw.chatId : "",
    topicThreadId: typeof raw?.topicThreadId === "string" ? raw.topicThreadId : "",
  };
}

function normalizeTelegramSettings(
  raw: Partial<TelegramSettings> & {
    chatId?: unknown;
    topicThreadId?: unknown;
    destinations?: unknown;
  }
): TelegramSettings {
  const destinations =
    Array.isArray(raw.destinations) && raw.destinations.length > 0
      ? raw.destinations.map((entry) =>
          normalizeTelegramDestination(entry as Partial<TelegramDestination>)
        )
      : [
          normalizeTelegramDestination({
            enabled: typeof raw.enabled === "boolean" ? raw.enabled : true,
            chatId: typeof raw.chatId === "string" ? raw.chatId : "",
            topicThreadId: typeof raw.topicThreadId === "string" ? raw.topicThreadId : "",
          }),
        ];

  return {
    ...DEFAULT_TELEGRAM_SETTINGS,
    ...raw,
    enabled: Boolean(raw.enabled),
    botToken: typeof raw.botToken === "string" ? raw.botToken : "",
    destinations,
    messageMode: raw.messageMode === "custom" ? "custom" : "default",
    customMessage:
      typeof raw.customMessage === "string"
        ? raw.customMessage
        : DEFAULT_TELEGRAM_SETTINGS.customMessage,
  };
}

function loadScanConfig(): ScanConfig {
  const raw = localStorage.getItem(SCAN_CONFIG_STORAGE_KEY);
  if (!raw) return DEFAULT_CONFIG;
  try {
    return normalizeScanConfig(JSON.parse(raw) as Partial<ScanConfig>);
  } catch (error) {
    console.warn("Failed to load scan config:", error);
    return DEFAULT_CONFIG;
  }
}

function loadTelegramSettings(): TelegramSettings {
  const raw = localStorage.getItem(TELEGRAM_STORAGE_KEY);
  if (!raw) return DEFAULT_TELEGRAM_SETTINGS;
  try {
    return normalizeTelegramSettings(JSON.parse(raw) as Partial<TelegramSettings>);
  } catch (error) {
    console.warn("Failed to load Telegram settings:", error);
    return DEFAULT_TELEGRAM_SETTINGS;
  }
}

async function loadPersistedSettings(): Promise<PersistedSettings | null> {
  const response = await fetch(SETTINGS_API, { cache: "no-store" });
  if (!response.ok) return null;
  const data = (await response.json()) as Partial<PersistedSettings>;
  return {
    scanConfig: normalizeScanConfig(data.scanConfig ?? {}),
    telegramSettings: normalizeTelegramSettings(data.telegramSettings ?? {}),
  };
}

async function savePersistedSettings(config: ScanConfig, telegram: TelegramSettings): Promise<void> {
  const response = await fetch(SETTINGS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scanConfig: config, telegramSettings: telegram }),
  });
  if (!response.ok) {
    throw new Error(`Failed to save settings (${response.status})`);
  }
}

export default function App() {
  const [config, setConfig] = useState<ScanConfig>(loadScanConfig);
  const [showConfig, setShowConfig] = useState(false);
  const [telegram, setTelegram] = useState<TelegramSettings>(loadTelegramSettings);
  const [settingsReady, setSettingsReady] = useState(false);

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
    void (async () => {
      try {
        const persisted = await loadPersistedSettings();
        if (persisted) {
          setConfig(persisted.scanConfig);
          setTelegram(persisted.telegramSettings);
        }
      } catch (error) {
        console.warn("Failed to load persisted settings file:", error);
      } finally {
        setSettingsReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem(SCAN_CONFIG_STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem(TELEGRAM_STORAGE_KEY, JSON.stringify(telegram));
  }, [telegram]);

  useEffect(() => {
    if (!settingsReady) return;
    void savePersistedSettings(config, telegram).catch((error) => {
      console.warn("Failed to sync settings file:", error);
    });
  }, [config, telegram, settingsReady]);

  useEffect(() => {
    const stopTelegramCommands = startTelegramCommandListener(telegram);
    return stopTelegramCommands;
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