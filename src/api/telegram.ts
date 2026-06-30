import type { Alert, ScanConfig, TelegramDestination, TelegramSettings } from "../types";

const TELEGRAM_API_BASE = "https://api.telegram.org";
const ENV_TELEGRAM_BOT_TOKEN = (import.meta.env.VITE_TELEGRAM_BOT_TOKEN ?? "").trim();

type TelegramUpdate = {
  update_id: number;
  message?: {
    text?: string;
    chat: { id: number; type: string };
    from?: { id: number };
    message_thread_id?: number;
  };
};

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

function zoneHeaderIcon(zone: Alert["zone"]): string {
  return zone === "OB" || zone === "XOB" ? "⬆" : "⬇";
}

function resolveBotToken(settings: TelegramSettings): string {
  return settings.botToken.trim() || ENV_TELEGRAM_BOT_TOKEN;
}

function buildDefaultTelegramMessage(alert: Alert, config: ScanConfig): string {
  const meta = zoneMeta(alert.zone, config);
  const symbol = formatSymbol(alert.symbol);
  const tvUrl = getTradingViewUrl(alert.symbol);

  return [
    `${zoneHeaderIcon(alert.zone)} <b>${escapeHtml(symbol)}</b> · <b>RSI ${meta.title}</b>`,
    `${rsiToneEmoji(alert.rsiFast)} ${config.tfFast} ${alert.rsiFast.toFixed(1)}  |  ${rsiToneEmoji(alert.rsiSlow)} ${config.tfSlow} ${alert.rsiSlow.toFixed(1)}  |  🟪 ${config.tfBig} ${alert.rsiBig.toFixed(1)}`,
    `<i>${meta.summary.charAt(0).toUpperCase() + meta.summary.slice(1)}</i> · <a href="${tvUrl}">TradingView</a>`,
  ].join("\n");
}

function getEnabledDestinations(settings: TelegramSettings): TelegramDestination[] {
  return settings.destinations.filter((destination) => destination.enabled);
}

function applyDestination(params: URLSearchParams, destination: TelegramDestination): void {
  params.set("chat_id", destination.chatId.trim());

  const topicThreadId = destination.topicThreadId.trim();
  if (!topicThreadId) return;

  const parsed = Number.parseInt(topicThreadId, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    params.set("message_thread_id", String(parsed));
    return;
  }

  throw new Error("Telegram thread ID must be a positive integer.");
}

