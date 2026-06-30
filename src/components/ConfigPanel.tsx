import { useEffect, useState } from "react";
import type {
  ScanConfig,
  TelegramDestination,
  TelegramMessageMode,
  TelegramSettings,
} from "../types";

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
  const updateDestination = (index: number, next: Partial<TelegramDestination>) => {
    onTelegramChange({
      ...telegram,
      destinations: telegram.destinations.map((destination, currentIndex) =>
        currentIndex === index ? { ...destination, ...next } : destination
      ),
    });
  };
  const addDestination = () => {
    onTelegramChange({
      ...telegram,
      destinations: [
        ...telegram.destinations,
        { enabled: true, chatId: "", topicThreadId: "" },
      ],
    });
  };
  const removeDestination = (index: number) => {
    if (telegram.destinations.length <= 1) return;
    onTelegramChange({
      ...telegram,
      destinations: telegram.destinations.filter((_, currentIndex) => currentIndex !== index),
    });
  };

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

        <div className="config-section-header">
          <h4>Destinations</h4>
          <button
            className="btn btn-ghost"
            disabled={disabled}
            onClick={addDestination}
          >
            Add destination
          </button>
        </div>

        <div className="telegram-destinations">
          {telegram.destinations.map((destination, index) => (
            <div className="telegram-destination-card" key={index}>
              <div className="telegram-destination-head">
                <strong>Destination {index + 1}</strong>
                <label className="config-switch">
                  <input
                    type="checkbox"
                    checked={destination.enabled}
                    disabled={disabled}
                    onChange={(e) =>
                      updateDestination(index, { enabled: e.target.checked })
                    }
                  />
                  <span>Enable</span>
                </label>
              </div>
              <div className="config-grid telegram-grid">
                <div className="config-field">
                  <label>Chat ID</label>
                  <input
                    className="config-input"
                    type="text"
                    placeholder="-1001234567890"
                    disabled={disabled}
                    value={destination.chatId}
                    onChange={(e) =>
                      updateDestination(index, { chatId: e.target.value })
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
                    value={destination.topicThreadId}
                    onChange={(e) =>
                      updateDestination(index, { topicThreadId: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="telegram-destination-actions">
                <button
                  className="btn btn-ghost"
                  disabled={disabled || telegram.destinations.length === 1}
                  onClick={() => removeDestination(index)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="config-note">
          Placeholders: {"{{symbol}}"}, {"{{zone}}"}, {"{{tfFast}}"}, {"{{tfSlow}}"}, {"{{tfBig}}"}, {"{{rsiFast}}"}, {"{{rsiSlow}}"}, {"{{rsiBig}}"}, {"{{time}}"}.
        </p>
        <p className="config-note">
          Disable a destination to keep it saved but inactive. Settings are saved locally and synced to a config file automatically.
        </p>
        <p className="config-note">
          Telegram commands: send <code>/getmyid</code> in private chat or <code>/getgroupid</code> in a group/topic to get IDs.
        </p>
        <p className="config-note">
          For safer local setup, put <code>VITE_TELEGRAM_BOT_TOKEN</code> in <code>.env.local</code> and leave Bot Token empty.
        </p>
    </div>
  );
}