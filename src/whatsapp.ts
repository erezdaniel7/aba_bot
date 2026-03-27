import * as whatsapp from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';

import { config } from './config';
import { Log } from './log';
import { Calendar } from './calendar';
import { AiMessageGenerator } from './aiMessageGenerator';
import { ChatHistory } from './chatHistory';
import moment from 'moment';

// Chrome paths to check (in order of priority)
const CHROME_PATHS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
];

function getChromePath(): string {
    for (const chromePath of CHROME_PATHS) {
        if (fs.existsSync(chromePath)) {
            Log.log('Using Chrome at: ' + chromePath);
            return chromePath;
        }
    }
    return '';
}

const RESTART_DELAY_MS = 15_000;
const HEALTH_CHECK_INTERVAL_MS = 30_000;
const HEALTH_CHECK_TIMEOUT_MS = 10_000;

export class WhatsApp {
    private client!: whatsapp.Client;
    private readyPromise!: Promise<void>;
    private readyResolve!: () => void;
    private isReady = false;
    private isRestarting = false;
    private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
    private calendar = new Calendar();
    private aiMessageGenerator = new AiMessageGenerator();
    private chatHistory = new ChatHistory();

    constructor() {
        this.resetReadyPromise();
        this.init();
    }

    private resetReadyPromise() {
        this.isReady = false;
        this.readyPromise = new Promise<void>((resolve) => {
            this.readyResolve = resolve;
        });
    }

    private async restart(reason: string) {
        if (this.isRestarting) return;
        this.isRestarting = true;
        this.resetReadyPromise();

        Log.log(`Restarting WhatsApp client (reason: ${reason})...`);

        this.stopHealthCheck();

        try {
            await this.client.destroy();
            Log.log('Old client destroyed');
        } catch (e) {
            Log.log('Error destroying old client: ' + (e as Error).message);
        }

        // Wait before reinitializing to let network/browser settle
        await new Promise((r) => setTimeout(r, RESTART_DELAY_MS));
        this.isRestarting = false;
        this.init();
    }

    private startHealthCheck() {
        this.stopHealthCheck();
        this.healthCheckTimer = setInterval(() => this.checkHealth(), HEALTH_CHECK_INTERVAL_MS);
    }

