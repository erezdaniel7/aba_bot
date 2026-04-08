import fs from 'fs';
import path from 'path';

import { config } from './config';
import { Log } from './log';

const MAX_DAILY_MESSAGE_METRICS = 50;

interface DailyMessageMetric {
    timestamp: number;
    opener: string;
    repeated: boolean;
}

interface AiMetricsData {
    dailyMessages: DailyMessageMetric[];
    summaryUpdates: Record<string, number>;
}

function extractMessageOpener(message: string): string {
    return message
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0)?.slice(0, 120) ?? '';
}

export class AiMetrics {
    private readonly filePath = config.conversation.aiMetricsFilePath;
    private data: AiMetricsData = {
        dailyMessages: [],
        summaryUpdates: {},
    };

    constructor() {
        this.load();
    }

    public recordDailyMessage(message: string): void {
        const opener = extractMessageOpener(message);
        if (!opener) {
            return;
        }

        const repeated = this.data.dailyMessages
            .slice(-5)
            .some((entry) => entry.opener === opener);

        this.data.dailyMessages.push({
            timestamp: Date.now(),
            opener,
            repeated,
        });
        this.data.dailyMessages = this.data.dailyMessages.slice(-MAX_DAILY_MESSAGE_METRICS);
        this.save();
    }

    public recordSummaryUpdate(kind: 'user' | 'entity', decision: 'skipped' | 'updated' | 'no-change' | 'error'): void {
        const key = `${kind}:${decision}`;
        this.data.summaryUpdates[key] = (this.data.summaryUpdates[key] ?? 0) + 1;
        this.save();
    }

    private load(): void {
        if (!fs.existsSync(this.filePath)) {
            return;
        }

        try {
            const raw = fs.readFileSync(this.filePath, 'utf8');
            const parsed = JSON.parse(raw) as Partial<AiMetricsData>;

            this.data = {
                dailyMessages: Array.isArray(parsed.dailyMessages) ? parsed.dailyMessages : [],
                summaryUpdates: parsed.summaryUpdates && typeof parsed.summaryUpdates === 'object'
                    ? parsed.summaryUpdates as Record<string, number>
                    : {},
            };
        } catch (error) {
            Log.log('Failed to load AI metrics: ' + (error as Error).message);
        }
    }

    private save(): void {
        try {
            path.dirname(this.filePath) && fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
        } catch (error) {
            Log.log('Failed to save AI metrics: ' + (error as Error).message);
        }
    }
}
