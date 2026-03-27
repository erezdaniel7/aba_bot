export interface ChatEntry {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

const HISTORY_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

export class ChatHistory {

    private history: Map<string, ChatEntry[]> = new Map();

    addMessage(userId: string, role: 'user' | 'assistant', content: string): void {
        if (!this.history.has(userId)) {
            this.history.set(userId, []);
        }
        this.history.get(userId)!.push({ role, content, timestamp: Date.now() });
        this.cleanup(userId);
    }

    getHistory(userId: string): ChatEntry[] {
        this.cleanup(userId);
        return this.history.get(userId) ?? [];
    }

    private cleanup(userId: string): void {
        const entries = this.history.get(userId);
        if (!entries) return;

        const cutoff = Date.now() - HISTORY_TTL_MS;
        const filtered = entries.filter(e => e.timestamp >= cutoff);

        if (filtered.length === 0) {
            this.history.delete(userId);
        } else {
            this.history.set(userId, filtered);
        }
    }
}
