import fs from 'fs';
import path from 'path';

import { config } from './config';
import { Log } from './log';

export interface ChatEntry {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    senderId?: string;
}

const HISTORY_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
const MIN_HISTORY_ENTRIES = 10;

export class ChatHistory {

    private history: Map<string, ChatEntry[]> = new Map();

    constructor() {
        this.load();
        this.cleanupAll();
    }

    addMessage(userId: string, role: 'user' | 'assistant', content: string, options?: { senderId?: string }): void {
        if (!this.history.has(userId)) {
            this.history.set(userId, []);
        }
        this.history.get(userId)!.push({
            role,
            content,
            timestamp: Date.now(),
            senderId: options?.senderId,
        });
        this.cleanup(userId);
        this.save();
    }

    getHistory(userId: string, options?: { limit?: number }): ChatEntry[] {
        this.cleanup(userId);

        const entries = this.history.get(userId) ?? [];
        if (!options?.limit || entries.length <= options.limit) {
            return entries;
        }

        return entries.slice(-options.limit);
    }

    private cleanup(userId: string): void {
        const entries = this.history.get(userId);
        if (!entries) return;

        const cutoff = Date.now() - HISTORY_TTL_MS;
        const filtered = entries.filter(e => e.timestamp >= cutoff);
        const retainedEntries = filtered.length >= MIN_HISTORY_ENTRIES
            ? filtered
            : entries.slice(-MIN_HISTORY_ENTRIES);

        if (retainedEntries.length === 0) {
            this.history.delete(userId);
        } else {
            this.history.set(userId, retainedEntries);
        }
    }

    private cleanupAll(): void {
        for (const userId of this.history.keys()) {
            this.cleanup(userId);
        }
        this.save();
    }

    private load(): void {
        const filePath = config.conversation.chatHistoryFilePath;
        if (!fs.existsSync(filePath)) {
            return;
        }

        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(raw) as Record<string, ChatEntry[]>;

            for (const [userId, entries] of Object.entries(parsed)) {
                if (!Array.isArray(entries)) {
                    continue;
                }

                const normalizedEntries = entries
                    .filter((entry) => {
                        return entry
                            && (entry.role === 'user' || entry.role === 'assistant')
                            && typeof entry.content === 'string'
                            && typeof entry.timestamp === 'number';
                    })
                    .map((entry) => ({
                        role: entry.role,
                        content: entry.content,
                        timestamp: entry.timestamp,
                        senderId: typeof entry.senderId === 'string' ? entry.senderId : undefined,
                    }));

                if (normalizedEntries.length > 0) {
                    this.history.set(userId, normalizedEntries);
                }
            }
        } catch (error) {
            Log.log('Failed to load chat history: ' + (error as Error).message);
        }
    }

    private save(): void {
        const filePath = config.conversation.chatHistoryFilePath;

        try {
            path.dirname(filePath) && fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(Object.fromEntries(this.history), null, 2), 'utf8');
        } catch (error) {
            Log.log('Failed to save chat history: ' + (error as Error).message);
        }
    }
}
