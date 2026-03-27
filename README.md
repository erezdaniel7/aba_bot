# aba_bot (אבא בוט)

## Overview

A WhatsApp bot that automatically sends daily calendar schedules and Jewish date information to a family WhatsApp group. It fetches events from ICS calendars, enriches them with Hebrew dates, Shabbat times, and Jewish holiday info, then delivers formatted messages on a schedule.

![image](https://github.com/erezdaniel7/aba_bot/assets/4678134/eabf9746-9720-4230-b7b7-ffaba3410203)

## Features

- **Daily Calendar Messages** — Fetches events from multiple ICS calendar URLs and sends a formatted daily summary to your WhatsApp group.
- **Scheduled Delivery** — Messages are sent automatically on a daily schedule:
  - **07:00 (Sun–Fri)** — Today's schedule sent to the main group
  - **20:00** — Tomorrow's schedule preview (test group only)
  - **06:00 (Sun–Fri)** — Tomorrow's schedule (test group only)
- **Hebrew Date & Jewish Holidays** — Each message includes the Hebrew date and any Jewish holiday for the day (Shabbat, Chagim, fasts, etc.).
- **Shabbat / Holiday Awareness** — Automatically skips sending messages on Shabbat and holidays (Issur Melacha). On Erev Shabbat, includes the next day's events as well.
- **Shabbat Times** — Displays candle lighting and Havdalah times, plus the weekly Parsha.
- **Recurring Event Support** — Properly handles recurring calendar events (RRULE), including rescheduled and deleted occurrences.
- **Interactive Chat Commands** — Responds to authorized users in private or group chats:
  - `hi` / `hello` / `הי` / `שלום` — Greeting
  - `bye` / `goodbye` / `להתראות` / `ביי` — Farewell
  - `ping` / `פינג` — Pong reply (supports multiple pings in one message)
- **HTTP API** — An Express HTTP server exposes a `POST /send-message` endpoint to send text or image messages programmatically.
- **WhatsApp QR Authentication** — On first run, a QR code is displayed in the terminal for linking with WhatsApp Web. Session is persisted locally for subsequent runs.
- **Windows Service Support** — Can be installed as a Windows service via `node-windows`.
- **AI-Powered Messages** — Optionally uses Azure OpenAI (GPT-4.1-mini) to generate creative, warm morning messages instead of the static template. Enabled by default; can be toggled per call.
- **Logging** — All activity is logged to both the console and a log file.

## Prerequisites

- **Node.js** (v18 or later recommended)
- **Google Chrome** installed (used by Puppeteer for WhatsApp Web)
- **WhatsApp account** to link with the bot
- **Azure OpenAI resource** (optional, for AI-generated messages) — [Create one via Azure CLI](#azure-openai-setup)

## Installation

```bash
# Clone the repository
git clone https://github.com/erezdaniel7/aba_bot.git
cd aba_bot

# Install dependencies
npm install
```

## Configuration

Copy `src/config.simple.ts` to `src/config.ts` and fill in the values:

```bash
cp src/config.simple.ts src/config.ts
```

Edit `src/config.ts`:

```ts
export const config = {

    httpServer: {
        port: 3000,                     // HTTP API port
        whitelistChatIds: [
            '972XXXXXXXXX@c.us',        // Chat IDs allowed to use the HTTP API
        ]
    },

    whatsApp: {
        adminChatId: '972XXXXXXXXX@c.us',      // Admin phone (receives startup notification)
        testGroupChatId: '12036XXXXXXX@g.us',  // Test group chat ID
        groupChatId: '12036XXXXXXX@g.us',      // Main family group chat ID
        users: [
            '972XXXXXXXXX@c.us',                // Authorized users (can interact with the bot)
        ]
    },

    ics_list: [
        'https://calendar.google.com/calendar/ical/.../basic.ics',  // Google Calendar ICS URL
        // Add more ICS calendar URLs here
    ],

    azureOpenAI: {
        endpoint: 'https://....api.cognitive.microsoft.com/',  // Azure OpenAI endpoint
        apiKey: 'your-api-key',                                // Azure OpenAI API key
        deploymentName: 'your-deployment',                     // Model deployment name
        apiVersion: '2024-12-01-preview',                      // API version
    },

    log_file_path: 'log/log.log'        // Path to the log file
};
```

### Config Fields

| Field | Description |
|---|---|
| `httpServer.port` | Port for the HTTP API server |
| `httpServer.whitelistChatIds` | Chat IDs permitted to receive messages via the HTTP API |
| `whatsApp.adminChatId` | Admin user who receives bot startup notifications |
| `whatsApp.testGroupChatId` | Test WhatsApp group for development/testing |
| `whatsApp.groupChatId` | Main WhatsApp group for daily messages |
| `whatsApp.users` | List of authorized WhatsApp user IDs that can interact with the bot |
| `ics_list` | Array of ICS calendar URLs to fetch events from |
| `azureOpenAI.endpoint` | Azure OpenAI resource endpoint URL |
| `azureOpenAI.apiKey` | Azure OpenAI API key |
| `azureOpenAI.deploymentName` | Name of the deployed model (e.g. `aba-bot`) |
| `azureOpenAI.apiVersion` | Azure OpenAI API version |
| `log_file_path` | File path for the log output |

### Azure OpenAI Setup

To enable AI-generated messages, create an Azure OpenAI resource and deploy a model:

```bash
# Create a resource group (or use an existing one)
az group create --name aba-bot-rg --location swedencentral

# Create the Azure OpenAI resource
az cognitiveservices account create --name aba-bot-openai --resource-group aba-bot-rg --kind OpenAI --sku S0 --location swedencentral

# Deploy a model
az cognitiveservices account deployment create --name aba-bot-openai --resource-group aba-bot-rg --deployment-name aba-bot --model-name gpt-4.1-mini --model-version "2025-04-14" --model-format OpenAI --sku-capacity 10 --sku-name "GlobalStandard"

# Get the API key
az cognitiveservices account keys list --name aba-bot-openai --resource-group aba-bot-rg --query "key1" -o tsv

# Get the endpoint
az cognitiveservices account show --name aba-bot-openai --resource-group aba-bot-rg --query "properties.endpoint" -o tsv
```

Copy the endpoint and key into `config.ts` under `azureOpenAI`.

> **Tip:** To find chat IDs, you can check the bot logs after receiving a message — the sender's chat ID is logged.

## Usage

### Build and Run

```bash
# Build TypeScript and start the bot
npm start
```

On the first run, a **QR code** will be displayed in the terminal. Scan it with WhatsApp (Linked Devices) to authenticate. The session is saved in the `wwebjs_auth/` folder so you won't need to scan again on subsequent runs.

### Development

```bash
# Build only
npm run build

# Run tests
npm test
```

### Install as a Windows Service

```bash
npm run install.service
```

This registers the bot as a Windows service named `aba_bot` that starts automatically.

## HTTP API

The bot exposes an HTTP endpoint for sending messages programmatically.

### `POST /send-message`

**Request body (JSON):**

| Field | Type | Required | Description |
|---|---|---|---|
| `chatId` | string | Yes | Target WhatsApp chat ID (must be in `whitelistChatIds`) |
| `content` | string | No* | Text message content |
| `imageBase64` | string | No* | Base64-encoded image to send |

\* At least one of `content` or `imageBase64` is required. If both are provided, `content` is used as the image caption.

**Example — Send a text message:**

```bash
curl -X POST http://localhost:3000/send-message \
  -H "Content-Type: application/json" \
  -d '{"chatId": "972XXXXXXXXX@c.us", "content": "Hello from the API!"}'
```

**Responses:**

| Status | Body |
|---|---|
| 200 | `{ "status": "Message sent" }` |
| 400 | `{ "error": "chatId and at least one of content or imageBase64 are required" }` |
| 403 | `{ "error": "chatId is not allowed" }` |
| 500 | `{ "error": "Failed to send message", "details": "..." }` |

## Project Structure

```
src/
├── index.ts            # Entry point — scheduling & startup
├── config.ts           # Configuration (your copy with real values)
├── config.simple.ts    # Configuration template
├── calendar.ts         # ICS calendar fetching & event parsing
├── message.ts          # Daily message generation (with/without AI)
├── aiMessageGenerator.ts # Azure OpenAI client wrapper
├── whatsapp.ts         # WhatsApp Web client wrapper
├── httpServer.ts       # Express HTTP API
├── log.ts              # File & console logging
└── heDate/
    ├── HeDate.js       # Hebrew date conversion
    ├── HeHoliday.js    # Jewish holiday lookup
    └── shabbatHug.ts   # Shabbat times & Parsha (via @hebcal/core)
```

## Tech Stack

- **TypeScript** / **Node.js**
- **whatsapp-web.js** — WhatsApp Web client via Puppeteer
- **node-ical** — ICS calendar parsing
- **@hebcal/core** — Hebrew calendar, Shabbat times, Parsha
- **node-schedule** — Cron-like job scheduling
- **Express** — HTTP API server
- **Moment.js** / **moment-timezone** — Date handling
- **openai** — Azure OpenAI SDK
- **node-windows** — Windows service installer

## License

ISC