    private stopHealthCheck() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
    }

    private async checkHealth() {
        if (!this.isReady || this.isRestarting) return;

        try {
            const page = this.client.pupPage;
            if (!page || page.isClosed()) {
                this.restart('browser page closed');
                return;
            }

            // Evaluate with a timeout to detect frozen/stale browser (e.g. after sleep)
            const ok = await Promise.race([
                page.evaluate('navigator.onLine').then(() => true),
                new Promise<false>((resolve) => setTimeout(() => resolve(false), HEALTH_CHECK_TIMEOUT_MS)),
            ]);

            if (!ok) {
                this.restart('browser not responding (possible sleep/wake)');
                return;
            }

            // Check if WhatsApp state is still connected
            const state = await Promise.race([
                this.client.getState(),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), HEALTH_CHECK_TIMEOUT_MS)),
            ]);

            if (state === null) {
                this.restart('getState timed out');
            } else if (state !== 'CONNECTED') {
                Log.log('WhatsApp state: ' + state);
                this.restart('WhatsApp state is ' + state);
            }
        } catch (e) {
            Log.log('Health check error: ' + (e as Error).message);
            this.restart('health check failed');
        }
    }

    private init() {
        const chromePath = getChromePath();

        // Clean up stale browser lock to prevent "browser is already running" errors on restart
        const sessionDir = path.join(__dirname, '..', 'wwebjs_auth', 'session');
        const lockFile = path.join(sessionDir, 'lockfile');
        if (fs.existsSync(lockFile)) {
            try {
                fs.unlinkSync(lockFile);
                Log.log('Removed stale browser lockfile');
            } catch (e) {
                // Lockfile is held by a running Chrome — kill Chrome processes using this session
                Log.log('Lockfile is busy, killing old Chrome processes...');
                try {
                    const sessionDirNorm = sessionDir.replace(/\//g, '\\');
                    execSync(`wmic process where "commandline like '%${sessionDirNorm.replace(/\\/g, '\\\\')}%' and name='chrome.exe'" call terminate`, { timeout: 10000 });
                    Log.log('Terminated old Chrome processes');
                } catch { /* no matching processes, or wmic unavailable */ }
                try {
                    fs.unlinkSync(lockFile);
                    Log.log('Removed lockfile after killing Chrome');
                } catch (e2) {
                    if ((e2 as NodeJS.ErrnoException).code !== 'ENOENT') {
                        Log.log('Still could not remove lockfile: ' + (e2 as Error).message);
                    }
                }
            }
        }

        this.client = new whatsapp.Client({
            webVersionCache: {
                type: 'none',
            },

            authStrategy: new whatsapp.LocalAuth({
                dataPath: path.join(__dirname, '..', 'wwebjs_auth')
            }),

            puppeteer: {
                headless: true,
                ...(chromePath ? { executablePath: chromePath } : {}),
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
            }
        });

        this.client.on('loading_screen', (percent: string, message: string) => {
            Log.log(`WhatsApp loading: ${percent}% - ${message}`);
        });

        this.client.on('authenticated', () => {
            Log.log('WhatsApp authenticated!');
        });

        this.client.on('auth_failure', (msg: string) => {
            Log.log('WhatsApp auth failure: ' + msg);
            this.restart('auth failure');
        });

        this.client.on('disconnected', (reason: string) => {
            Log.log('WhatsApp disconnected: ' + reason);
            this.restart('disconnected: ' + reason);
        });

        this.client.on('qr', (qr: string) => {
            // Generate and scan this code with your phone
            Log.log('QR RECEIVED' + qr);
            qrcode.generate(qr, { small: true });
        });

        this.client.on('ready', async () => {
            this.isReady = true;
            this.readyResolve();
            Log.log('Whatsapp Client is ready!');
            this.startHealthCheck();
            this.sendMessage(config.whatsApp.adminChatId, 'Hey admin! This is an automated message.');
            this.sendMessage(config.whatsApp.testGroupChatId, 'Hey group! This is an automated message.');
        });

        this.client.on('message', (msg) => this.onMessageReceived(msg));

        this.client.initialize().then(async () => {
            // Log browser-level info after initialize resolves
            const page = this.client.pupPage;
            if (page) {
                page.on('console', (msg: any) => Log.log('BROWSER CONSOLE: ' + msg.text()));
                page.on('pageerror', (err: any) => Log.log('BROWSER ERROR: ' + err.message));
                Log.log('Puppeteer page URL: ' + page.url());

                // Check WWeb version and Store injection status
                try {
                    const version = await page.evaluate('window.Debug?.VERSION');
                    const hasStore = await page.evaluate('typeof window.Store !== "undefined"');
                    const hasWWebJS = await page.evaluate('typeof window.WWebJS !== "undefined"');
                    Log.log(`WWeb Version: ${version}, Store injected: ${hasStore}, WWebJS injected: ${hasWWebJS}`);
                } catch (e) {
                    Log.log('Failed to check injection status: ' + (e as Error).message);
                }
            }
        }).catch((error) => {
            Log.log('Failed to initialize WhatsApp client: ' + (error as Error).message);
            this.restart('init failed');
        });
    }

    public async sendMessage(chatId: string, content: whatsapp.MessageContent, options?: whatsapp.MessageSendOptions): Promise<whatsapp.Message | null> {
        await this.readyPromise;
        try {
            return await this.client.sendMessage(chatId, content, { sendSeen: false, ...options });
        } catch (error) {
            Log.log('Error sending message: ' + (error as Error).message);
            return null;
        }
    }

    private async safeReply(msg: whatsapp.Message, content: string): Promise<void> {
        try {
            if (msg.author) {
                // Group message - reply in private chat to the author
                // Convert LID format to phone number if needed
                const contact = await msg.getContact();
                const privateChatId = contact.id._serialized;
                await this.client.sendMessage(privateChatId, content, { quotedMessageId: msg.id._serialized });
            } else {
                // Private chat - reply in the same chat with quote
                const chat = await msg.getChat();
                await chat.sendMessage(content, { quotedMessageId: msg.id._serialized });
            }
        } catch (error) {
            Log.log('Error replying to message: ' + (error as Error).message);
        }
    }

    private async onMessageReceived(msg: whatsapp.Message) {
        // Ignore newsletter/channel messages
        if (msg.from.endsWith('@newsletter')) {
            return;
        }

        // Ignore group messages — only reply to private chats
        if (msg.author) {
            return;
        }

        // Mark the message as read
        try {
            const chat = await msg.getChat();
            await chat.sendSeen();
        } catch (error) {
            Log.log('Error marking message as read: ' + (error as Error).message);
        }

        Log.log('MESSAGE RECEIVED:');
        Log.log('msg.from:' + msg.from);

        // Check authorization (private chat only)
        if (!config.whatsApp.users.includes(msg.from)) {
            return;
        }

        try {
            const calendarData = await this.calendar.collectData(moment(), { useCache: true, daysAhead: 7 });

            const upcomingEventsText = calendarData.upcomingDays.map((day) => {
                const dayDetails: string[] = [
                    `תאריך לועזי: ${day.formattedDate}`,
                    `תאריך עברי: ${day.heDate}`,
                ];

                if (day.holiday) {
                    dayDetails.push(`חג/מועד: ${day.holiday}`);
                }

                if (day.sabbathTime) {
                    if (day.sabbathTime['Parsha']) {
                        dayDetails.push(`פרשת השבוע: ${day.sabbathTime['Parsha']}`);
                    }
                    dayDetails.push(`הדלקת נרות: ${day.sabbathTime['CandleLightingTime'].format('HH:mm')}`);
                    dayDetails.push(`צאת שבת: ${day.sabbathTime['HavdalahTime'].format('HH:mm')}`);
                }

                if (day.events.length === 0) {
                    dayDetails.push('אירועים: אין אירועים.');
                    return dayDetails.join('\n');
                }

                const eventsText = day.events.map((event) => {
                    return '- ' + (event.datetype === 'date' ? '' : moment(event.start).format('HH:mm') + ' - ') + event.summary;
                }).join('\n');

                dayDetails.push(`אירועים:\n${eventsText}`);
                return dayDetails.join('\n');
            }).join('\n\n');

            let dailyContext = `תאריך עברי: ${calendarData.heDate}\n`;
            dailyContext += `תאריך לועזי: ${calendarData.formattedDate}\n`;

            if (calendarData.holiday) {
                dailyContext += `חג/מועד: ${calendarData.holiday}\n`;
            }

            if (calendarData.sabbathTime) {
                if (calendarData.sabbathTime['Parsha']) {
                    dailyContext += `פרשת השבוע: ${calendarData.sabbathTime['Parsha']}\n`;
                }
                dailyContext += `הדלקת נרות: ${calendarData.sabbathTime['CandleLightingTime'].format('HH:mm')}\n`;
                dailyContext += `צאת שבת: ${calendarData.sabbathTime['HavdalahTime'].format('HH:mm')}\n`;
            }

            const systemPrompt = `אתה "אבא בוט" בוט וואטסאפ ידידותי של משפחה ישראלית. אתה עונה בעברית.
יש לך גישה ללוח השנה המשפחתי של היום ושל הימים הקרובים.
ענה על הודעות בצורה חמה, ידידותית וקצרה.
אם השאלה קשורה ללוח זמנים או אירועים, השתמש במידע מלוח השנה.
אם השאלה לא קשורה ללוח, ענה בצורה כללית וידידותית.

מידע על היום:
${dailyContext}

אירועים ל-7 הימים הקרובים:
${upcomingEventsText}`;

            this.chatHistory.addMessage(msg.from, 'user', msg.body);

            const history = this.chatHistory.getHistory(msg.from);
            // Build conversation context from history (exclude the last user message, it's the current prompt)
            const conversationMessages = history.slice(0, -1).map(entry => ({
                role: entry.role as 'user' | 'assistant',
                content: entry.content,
            }));

            const reply = await this.aiMessageGenerator.generateMessage(msg.body, systemPrompt, conversationMessages);

            this.chatHistory.addMessage(msg.from, 'assistant', reply);
            await this.safeReply(msg, reply);
        } catch (error) {
            Log.log('Error generating AI reply: ' + (error as Error).message);
        }
    }
}