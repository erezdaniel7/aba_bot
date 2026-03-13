import * as whatsapp from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { Subject } from 'rxjs';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { config } from './config';
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

export class WhatsApp {
    private client!: whatsapp.Client;
    private isReady$: Subject<boolean>;

    constructor() {
        this.isReady$ = new Subject<boolean>();
        this.init();
    }

    private init() {
        const chromePath = getChromePath();

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
        });

        this.client.on('disconnected', (reason: string) => {
            Log.log('WhatsApp disconnected: ' + reason);
        });

        this.client.on('qr', (qr: string) => {
            // Generate and scan this code with your phone
            Log.log('QR RECEIVED' + qr);
            qrcode.generate(qr, { small: true });
        });

        this.client.on('ready', async () => {
            this.isReady$.next(true);
            this.isReady$.complete();
            Log.log('Whatsapp Client is ready!');
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

                // Periodic check to see what's happening
                const checkInterval = setInterval(async () => {
                    try {
                        const url = page.url();
                        const title = await page.title();
                        Log.log(`Page check - URL: ${url}, Title: ${title}`);
                    } catch (e) {
                        Log.log('Page check failed: ' + (e as Error).message);
                        clearInterval(checkInterval);
                    }
                }, 10000);

                // Clear interval once ready
                this.isReady$.subscribe({ complete: () => clearInterval(checkInterval) });
            }
        }).catch((error) => {
            Log.log('Failed to initialize WhatsApp client: ' + (error as Error).message);
        });
    }

    public async sendMessage(chatId: string, content: whatsapp.MessageContent, options?: whatsapp.MessageSendOptions): Promise<whatsapp.Message | null> {
        await this.isReady$.toPromise();
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
        // Mark the message as read
        try {
            const chat = await msg.getChat();
            await chat.sendSeen();
        } catch (error) {
            Log.log('Error marking message as read: ' + (error as Error).message);
        }

        Log.log('MESSAGE RECEIVED:');
        Log.log('msg.author:' + msg.author);
        Log.log('msg.from:' + msg.from);

        // Check authorization
        let isAuthorized = false;

        if (msg.author) {
            // Group message - get the contact's phone number to check authorization
            const contact = await msg.getContact();
            const phoneId = contact.number + '@c.us';
            isAuthorized = config.whatsApp.users.includes(phoneId);
            Log.log('Group message from: ' + phoneId + ', authorized: ' + isAuthorized);
        } else {
            // Private chat
            isAuthorized = config.whatsApp.users.includes(msg.from);
        }

        if (isAuthorized) {
            // Handle all messages (both private and group)
            if (['hi', 'hello'].some(keyword => msg.body.toLowerCase().includes(keyword))) {
                await this.safeReply(msg, 'Hello!');
            }
            if (['bye', 'goodbye'].some(keyword => msg.body.toLowerCase().includes(keyword))) {
                await this.safeReply(msg, 'Goodbye!');
            }
            if (['הי', 'שלום'].some(keyword => msg.body.toLowerCase().includes(keyword))) {
                await this.safeReply(msg, 'שלום!');
            }
            if (['להתראות', 'ביי'].some(keyword => msg.body.toLowerCase().includes(keyword))) {
                await this.safeReply(msg, 'להתראות!');
            }
            let count = msg.body.toLowerCase().split('ping').length - 1;
            for (let i = 0; i < count; i++) {
                await this.safeReply(msg, 'pong \n 🏓');
            }
            count = msg.body.toLowerCase().split('פינג').length - 1;
            for (let i = 0; i < count; i++) {
                await this.safeReply(msg, 'פונג \n 🏓');
            }
        }
    }
}