async function sendTelegramMessageToDestination(
  botToken: string,
  destination: TelegramDestination,
  text: string,
  parseMode?: "HTML"
): Promise<void> {
  const chatId = destination.chatId.trim();
  if (!chatId) {
    console.warn("Telegram notification skipped: missing chat ID for one destination.");
    return;
  }

  const params = new URLSearchParams();
  params.set("chat_id", chatId);
  params.set("text", text);
  params.set("disable_web_page_preview", "true");
  params.set("disable_notification", "false");

  if (parseMode) {
    params.set("parse_mode", parseMode);
  }

  applyDestination(params, destination);
  await sendTelegramPayload(botToken, params);
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

async function sendTelegramPayload(botToken: string, params: URLSearchParams): Promise<void> {
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

async function getTelegramUpdates(
  botToken: string,
  offset?: number,
  timeoutS = 20
): Promise<TelegramUpdate[]> {
  const params = new URLSearchParams();
  params.set("timeout", String(timeoutS));
  params.set("limit", "100");
  if (typeof offset === "number") {
    params.set("offset", String(offset));
  }

  const response = await fetch(
    `${TELEGRAM_API_BASE}/bot${botToken}/getUpdates?${params.toString()}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram getUpdates failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { ok: boolean; result: TelegramUpdate[] };
  return data.ok ? data.result : [];
}

async function sendTelegramCommandReply(
  botToken: string,
  chatId: number,
  text: string,
  messageThreadId?: number
): Promise<void> {
  const params = new URLSearchParams();
  params.set("chat_id", String(chatId));
  params.set("text", text);
  params.set("disable_web_page_preview", "true");
  params.set("parse_mode", "HTML");

  if (typeof messageThreadId === "number" && Number.isFinite(messageThreadId) && messageThreadId > 0) {
    params.set("message_thread_id", String(messageThreadId));
  }

  await sendTelegramPayload(botToken, params);
}

export async function sendTelegramMessage(
  alert: Alert,
  config: ScanConfig,
  settings: TelegramSettings
): Promise<void> {
  if (!settings.enabled) return;

  const botToken = resolveBotToken(settings);

  if (!botToken) {
    console.warn("Telegram notification skipped: missing bot token. Set VITE_TELEGRAM_BOT_TOKEN in .env.local or enter it in Settings.");
    return;
  }

  const destinations = getEnabledDestinations(settings);
  if (destinations.length === 0) {
    console.warn("Telegram notification skipped: no enabled destinations.");
    return;
  }

  const text = buildTelegramMessage(alert, config, settings);
  const parseMode = settings.messageMode !== "custom" || !settings.customMessage.trim() ? "HTML" : undefined;
  const results = await Promise.allSettled(
    destinations.map((destination) =>
      sendTelegramMessageToDestination(botToken, destination, text, parseMode)
    )
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Telegram notification error:", result.reason);
    }
  }
}

export async function sendTelegramScanStart(
  config: ScanConfig,
  settings: TelegramSettings
): Promise<void> {
  if (!settings.enabled) return;

  const botToken = resolveBotToken(settings);
  if (!botToken) return;

  const destinations = getEnabledDestinations(settings);
  if (destinations.length === 0) return;

  const text = [
    `🚀 <b>RSI scanning is starting</b>`,
    ``,
    `⌚ <b>Timeframes:</b> ${escapeHtml(config.tfFast)} + ${escapeHtml(config.tfSlow)} + <b>4hrs</b>`,
    `📈 <b>Top pairs:</b> ${config.topN}`,
    `⏱ <b>Poll:</b> ${config.pollIntervalS}s`,
  ].join("\n");

  const results = await Promise.allSettled(
    destinations.map((destination) =>
      sendTelegramMessageToDestination(botToken, destination, text, "HTML")
    )
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Telegram scan-start notification error:", result.reason);
    }
  }

}

export function startTelegramCommandListener(
  settings: TelegramSettings,
  onHandled?: (command: string) => void
): () => void {
  if (!settings.enabled) return () => undefined;

  const botToken = resolveBotToken(settings);
  if (!botToken) return () => undefined;

  let stopped = false;
  let offset: number | undefined;

  const poll = async () => {
    const initialUpdates = await getTelegramUpdates(botToken, undefined, 0);
    if (initialUpdates.length > 0) {
      offset = initialUpdates[initialUpdates.length - 1].update_id + 1;
    }

    while (!stopped) {
      const updates = await getTelegramUpdates(botToken, offset);

      for (const update of updates) {
        offset = update.update_id + 1;

        const message = update.message;
        const text = message?.text?.trim();
        if (!message || !text) continue;

        const command = text.split(/\s+/)[0].toLowerCase();
        const chatId = message.chat.id;
        const threadId = message.message_thread_id;

        if (command === "/getmyid") {
          const userId = message.from?.id ?? chatId;
          await sendTelegramCommandReply(
            botToken,
            chatId,
            [
              `Your own ID is: <code>${userId}</code>`,
              `Your chat ID is: <code>${chatId}</code>`,
            ].join("\n"),
            threadId
          );
          onHandled?.(command);
        }

        if (command === "/getgroupid") {
          await sendTelegramCommandReply(
            botToken,
            chatId,
            [
              `Your supergroup ID is: <code>${chatId}</code>`,
              message.from?.id != null ? `Your own ID is: <code>${message.from.id}</code>` : undefined,
            ]
              .filter(Boolean)
              .join("\n"),
            threadId
          );
          onHandled?.(command);
        }
      }
    }
  };

  void poll().catch((error) => {
    if (!stopped) {
      console.error("Telegram command listener error:", error);
    }
  });

  return () => {
    stopped = true;
  };
}