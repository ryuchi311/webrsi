# WebRSI

WebRSI is a premium, trader-focused BingX RSI scanner and dashboard built with React, TypeScript, and Vite. It is designed to provide rapid, actionable insights for cryptocurrency traders using Relative Strength Index (RSI) across multiple timeframes.

## What it does

- **Comprehensive Scanning**: Scans BingX USDT perpetual pairs.
- **Large-Scale Support**: Supports up to 500 pairs seamlessly.
- **Precision Alerts**: Uses fast (e.g., 5m) + slow (e.g., 15m) + context (e.g., 4h) RSI alignment for live alerts.
- **Dynamic Charting**: Features a collapsible, responsive chart panel for immediate technical review.
- **TradingView Integration**: Displays a TradingView technical analysis widget and ticker tape.
- **Instant Notifications**: Supports automated Telegram notifications for trading setups.
- **Robust Settings**: Saves settings locally in the browser or through an optional local settings service.

## Main Features

### Scanner
- Fast BingX market scanning
- Multi-timeframe RSI context (e.g., 5m / 15m / 4h)
- Up to 500-pair support with a 30-second sweep timing
- Live alert feed prioritized for quick action
- Auto-collapse chart on new alerts
- Click any pair/card to expand the chart again for detailed viewing

### UI
- Dark, premium, trader-style design
- Fully mobile-friendly layout focusing on the Live Alert Feed on smaller screens
- Compact sidebar metrics for maximum screen real estate
- Collapsible chart section to manage focus
- BingX branding in the header

### TradingView Widgets
- **Sidebar**: Technical analysis widget
- **Header**: Ticker tape above the Live RSI Grid (symbols editable in Settings)
- Widget follows the clicked card first, falling back to the filtered Live RSI Grid result (defaulting to a safe BingX BTC view).

### Telegram Notifications
- Enable/disable Telegram bot directly from settings
- Bot token support with multiple destinations
- Optional topic thread ID for organized channel alerts
- Default or custom markdown message templates

## Getting Started

### Development

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
```

### Preview

```bash
npm run preview
```

## One-Click Run

Use the included Windows launcher for quick startup:

```bash
run-webrsi.cmd
```

## Settings

The app stores settings in two ways:
- **Browser localStorage** (Default)
- **Local Settings Server** (Optional, typically at `http://127.0.0.1:8788/settings`)

If the settings server is not running, the application gracefully falls back to localStorage.

## Configuration

Key scanner settings you can customize:
- Fast timeframe
- Slow timeframe
- 4h timeframe (trend context)
- RSI thresholds (overbought/oversold levels)
- Top N pairs to track
- Poll interval

Ticker tape symbols can be edited directly in the UI Settings (using commas or new lines).

## Default Ticker Tape

The default ticker tape includes popular assets:
- BINGX:BTCUSDT.P
- BINGX:ETHUSDT.P
- BINGX:SOLUSDT.P
- BINGX:XRPUSDT.P
- BINGX:BNBUSDT.P
- BINGX:SUIUSDT.P
- BINGX:DOGEUSDT.P
- GEMINI:TONUSD

## Notes & Best Practices

- **Security**: Do not commit secrets to version control.
- **Tokens**: Keep Telegram tokens in the local settings server or `.env.local`.
- **Untracked Files**: `dist/`, `node_modules/`, `.env`, and `portable-settings.json` should stay untracked.

## Tech Stack

- React 19
- TypeScript
- Vite 8
- TradingView Widgets
