import type { Alert, ScanConfig, TelegramSettings } from "../types";

const TELEGRAM_API_BASE = "https://api.telegram.org";

function formatClock(timestamp: Date): string {
  return timestamp.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatAlertTime(timestamp: Date): string {
  return timestamp.toLocaleString("en-US", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatSymbol(symbol: string): string {
  return symbol.replace("-USDT", "/USDT");
}

function getTradingViewUrl(symbol: string): string {
  const tvSymbol = symbol.replace("-", "");
  return `https://www.tradingview.com/chart/?symbol=BINGX:${encodeURIComponent(tvSymbol)}.P`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function zoneMeta(
  zone: Alert["zone"],
  cfg: ScanConfig
): { icon: string; title: string; threshold: number; direction: "<" | ">"; summary: string } {
  switch (zone) {
    case "OB":
      return { icon: "🟥", title: "OVERBOUGHT", threshold: cfg.overbought, direction: ">", summary: "extended up move" };
    case "XOB":
      return { icon: "🟧", title: "EXTREME OVERBOUGHT", threshold: cfg.extremeOb, direction: ">", summary: "extended up move" };
    case "OS":
      return { icon: "🟩", title: "OVERSOLD", threshold: cfg.oversold, direction: "<", summary: "extended down move" };
    case "XOS":
      return { icon: "🟦", title: "EXTREME OVERSOLD", threshold: cfg.extremeOs, direction: "<", summary: "extended down move" };
  }
}

function rsiToneEmoji(value: number): string {
  if (value >= 80) return "🟥";
  if (value >= 70) return "🟧";
  if (value <= 20) return "🟩";
  if (value <= 30) return "🟦";
  return "⚪";
}

function buildDefaultTelegramMessage(alert: Alert, config: ScanConfig): string {
  const meta = zoneMeta(alert.zone, config);
  const symbol = formatSymbol(alert.symbol);
  const trendLine = `Both ${config.tfFast} & ${config.tfSlow} RSI ${meta.direction} ${meta.threshold} — ${meta.summary}`;
  const tvUrl = getTradingViewUrl(alert.symbol);

  return [
    `🔔 <b>RSI Multi-TF Alert</b>`,
    ``,
    `<b>[${formatClock(alert.timestamp)}]</b> ${meta.icon} <b>${meta.title}</b> <code>${escapeHtml(symbol)}</code>`,
    `├ ${rsiToneEmoji(alert.rsiFast)} <b>${escapeHtml(config.tfFast)}</b> RSI = <b>${alert.rsiFast.toFixed(1)}</b>   ${rsiToneEmoji(alert.rsiSlow)} <b>${escapeHtml(config.tfSlow)}</b> RSI = <b>${alert.rsiSlow.toFixed(1)}</b>`,
    `├ 🟪 <b>4hrs</b> RSI = <b>${alert.rsiBig.toFixed(1)}</b>`,
    `└ ${escapeHtml(trendLine)}`,
    ``,
    `🔗 <a href="${tvUrl}">TradingView</a>`,
  ].join("\n");
}

export function buildTelegramMessage(
  alert: Alert,
  config: ScanConfig,
  settings: TelegramSettings
): string {
  if (settings.messageMode === "custom" && settings.customMessage.trim()) {
    const replacements: Record<string, string> = {
      "{{symbol}}": alert.symbol,
      "{{zone}}": alert.zone,
      "{{tfFast}}": config.tfFast,
      "{{tfSlow}}": config.tfSlow,
      "{{tfBig}}": config.tfBig,
      "{{rsiFast}}": alert.rsiFast.toFixed(1),
      "{{rsiSlow}}": alert.rsiSlow.toFixed(1),
      "{{rsiBig}}": alert.rsiBig.toFixed(1),
      "{{time}}": formatAlertTime(alert.timestamp),
    };

    return Object.entries(replacements).reduce(
      (message, [placeholder, value]) => message.split(placeholder).join(value),
      settings.customMessage
    );
  }

  return buildDefaultTelegramMessage(alert, config);
}

export async function sendTelegramMessage(
  alert: Alert,
  config: ScanConfig,
  settings: TelegramSettings
): Promise<void> {
  if (!settings.enabled) return;

  const botToken = settings.botToken.trim();
  const chatId = settings.chatId.trim();

  if (!botToken || !chatId) {
    console.warn("Telegram notification skipped: missing bot token or chat ID.");
    return;
  }

  const params = new URLSearchParams();
  params.set("chat_id", chatId);
  params.set("text", buildTelegramMessage(alert, config, settings));
  params.set("disable_web_page_preview", "true");
  params.set("disable_notification", "false");

  if (settings.messageMode !== "custom" || !settings.customMessage.trim()) {
    params.set("parse_mode", "HTML");
  }

  const topicThreadId = settings.topicThreadId.trim();
  if (topicThreadId) {
    const parsed = Number.parseInt(topicThreadId, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      params.set("message_thread_id", String(parsed));
    } else {
      console.warn(
        "Telegram notification skipped topic thread: message thread ID must be a positive integer."
      );
    }
  }

  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram send failed (${response.status}): ${errorText}`);
  }
}