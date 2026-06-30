// ─── Shared types ────────────────────────────────────────────────────────────

export type AlertZone = "OB" | "XOB" | "OS" | "XOS";

export interface Alert {
  id: string;
  symbol: string;
  rsiFast: number;
  rsiSlow: number;
  rsiBig: number;
  zone: AlertZone;
  timestamp: Date;
}

export interface PairRSI {
  symbol: string;
  rsiFast: number | null;
  rsiSlow: number | null;
  rsiBig: number | null;
  zone: "OB" | "XOB" | "OS" | "XOS" | "neutral" | "scanning";
  lastUpdated: Date | null;
}

export interface ScanConfig {
  tfFast: string;
  tfSlow: string;
  tfBig: string;
  rsiPeriod: number;
  overbought: number;
  oversold: number;
  extremeOb: number;
  extremeOs: number;
  resetFromOb: number;
  resetFromOs: number;
  resetFromExtremeOb: number;
  resetFromExtremeOs: number;
  topN: number;
  pollIntervalS: number;
}

export type TelegramMessageMode = "default" | "custom";

export interface TelegramDestination {
  enabled: boolean;
  chatId: string;
  topicThreadId: string;
}

export interface TelegramSettings {
  enabled: boolean;
  botToken: string;
  destinations: TelegramDestination[];
  messageMode: TelegramMessageMode;
  customMessage: string;
}

export const DEFAULT_CONFIG: ScanConfig = {
  tfFast: "5m",
  tfSlow: "15m",
  tfBig: "4h",
  rsiPeriod: 14,
  overbought: 80,
  oversold: 20,
  extremeOb: 90,
  extremeOs: 10,
  resetFromOb: 70,
  resetFromOs: 30,
  resetFromExtremeOb: 80,
  resetFromExtremeOs: 20,
  topN: 500,
  pollIntervalS: 100,
};

export const DEFAULT_TELEGRAM_SETTINGS: TelegramSettings = {
  enabled: false,
  botToken: "",
  destinations: [
    {
      enabled: true,
      chatId: "",
      topicThreadId: "",
    },
  ],
  messageMode: "default",
  customMessage:
    "🔔 RSI Alert\n\nSymbol: {{symbol}}\nZone: {{zone}}\nFast ({{tfFast}}): {{rsiFast}}\nSlow ({{tfSlow}}): {{rsiSlow}}\n4hrs ({{tfBig}}): {{rsiBig}}\nTime: {{time}}",
};

export interface ScanState {
  running: boolean;
  scanCount: number;
  currentSymbol: string | null;
  currentIndex: number;
  totalSymbols: number;
  phaseLabel: string;
  lastScanDurationS: number | null;
  nextScanInS: number | null;
}