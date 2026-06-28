import { createServer } from "http";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");
const settingsFile = join(rootDir, "webrsi.settings.json");
const port = Number.parseInt(process.env.WEBRSI_SETTINGS_PORT ?? "8788", 10);

const defaults = {
  scanConfig: {
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
  },
  telegramSettings: {
    enabled: false,
    botToken: "",
    chatId: "",
    topicThreadId: "",
    messageMode: "default",
    customMessage:
      "🔔 RSI Alert\n\nSymbol: {{symbol}}\nZone: {{zone}}\nFast ({{tfFast}}): {{rsiFast}}\nSlow ({{tfSlow}}): {{rsiSlow}}\n4hrs ({{tfBig}}): {{rsiBig}}\nTime: {{time}}",
  },
};

async function readSettings() {
  if (!existsSync(settingsFile)) return defaults;
  const raw = await readFile(settingsFile, "utf8");
  const parsed = JSON.parse(raw);
  return {
    scanConfig: { ...defaults.scanConfig, ...(parsed.scanConfig ?? {}) },
    telegramSettings: { ...defaults.telegramSettings, ...(parsed.telegramSettings ?? {}) },
  };
}

async function writeSettings(payload) {
  await writeFile(settingsFile, JSON.stringify(payload, null, 2), "utf8");
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.url === "/settings" && req.method === "GET") {
    try {
      const settings = await readSettings();
      sendJson(res, 200, settings);
    } catch {
      sendJson(res, 500, { error: "Failed to read settings" });
    }
    return;
  }

  if (req.url === "/settings" && req.method === "POST") {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString("utf8");
      const parsed = JSON.parse(raw);
      await writeSettings({
        scanConfig: { ...defaults.scanConfig, ...(parsed.scanConfig ?? {}) },
        telegramSettings: { ...defaults.telegramSettings, ...(parsed.telegramSettings ?? {}) },
      });
      sendJson(res, 200, { ok: true });
    } catch {
      sendJson(res, 400, { error: "Invalid settings payload" });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`WebRSI settings server running on http://127.0.0.1:${port}`);
});