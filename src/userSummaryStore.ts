import fs from 'fs';
import path from 'path';

import { config } from './config';
import { Log } from './log';

interface UserSummaryRecord {
    summary: string;
    updatedAt: number;
}

export class UserSummaryStore {
    private summaries = new Map<string, UserSummaryRecord>();
    private readonly filePath = config.conversation.userSummariesFilePath;

    constructor() {
        this.load();
    }

    public getSummary(userId: string): string {
        return this.summaries.get(userId)?.summary ?? '';
    }

    public setSummary(userId: string, summary: string): void {
        const normalizedSummary = summary.trim();
        if (!normalizedSummary) {
            this.summaries.delete(userId);
            this.save();
            return;
        }

        this.summaries.set(userId, {
            summary: normalizedSummary,
            updatedAt: Date.now(),
        });
        this.save();
    }

    private load(): void {
        if (!fs.existsSync(this.filePath)) {
            return;
        }

        try {
            const raw = fs.readFileSync(this.filePath, 'utf8');
            const parsed = JSON.parse(raw) as Record<string, UserSummaryRecord>;

            for (const [userId, value] of Object.entries(parsed)) {
                if (!value || typeof value.summary !== 'string' || typeof value.updatedAt !== 'number') {
                    continue;
                }

                const normalizedSummary = value.summary.trim();
                if (!normalizedSummary) {
                    continue;
                }

                this.summaries.set(userId, {
                    summary: normalizedSummary,
                    updatedAt: value.updatedAt,
                });
            }
        } catch (error) {
            Log.log('Failed to load user summaries: ' + (error as Error).message);
        }
    }

    private save(): void {
        try {
            path.dirname(this.filePath) && fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
            fs.writeFileSync(this.filePath, JSON.stringify(Object.fromEntries(this.summaries), null, 2), 'utf8');
        } catch (error) {
            Log.log('Failed to save user summaries: ' + (error as Error).message);
        }
    }
}