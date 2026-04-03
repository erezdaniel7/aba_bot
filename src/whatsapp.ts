import * as whatsapp from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';

import { config } from './config';
import { Conversation } from './conversation';
import { Log } from './log';

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
const LOCKFILE_RETRY_COUNT = 6;
const LOCKFILE_RETRY_DELAY_MS = 1_000;
const LOCAL_AUTH_CLIENT_ID = 'aba_bot_main';
const LOCAL_AUTH_DATA_PATH = path.join(__dirname, '..', 'wwebjs_auth');

function getSessionDirectoryPath(): string {
    return path.join(LOCAL_AUTH_DATA_PATH, `session-${LOCAL_AUTH_CLIENT_ID}`);
}

function sleepSync(ms: number): void {
    const atomics = new Int32Array(new SharedArrayBuffer(4));
    Atomics.wait(atomics, 0, 0, ms);
}

function escapeForSingleQuotedPowerShell(value: string): string {
    return value.replace(/'/g, "''");
}

function killChromeProcessesForSession(sessionDir: string): void {
    const escapedSessionDir = escapeForSingleQuotedPowerShell(sessionDir);
    const psCommand = [
        "$ErrorActionPreference='SilentlyContinue'",
        `$session='${escapedSessionDir}'`,
        "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\"",
        "| Where-Object { $_.CommandLine -like \"*${session}*\" }",
        "| ForEach-Object { Stop-Process -Id $_.ProcessId -Force }",
    ].join('; ');

    execSync(`powershell -NoProfile -Command \"${psCommand}\"`, { timeout: 10_000, stdio: 'ignore' });
}

function removeSessionLockFileWithRetries(lockFile: string, sessionDir: string): boolean {
    for (let attempt = 1; attempt <= LOCKFILE_RETRY_COUNT; attempt++) {
        if (!fs.existsSync(lockFile)) {
            return true;
        }

        try {
            fs.unlinkSync(lockFile);
            return true;
        } catch (error) {
            const errorCode = (error as NodeJS.ErrnoException).code;
            if (errorCode !== 'EBUSY' && errorCode !== 'EPERM') {
                throw error;
            }

            try {
                killChromeProcessesForSession(sessionDir);
            } catch {
                // Keep retrying lockfile deletion even if process lookup fails.
            }

            sleepSync(LOCKFILE_RETRY_DELAY_MS);
        }
    }

    return !fs.existsSync(lockFile);
}

export class WhatsApp {
    private client!: whatsapp.Client;
    private readyPromise!: Promise<void>;
    private readyResolve!: () => void;
    private isReady = false;
    private isRestarting = false;
    private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
    private conversation = new Conversation();

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
            const clientRef = (this as unknown as { client?: whatsapp.Client }).client;
            if (clientRef && typeof clientRef.destroy === 'function') {
                await clientRef.destroy();
                Log.log('Old client destroyed');
            } else {
                Log.log('No active client to destroy before restart');
            }
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
        const sessionDir = getSessionDirectoryPath();
        const lockFile = path.join(sessionDir, 'lockfile');
        if (fs.existsSync(lockFile)) {
            try {
                // A present lockfile is often stale; kill any matching Chrome process first.
                try {
                    killChromeProcessesForSession(sessionDir);
                } catch {
                    // Continue with lockfile cleanup attempts.
                }

                const removed = removeSessionLockFileWithRetries(lockFile, sessionDir);
                if (removed) {
                    Log.log('Removed stale browser lockfile');
                } else {
                    Log.log('Could not clear lockfile after retries; continuing with initialization.');
                }
            } catch (e) {
                Log.log('Failed while clearing lockfile, continuing: ' + (e as Error).message);
            }
        }

        this.client = new whatsapp.Client({
            webVersionCache: {
                type: 'none',
            },

            authStrategy: new whatsapp.LocalAuth({
                dataPath: LOCAL_AUTH_DATA_PATH,
                clientId: LOCAL_AUTH_CLIENT_ID,
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
            Log.log('QR RECEIVED');

            if (process.stdout?.isTTY) {
                qrcode.generate(qr, { small: true });
            } else {
                Log.log('Skipping QR terminal rendering because no interactive console is available.');
            }
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
            const sentMessage = await this.client.sendMessage(chatId, content, { sendSeen: false, ...options });

            if (chatId === config.whatsApp.groupChatId) {
                this.conversation.recordFamilyGroupAssistantMessage(this.describeOutgoingMessage(content, options));
            }

            return sentMessage;
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

    private async markMessageAsRead(msg: whatsapp.Message): Promise<whatsapp.Chat | null> {
        const maxAttempts = 3;
        let chat: whatsapp.Chat | null = null;

        const wait = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
        const isChatRead = async (chatId: string): Promise<boolean> => {
            try {
                const chatById = await this.client.getChatById(chatId);
                const unreadCount = (chatById as unknown as { unreadCount?: number }).unreadCount ?? 0;
                return unreadCount === 0;
            } catch {
                return false;
            }
        };

        const directSendSeenAndVerify = async (chatId: string): Promise<boolean> => {
            const page = this.client.pupPage;
            if (!page) {
                return false;
            }

            return page.evaluate(async (targetChatId: string) => {
                const browserGlobal = globalThis as typeof globalThis & {
                    WWebJS: {
                        getChat: (chatId: string, options?: { getAsModel?: boolean }) => Promise<{ unreadCount?: number } | null>;
                        sendSeen: (chatId: string) => Promise<boolean>;
                    };
                };

                const chat = await browserGlobal.WWebJS.getChat(targetChatId, { getAsModel: false });
                if (!chat) {
                    return false;
                }

                await browserGlobal.WWebJS.sendSeen(targetChatId);

                const verifiedChat = await browserGlobal.WWebJS.getChat(targetChatId, { getAsModel: false });
                return Boolean(verifiedChat) && Number(verifiedChat?.unreadCount || 0) === 0;
            }, chatId);
        };

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // 1) Preferred path from docs: Client.sendSeen(chatId)
            try {
                const sendSeenResult = await this.client.sendSeen(msg.from);
                if (sendSeenResult && await isChatRead(msg.from)) {
                    chat = chat ?? await msg.getChat().catch(() => null);
                    return chat;
                }
                Log.log(`Client.sendSeen did not verify read state (attempt ${attempt}/${maxAttempts}) for ${msg.from}`);
            } catch (error) {
                Log.log(`Client.sendSeen failed (attempt ${attempt}/${maxAttempts}): ${(error as Error).message}`);
            }

            // 2) Message chat instance path: msg.getChat().sendSeen()
            try {
                chat = chat ?? await msg.getChat();
                const chatSeenResult = await chat.sendSeen();
                if (chatSeenResult && await isChatRead(msg.from)) {
                    return chat;
                }
                Log.log(`Chat.sendSeen did not verify read state (attempt ${attempt}/${maxAttempts}) for ${msg.from}`);
            } catch (error) {
                Log.log(`Chat.sendSeen failed (attempt ${attempt}/${maxAttempts}): ${(error as Error).message}`);
            }

            // 3) Fresh chat instance path: client.getChatById(chatId).sendSeen()
            try {
                const chatById = await this.client.getChatById(msg.from);
                const chatLike = chatById as unknown as { sendSeen?: () => Promise<boolean> };
                if (typeof chatLike.sendSeen === 'function') {
                    const byIdResult = await chatLike.sendSeen();
                    if (byIdResult && await isChatRead(msg.from)) {
                        chat = chatById as unknown as whatsapp.Chat;
                        return chat;
                    }
                    Log.log(`getChatById().sendSeen did not verify read state (attempt ${attempt}/${maxAttempts}) for ${msg.from}`);
                }
            } catch (error) {
                Log.log(`getChatById().sendSeen failed (attempt ${attempt}/${maxAttempts}): ${(error as Error).message}`);
            }

            // 4) Direct page-level fallback using the same primitives as the library.
            try {
                const directResult = await directSendSeenAndVerify(msg.from);
                if (directResult) {
                    chat = chat ?? await msg.getChat().catch(() => null);
                    return chat;
                }
                Log.log(`Direct WWebJS.sendSeen did not verify read state (attempt ${attempt}/${maxAttempts}) for ${msg.from}`);
            } catch (error) {
                Log.log(`Direct WWebJS.sendSeen failed (attempt ${attempt}/${maxAttempts}): ${(error as Error).message}`);
            }

            // 5) Last resort from docs/issues: sync history then retry direct sendSeen.
            try {
                await this.client.syncHistory(msg.from);
                const syncRetryResult = await directSendSeenAndVerify(msg.from);
                if (syncRetryResult) {
                    chat = chat ?? await msg.getChat().catch(() => null);
                    return chat;
                }
                Log.log(`syncHistory + direct sendSeen did not verify read state (attempt ${attempt}/${maxAttempts}) for ${msg.from}`);
            } catch (error) {
                Log.log(`syncHistory + direct sendSeen failed (attempt ${attempt}/${maxAttempts}): ${(error as Error).message}`);
            }

            if (attempt < maxAttempts) {
                await wait(400);
            }
        }

        Log.log('Unable to mark message as read after retries for ' + msg.from);
        return chat;
    }

    private startTypingIndicator(chat: whatsapp.Chat): () => Promise<void> {
        void chat.sendStateTyping().catch((error) => {
            Log.log('Error setting typing state: ' + (error as Error).message);
        });

        const timer = setInterval(() => {
            void chat.sendStateTyping().catch((error) => {
                Log.log('Error refreshing typing state: ' + (error as Error).message);
            });
        }, 8_000);

        return async () => {
            clearInterval(timer);
            try {
                await chat.clearState();
            } catch (error) {
                Log.log('Error clearing typing state: ' + (error as Error).message);
            }
        };
    }

    private async onMessageReceived(msg: whatsapp.Message) {
        // Ignore newsletter/channel messages
        if (msg.from.endsWith('@newsletter')) {
            return;
        }

        if (msg.from === config.whatsApp.groupChatId && msg.author) {
            await this.markMessageAsRead(msg);

            let senderId = msg.author;

            try {
                const contact = await msg.getContact();
                const contactInfo = contact as unknown as {
                    number?: string;
                };

                if (contactInfo.number?.trim()) {
                    senderId = `${contactInfo.number.trim()}@c.us`;
                }
            } catch (error) {
                Log.log('Error resolving group sender contact: ' + (error as Error).message);
            }

            this.conversation.recordFamilyGroupUserMessage(senderId, msg.body);
        }

        // Ignore group messages — only reply to private chats
        if (msg.author) {
            return;
        }

        const chat = await this.markMessageAsRead(msg);

        Log.log('MESSAGE RECEIVED:');
        Log.log('msg.from:' + msg.from);

        // Check authorization (private chat only)
        if (!config.whatsApp.users.includes(msg.from)) {
            return;
        }

        const stopTyping = chat ? this.startTypingIndicator(chat) : null;

        try {
            const reply = await this.conversation.generateReply(msg.from, msg.body);
            await this.safeReply(msg, reply);
        } catch (error) {
            Log.log('Error generating AI reply: ' + (error as Error).message);
        } finally {
            if (stopTyping) {
                await stopTyping();
            }
        }
    }

    private describeOutgoingMessage(content: whatsapp.MessageContent, options?: whatsapp.MessageSendOptions): string {
        if (typeof content === 'string') {
            return content;
        }

        if (options?.caption) {
            return `[image] ${options.caption}`;
        }

        return '[image]';
    }
}