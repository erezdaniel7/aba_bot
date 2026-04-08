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
- **Private AI Replies** — Responds only to authorized private chats using Azure OpenAI, with context from today's Jewish date data, Shabbat info, holidays, upcoming calendar events, and the identified family member behind the current chat.
- **Structured Conversation Memory** — Keeps per-user conversation history plus a structured long-term summary with stable facts and recent notes, so the bot remembers older relevant context instead of only the latest session.
- **Mentioned Family Memory** — When a message talks about another family member, the bot can keep a lightweight summary for that mentioned person as well.
- **Family Context** — Uses configurable family-level context, member names, relation, gender, phone-to-name mapping, and short notes about each family member in both daily messages and private AI replies.
- **AI Debug Logging** — Writes AI prompts, tool calls, tool results, and final responses to a dedicated log file for troubleshooting, with clear separators between entries.
- **AI Variety Controls** — Daily AI messages use anti-repetition prompt rules, recent-message memory, and tuned generation settings to keep the tone warmer and less repetitive across days.
- **AI Metrics** — Tracks lightweight repetition and summary-update metrics in JSON files to help monitor quality over time.
- **HTTP API** — An Express HTTP server exposes a `POST /send-message` endpoint to send text or image messages programmatically.
- **WhatsApp QR Authentication** — On first run, a QR code is displayed in the terminal for linking with WhatsApp Web. Session is persisted locally for subsequent runs.
- **Windows Service Support** — Can be installed as a Windows service via `node-windows`.
- **AI-Powered Daily Messages** — Optionally uses Azure OpenAI (GPT-4.1-mini) to generate creative, warm morning messages instead of the static template. Enabled by default; can be toggled per call.
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

Copy `src/config.simple.ts` to `src/config.ts`, then create a local `.env` file from the example:

```bash
cp src/config.simple.ts src/config.ts
cp .env.example .env
```

Edit `src/config.ts` for your WhatsApp/family/calendar settings, and edit `.env` for Azure OpenAI secrets:

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

    family: {
        description: 'Short shared context about the family.',
        members: [
            {
                relation: 'Dad',
                name: 'Daniel',
                gender: 'male',
                phoneNumber: '972XXXXXXXXX@c.us',
                shortDescription: 'Short helpful info about this family member.',
            },
        ],
    },

    azureOpenAI: {
        endpoint: process.env.AZURE_OPENAI_ENDPOINT ?? '',
        apiKey: process.env.AZURE_OPENAI_API_KEY ?? '',
        deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT ?? '',
        apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-12-01-preview',
    },

    ics_list: [
        'https://calendar.google.com/calendar/ical/.../basic.ics',  // Google Calendar ICS URL
        // Add more ICS calendar URLs here
    ],

    conversation: {
        userSummariesFilePath: 'data/user-summaries.json',   // Persistent per-user summaries
        entitySummariesFilePath: 'data/entity-summaries.json', // Mentioned family-member summaries
        aiMetricsFilePath: 'data/ai-metrics.json',           // Lightweight AI quality metrics
        chatHistoryFilePath: 'data/chat-history.json',       // Persistent chat history
    },

    log_file_path: 'log/log.log',       // Path to the general log file
    ai_log_file_path: 'log/ai.log'      // Path to the AI debug log file
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
| `family.description` | Shared context about the family that is injected into AI prompts |
| `family.members` | Family member list with relation, name, optional gender, chat ID/phone mapping, and short personal context |
| `family.members[].phoneNumber` | Used to map the active private chat to a known family member, so the AI knows who is currently speaking |
| `ics_list` | Array of ICS calendar URLs to fetch events from |
| `conversation.userSummariesFilePath` | JSON file path for persisted per-user summaries |
| `conversation.entitySummariesFilePath` | JSON file path for mentioned family-member summaries |
| `conversation.aiMetricsFilePath` | JSON file path for lightweight AI quality metrics |
| `conversation.chatHistoryFilePath` | JSON file path for persisted chat history |
| `azureOpenAI.endpoint` | Azure OpenAI resource endpoint URL (usually from `.env`) |
| `azureOpenAI.apiKey` | Azure OpenAI API key (from `.env`) |
| `azureOpenAI.deploymentName` | Name of the deployed model (e.g. `aba-bot`) |
| `azureOpenAI.apiVersion` | Azure OpenAI API version |
| `log_file_path` | File path for the log output |
| `ai_log_file_path` | File path for AI debug logs including prompts and tool calls |

### Environment Variables

Create a local `.env` file based on `.env.example`:

```env
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com/
AZURE_OPENAI_API_KEY=replace-with-your-azure-openai-key
AZURE_OPENAI_DEPLOYMENT=aba-bot
AZURE_OPENAI_API_VERSION=2024-12-01-preview
```

> `.env` is ignored by git. Commit only `.env.example`.

### Family Context Notes

- The bot uses `family.members[].phoneNumber` to identify the current user in private chats.
- Keep `relation`, `name`, and `gender` explicit rather than embedding them into one display string.
- Put only stable, useful details in `shortDescription`, such as school, hobbies, recurring interests, or family responsibilities.
- Avoid temporary facts in `shortDescription`; those belong in calendar data or conversation history, not static family config.

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

Copy the endpoint and key into your local `.env` file so `src/config.ts` can load them automatically with `dotenv`.

> **Tip:** To find chat IDs, you can check the bot logs after receiving a message — the sender's chat ID is logged.

## Usage

### Build and Run

```bash
# Build TypeScript and start the bot
npm start
```

On the first run, a **QR code** will be displayed in the terminal. Scan it with WhatsApp (Linked Devices) to authenticate. The session is saved in the `wwebjs_auth/` folder so you won't need to scan again on subsequent runs.

> **Note:** If the bot runs as a **Windows service**, there is no interactive terminal, so the QR is intentionally **not rendered there**. Link the WhatsApp session once from a normal terminal first, then run the bot as a service.

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
├── calendar.ts         # ICS calendar fetching, caching, and message data collection
├── message.ts          # Daily message generation (with/without AI)
├── aiMessageGenerator.ts # Azure OpenAI client wrapper
├── aiBehavior.ts       # AI repetition control and summary-update heuristics
├── aiMetrics.ts        # Lightweight AI quality metrics persistence
├── chatHistory.ts      # Per-user private chat context memory
├── userSummaryStore.ts # Structured long-term user summaries
├── entitySummaryStore.ts # Memory for mentioned family members
├── familyContext.ts    # Family context + mentioned-member detection
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
