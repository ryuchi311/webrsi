import { useEffect, useState } from "react";
import type { ScanConfig, TelegramSettings, TelegramMessageMode } from "../types";

interface ConfigPanelProps {
  config: ScanConfig;
  onChange: (c: ScanConfig) => void;
  disabled: boolean;
  telegram: TelegramSettings;
  onTelegramChange: (next: TelegramSettings) => void;
}

type FieldDef = {
  key: keyof ScanConfig;
  label: string;
  step?: number;
  min?: number;
};

const FIELDS: FieldDef[] = [
  { key: "topN", label: "Top N Pairs", min: 1 },
  { key: "pollIntervalS", label: "Poll Interval (s)", min: 10 },
  { key: "rsiPeriod", label: "RSI Period", min: 2 },
  { key: "overbought", label: "OB Threshold", step: 0.5 },
  { key: "oversold", label: "OS Threshold", step: 0.5 },
  { key: "extremeOb", label: "Extreme OB", step: 0.5 },
  { key: "extremeOs", label: "Extreme OS", step: 0.5 },
  { key: "resetFromOb", label: "Reset from OB", step: 0.5 },
  { key: "resetFromOs", label: "Reset from OS", step: 0.5 },
  { key: "resetFromExtremeOb", label: "Reset from XOB", step: 0.5 },
  { key: "resetFromExtremeOs", label: "Reset from XOS", step: 0.5 },
];

const TF_OPTIONS = ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1d"];

export function ConfigPanel({
  config,
  onChange,
  disabled,
  telegram,
  onTelegramChange,
}: ConfigPanelProps) {
  const [draft, setDraft] = useState(config);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const applyDraft = () => onChange(draft);

  return (
    <div className="config-panel">
      <h3>⚙ Scanner Configuration</h3>
      {disabled && (
        <p className="config-note config-note-warn">
          Stop the scanner to apply changes.
        </p>
      )}

      <div className="config-top-row">
        <div className="config-field">
          <label>Fast TF</label>
          <select
            className="config-select"
            disabled={disabled}
            value={draft.tfFast}
            onChange={(e) => setDraft((d) => ({ ...d, tfFast: e.target.value }))}
          >
            {TF_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="config-field">
          <label>Slow TF</label>
          <select
            className="config-select"
            disabled={disabled}
            value={draft.tfSlow}
            onChange={(e) => setDraft((d) => ({ ...d, tfSlow: e.target.value }))}
          >
            {TF_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="config-field">
          <label>4hrs TF</label>
          <select
            className="config-select"
            disabled={disabled}
            value={draft.tfBig}
            onChange={(e) => setDraft((d) => ({ ...d, tfBig: e.target.value }))}
          >
            {TF_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="config-grid">
        {FIELDS.map(({ key, label, step = 1, min = 0 }) => (
          <div className="config-field" key={key}>
            <label>{label}</label>
            <input
              type="number"
              disabled={disabled}
              value={draft[key] as number}
              step={step}
              min={min}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  [key]: parseFloat(e.target.value) || 0,
                }))
              }
            />
          </div>
        ))}
      </div>

      <div className="config-actions">
        <button
          className="btn btn-start"
          disabled={disabled}
          onClick={applyDraft}
        >
          Apply Config
        </button>
        <button
          className="btn btn-ghost"
          disabled={disabled}
          onClick={() => setDraft(config)}
        >
          Reset
        </button>
      </div>

      <div className="config-divider" />

      <h3>Telegram Alerts</h3>
      <div className="config-field config-toggle-field">
        <label className="config-switch">
          <input
            type="checkbox"
            checked={telegram.enabled}
            disabled={disabled}
            onChange={(e) =>
              onTelegramChange({ ...telegram, enabled: e.target.checked })
            }
          />
          <span>Enable Telegram bot</span>
        </label>
      </div>

      <div className="config-grid telegram-grid">
        <div className="config-field">
          <label>Bot Token</label>
          <input
            className="config-input"
            type="password"
            placeholder="Paste bot token"
            disabled={disabled}
            value={telegram.botToken}
            onChange={(e) =>
              onTelegramChange({ ...telegram, botToken: e.target.value })
            }
          />
        </div>
        <div className="config-field">
          <label>Chat ID</label>
          <input
            className="config-input"
            type="text"
            placeholder="-1001234567890"
            disabled={disabled}
            value={telegram.chatId}
            onChange={(e) =>
              onTelegramChange({ ...telegram, chatId: e.target.value })
            }
          />
        </div>
        <div className="config-field">
          <label>Topic thread ID (optional)</label>
          <input
            className="config-input"
            type="text"
            placeholder="123"
            disabled={disabled}
            value={telegram.topicThreadId}
            onChange={(e) =>
              onTelegramChange({ ...telegram, topicThreadId: e.target.value })
            }
          />
        </div>
        <div className="config-field">
          <label>Message mode</label>
          <select
            className="config-select"
            disabled={disabled}
            value={telegram.messageMode}
            onChange={(e) =>
              onTelegramChange({
                ...telegram,
                messageMode: e.target.value as TelegramMessageMode,
              })
            }
          >
            <option value="default">Default</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>

      <div className="config-field">
        <label>Custom message</label>
        <textarea
          className="config-textarea"
          disabled={disabled || telegram.messageMode !== "custom"}
          value={telegram.customMessage}
          placeholder="Use {{symbol}}, {{zone}}, {{tfFast}}, {{tfSlow}}, {{tfBig}}, {{rsiFast}}, {{rsiSlow}}, {{rsiBig}}, {{time}}"
          onChange={(e) =>
            onTelegramChange({ ...telegram, customMessage: e.target.value })
          }
        />
      </div>

      <p className="config-note">
        Placeholders: {"{{symbol}}"}, {"{{zone}}"}, {"{{tfFast}}"}, {"{{tfSlow}}"}, {"{{tfBig}}"}, {"{{rsiFast}}"}, {"{{rsiSlow}}"}, {"{{rsiBig}}"}, {"{{time}}"}.
      </p>
      <p className="config-note">Settings are saved on this device automatically.</p>
    </div>
  );
}