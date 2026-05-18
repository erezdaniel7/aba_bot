import type {
    WAMessage,
    WAMessageContent,
    WASocket,
    makeWASocket as MakeWASocket,
    useMultiFileAuthState as UseMultiFileAuthState,
    fetchLatestBaileysVersion as FetchLatestBaileysVersion,
    makeCacheableSignalKeyStore as MakeCacheableSignalKeyStore,
    getContentType as GetContentType,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import * as fs from 'fs';
import * as path from 'path';

import { config } from './config';
import { Conversation } from './conversation';
import { Log } from './log';
import { OutgoingImagePayload, OutgoingMessagePayload, WhatsAppClient } from './whatsapp.types';

// ─── Auth ────────────────────────────────────────────────────────────────────

const AUTH_DIR = path.join(__dirname, '..', 'bailey_auth');

// ─── Baileys ESM loader (singleton) ──────────────────────────────────────────
// Baileys is ESM-only; use Function-wrapping so tsc emits native import()
// instead of require(), keeping the CommonJS host intact.

type BaileysModule = {
    makeWASocket: typeof MakeWASocket;
    useMultiFileAuthState: typeof UseMultiFileAuthState;
    fetchLatestBaileysVersion: typeof FetchLatestBaileysVersion;
    makeCacheableSignalKeyStore: typeof MakeCacheableSignalKeyStore;
    getContentType: typeof GetContentType;
    DisconnectReason: Record<string, number>;
    Browsers: { ubuntu: (browser?: string) => [string, string, string] };
};

const _esmImport = new Function('m', 'return import(m)') as (m: string) => Promise<BaileysModule>;
let _baileysPromise: Promise<BaileysModule> | null = null;

function getBaileys(): Promise<BaileysModule> {
    if (!_baileysPromise) {
        _baileysPromise = _esmImport('@whiskeysockets/baileys');
    }
    return _baileysPromise;
}

// ─── Silent pino-compatible logger ───────────────────────────────────────────
// Suppresses Baileys' verbose JSON stdout; surfaces only errors through our Log.

function makeSilentLogger(): unknown {
    const noop = () => { };
    // Suppress decrypt errors from @lid messages; other errors still log
    const onError = (obj: unknown, msg?: string) => {
        const text = msg ?? (typeof obj === 'object' ? JSON.stringify(obj) : String(obj));
        if (text.includes('Bad MAC') || text.includes('failed to decrypt')) return;
        Log.log('[WA] ' + text);
    };
    const logger: Record<string, unknown> = {
        level: 'silent',
        trace: noop, debug: noop, info: noop, warn: noop,
        error: onError, fatal: onError,
    };
    logger.child = () => logger;
    return logger;
}

// ─── JID helpers ─────────────────────────────────────────────────────────────
// App-layer IDs use WhatsApp-Web.js convention (@c.us / @g.us).
// Baileys uses @s.whatsapp.net for users internally.

function toJid(appId: string): string {
    return appId.endsWith('@c.us') ? appId.replace('@c.us', '@s.whatsapp.net') : appId;
}

function toAppId(jid: string): string {
    return jid.endsWith('@s.whatsapp.net') ? jid.replace('@s.whatsapp.net', '@c.us') : jid;
}

// ─── Message helpers ──────────────────────────────────────────────────────────

function normalizeBase64(value: string): string {
    const i = value.indexOf(',');
    return i >= 0 ? value.slice(i + 1) : value;
}

function readTextBody(
    getContentType: BaileysModule['getContentType'],
    content: WAMessageContent | null | undefined,
): string {
    if (!content) return '';
    const kind = getContentType(content);
    if (!kind) return '';
    switch (kind) {
        case 'conversation': return content.conversation ?? '';
        case 'extendedTextMessage': return content.extendedTextMessage?.text ?? '';
        case 'imageMessage': return content.imageMessage?.caption ?? '';
        case 'videoMessage': return content.videoMessage?.caption ?? '';
        default: return '';
    }
}

// ─── Reconnect constants ──────────────────────────────────────────────────────

const BASE_RECONNECT_DELAY_MS = 5_000;
const MAX_RECONNECT_DELAY_MS = 300_000; // 5 min cap
const CONNECTION_REPLACED_MIN_DELAY_MS = 120_000;
const MAX_CONSECUTIVE_CONNECTION_REPLACED = 4;
const HEALTH_CHECK_INTERVAL_MS = 30_000;

// ─── WhatsApp class ───────────────────────────────────────────────────────────

export class WhatsApp implements WhatsAppClient {
    private socket: WASocket | null = null;
    private getContentType: BaileysModule['getContentType'] | null = null;

    private readyPromise!: Promise<void>;
    private readyResolve!: () => void;
    private isReady = false;
    private isRestarting = false;
    private reconnectAttempt = 0;
    private connectionState: 'connecting' | 'open' | 'close' = 'close';
    private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
    // Only reset backoff counter after being stably connected for 60s
    private stableConnectionTimer: ReturnType<typeof setTimeout> | null = null;
    // Incremented on every init(); handlers from previous sockets check this to self-discard
    private socketGeneration = 0;
    private consecutiveConnectionReplaced = 0;

    private readonly conversation = new Conversation();

    constructor() {
        this.resetReadyPromise();
        void this.init();
    }

    // ── Ready-gate ────────────────────────────────────────────────────────────

    private resetReadyPromise(): void {
        this.isReady = false;
        this.readyPromise = new Promise<void>((resolve) => {
            this.readyResolve = resolve;
        });
    }

    // ── Reconnect with exponential backoff ────────────────────────────────────

    private reconnectDelayMs(): number {
        return Math.min(
            BASE_RECONNECT_DELAY_MS * Math.pow(1.8, this.reconnectAttempt),
            MAX_RECONNECT_DELAY_MS,
        );
    }

    private async restart(reason: string): Promise<void> {
        if (this.isRestarting) return;
        this.isRestarting = true;
        this.resetReadyPromise();
        this.stopHealthCheck();
        this.terminateSocket();

        const delay = this.reconnectDelayMs();
        this.reconnectAttempt++;
        Log.log(`WhatsApp restarting (${reason}), attempt ${this.reconnectAttempt}, waiting ${Math.round(delay / 1000)}s`);

        await new Promise((r) => setTimeout(r, delay));
        this.isRestarting = false;
        await this.init();
    }

    private async restartWithMinDelay(reason: string, minDelayMs: number): Promise<void> {
        if (this.isRestarting) return;
        this.isRestarting = true;
        this.resetReadyPromise();
        this.stopHealthCheck();
        this.terminateSocket();

        const delay = Math.max(this.reconnectDelayMs(), minDelayMs);
        this.reconnectAttempt++;
        Log.log(`WhatsApp restarting (${reason}), attempt ${this.reconnectAttempt}, waiting ${Math.round(delay / 1000)}s`);

        await new Promise((r) => setTimeout(r, delay));
        this.isRestarting = false;
        await this.init();
    }

    private terminateSocket(): void {
        if (this.stableConnectionTimer) {
            clearTimeout(this.stableConnectionTimer);
            this.stableConnectionTimer = null;
        }
        try {
            // Baileys socket exposes ws.terminate() for immediate hard close
            (this.socket?.ws as { terminate?: () => void } | undefined)?.terminate?.();
        } catch { /* ignore */ }
        this.socket = null;
        this.connectionState = 'close';
    }

    // ── Health check ──────────────────────────────────────────────────────────

    private startHealthCheck(): void {
        this.stopHealthCheck();
        this.healthCheckTimer = setInterval(() => {
            if (this.isReady && !this.isRestarting && this.connectionState !== 'open') {
                void this.restart('health check: connection dropped');
            }
        }, HEALTH_CHECK_INTERVAL_MS);
    }

    private stopHealthCheck(): void {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
    }

    // ── Init ──────────────────────────────────────────────────────────────────

    private async init(): Promise<void> {
        await fs.promises.mkdir(AUTH_DIR, { recursive: true });

        const {
            makeWASocket,
            useMultiFileAuthState,
            fetchLatestBaileysVersion,
            makeCacheableSignalKeyStore,
            getContentType,
            DisconnectReason,
            Browsers,
        } = await getBaileys();

        // Cache getContentType for use in message handlers
        this.getContentType = getContentType;

        const silentLog = makeSilentLogger() as Parameters<typeof makeCacheableSignalKeyStore>[1];

        // Fetch current WA Web version — avoids "Connection Failure" from stale version
        const [{ version }, { state, saveCreds }] = await Promise.all([
            fetchLatestBaileysVersion(),
            useMultiFileAuthState(AUTH_DIR),
        ]);

        Log.log(`Connecting — WA version ${version.join('.')}`);

        const socket = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                // makeCacheableSignalKeyStore batches key reads for better performance
                keys: makeCacheableSignalKeyStore(state.keys, silentLog),
            },
            browser: Browsers.ubuntu('Chrome'),
            markOnlineOnConnect: false,
            printQRInTerminal: false,
            syncFullHistory: false,
            logger: makeSilentLogger() as Parameters<typeof makeWASocket>[0]['logger'],
            // Prevents Bad MAC decrypt errors for messages sent before this session was paired.
            // A bot only needs to read new messages, so returning undefined is correct.
            getMessage: async () => undefined,
        });

        const myGen = ++this.socketGeneration;
        this.socket = socket;
        this.connectionState = 'connecting';

        socket.ev.on('creds.update', saveCreds);

        socket.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
            // Stale socket (a new init() has since run) — ignore all events
            if (this.socketGeneration !== myGen) return;
            if (qr) {
                Log.log('QR RECEIVED — scan with WhatsApp (Linked Devices) to authenticate');
                if (process.stdout?.isTTY) {
                    qrcode.generate(qr, { small: true });
                } else {
                    Log.log('No interactive console — run once from a terminal to scan QR, then restart as service');
                }
            }

            if (connection) this.connectionState = connection;

            if (connection === 'open') {
                this.consecutiveConnectionReplaced = 0;
                this.isReady = true;
                this.readyResolve();
                Log.log('WhatsApp connected!');
                this.startHealthCheck();
                // Schedule backoff reset only after being stably connected for 60s.
                // This prevents the counter from resetting on quick connect→disconnect cycles.
                if (this.stableConnectionTimer) clearTimeout(this.stableConnectionTimer);
                this.stableConnectionTimer = setTimeout(() => {
                    this.reconnectAttempt = 0;
                    this.stableConnectionTimer = null;
                }, 60_000);
            }

            if (connection === 'close') {
                this.isReady = false;
                const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
                Log.log(`WhatsApp connection closed (code ${statusCode ?? 'unknown'})`);

                if (statusCode === DisconnectReason.loggedOut) {
                    Log.log('Logged out — clearing auth state so QR re-scan is possible');
                    void fs.promises.rm(AUTH_DIR, { recursive: true, force: true })
                        .finally(() => this.restart('logged out'));
                    return;
                }

                // restartRequired (515): emitted after QR scan; reconnect immediately with saved creds
                if (statusCode === DisconnectReason.restartRequired) {
                    this.reconnectAttempt = 0;
                    void this.restart('restart required (QR paired)');
                    return;
                }

                if (statusCode === DisconnectReason.connectionReplaced || statusCode === 440) {
                    this.consecutiveConnectionReplaced++;

                    if (this.consecutiveConnectionReplaced >= MAX_CONSECUTIVE_CONNECTION_REPLACED) {
                        Log.log('Repeated connectionReplaced (440) — clearing auth state and requiring fresh QR pair');
                        this.consecutiveConnectionReplaced = 0;
                        this.reconnectAttempt = 0;
                        void fs.promises.rm(AUTH_DIR, { recursive: true, force: true })
                            .finally(() => this.restartWithMinDelay('connection replaced repeatedly', CONNECTION_REPLACED_MIN_DELAY_MS));
                        return;
                    }

                    void this.restartWithMinDelay('connection replaced', CONNECTION_REPLACED_MIN_DELAY_MS);
                    return;
                }

                void this.restart('connection closed');
            }
        });

        socket.ev.on('messages.upsert', ({ messages, type }) => {
            if (this.socketGeneration !== myGen) return;
            if (type !== 'notify') return;
            for (const msg of messages) {
                void this.onMessageReceived(socket, msg);
            }
        });
    }

    // ── Public send ───────────────────────────────────────────────────────────

    public async sendMessage(chatId: string, payload: OutgoingMessagePayload): Promise<boolean> {
        await this.readyPromise;
        const socket = this.socket;
        if (!socket) return false;

        try {
            const jid = toJid(chatId);

            if (typeof payload === 'string') {
                await socket.sendMessage(jid, { text: payload });
            } else {
                const img = payload as OutgoingImagePayload;
                await socket.sendMessage(jid, {
                    image: Buffer.from(normalizeBase64(img.base64), 'base64'),
                    mimetype: img.mimeType ?? 'image/png',
                    ...(img.caption ? { caption: img.caption } : {}),
                });
            }

            if (chatId === config.whatsApp.groupChatId) {
                this.conversation.recordFamilyGroupAssistantMessage(this.describePayload(payload));
            }

            return true;
        } catch (error) {
            Log.log('Error sending message: ' + (error as Error).message);
            return false;
        }
    }

    // ── Incoming message handler ──────────────────────────────────────────────

    private async onMessageReceived(socket: WASocket, msg: WAMessage): Promise<void> {
        if (msg.key.fromMe) return;

        const jid = msg.key.remoteJid;
        // Skip @lid (linked identity) messages that cause decrypt errors
        if (!jid || jid.endsWith('@lid')) return;

        const isGroup = jid.endsWith('@g.us');
        const appFrom = toAppId(jid);
        const author = msg.key.participant;
        const body = this.getContentType
            ? readTextBody(this.getContentType, msg.message)
            : '';

        // Group message: record to family context, do not reply
        if (isGroup) {
            if (appFrom === config.whatsApp.groupChatId && author) {
                await this.markRead(socket, msg);
                this.conversation.recordFamilyGroupUserMessage(toAppId(author), body);
            }
            return;
        }

        // Private chat
        await this.markRead(socket, msg);
        Log.log(`MESSAGE RECEIVED from ${appFrom}`);

        if (!config.whatsApp.users.includes(appFrom)) return;

        const stopTyping = this.startTyping(socket, jid);
        try {
            const reply = await this.conversation.generateReply(appFrom, body);
            await this.reply(socket, msg, reply);
        } catch (error) {
            Log.log('Error generating reply: ' + (error as Error).message);
        } finally {
            await stopTyping();
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async reply(socket: WASocket, msg: WAMessage, text: string): Promise<void> {
        try {
            const jid = msg.key.remoteJid;
            if (!jid) return;
            await socket.sendMessage(jid, { text }, { quoted: msg });
        } catch (error) {
            Log.log('Error replying: ' + (error as Error).message);
        }
    }

    private async markRead(socket: WASocket, msg: WAMessage): Promise<void> {
        try {
            await socket.readMessages([msg.key]);
        } catch (error) {
            Log.log('Error marking as read: ' + (error as Error).message);
        }
    }

    private startTyping(socket: WASocket, jid: string): () => Promise<void> {
        void socket.sendPresenceUpdate('composing', jid).catch(() => { });
        const timer = setInterval(
            () => void socket.sendPresenceUpdate('composing', jid).catch(() => { }),
            8_000,
        );
        return async () => {
            clearInterval(timer);
            await socket.sendPresenceUpdate('paused', jid).catch(() => { });
        };
    }

    private describePayload(payload: OutgoingMessagePayload): string {
        if (typeof payload === 'string') return payload;
        return payload.caption ? `[image] ${payload.caption}` : '[image]';
    }
}
