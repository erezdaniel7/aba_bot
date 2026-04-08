import fs from 'fs';
import path from 'path';

import { config } from './config';
import { Log } from './log';

const RECENT_NOTE_PATTERN = /לאחרונה|בזמן האחרון|השבוע|היום|אתמול|כעת|כרגע|עכשיו|דיבר לאחרונה|שאל לאחרונה|עסוק בימים אלו/i;
const IGNORE_SUMMARY_LINE_PATTERN = /^(אין\s+מידע\s+נוסף|אין\s+שינוי|ללא\s+שינוי)$/i;
const MAX_STORED_STABLE_FACTS = 6;
const MAX_STORED_RECENT_NOTES = 3;
const MAX_OUTPUT_STABLE_FACTS = 4;
const MAX_OUTPUT_RECENT_NOTES = 2;

export interface UserSummaryRecord {
    stableFacts: string[];
    recentNotes: string[];
    updatedAt: number;
}

interface LegacyUserSummaryRecord {
    summary: string;
    updatedAt: number;
}

function normalizeComparisonKey(line: string): string {
    return line
        .trim()
        .toLowerCase()
        .replace(/["'`׳״.,:;!?()\-]/g, '')
        .replace(/\s+/g, ' ');
}

function dedupeLines(lines: string[]): string[] {
    const uniqueLines = new Map<string, string>();

    for (const line of lines) {
        const normalizedLine = line.trim();
        if (!normalizedLine || IGNORE_SUMMARY_LINE_PATTERN.test(normalizedLine)) {
            continue;
        }

        const key = normalizeComparisonKey(normalizedLine);
        if (uniqueLines.has(key)) {
            uniqueLines.delete(key);
        }
        uniqueLines.set(key, normalizedLine);
    }

    return Array.from(uniqueLines.values());
}

function getStableFactBucket(line: string): string | null {
    const normalizedLine = normalizeComparisonKey(line);

    const preferenceMatch = normalizedLine.match(/(?:לא\s+)?(?:אוהב|אוהבת|מעדיף|מעדיפה)\s+(.+)/);
    if (preferenceMatch?.[1]) {
        return `preference:${preferenceMatch[1].trim()}`;
    }

    if (/תלמיד|לומד|לומדת|בישיבה|בחטיבה|בתיכון|בבית ספר|בגן/.test(normalizedLine)) {
        return 'education';
    }

    if (/עובד|עובדת|מנהל|מנהלת|מורה|מהנדס|מהנדסת/.test(normalizedLine)) {
        return 'occupation';
    }

    if (/גר|גרה|מתגורר|מתגוררת/.test(normalizedLine)) {
        return 'residence';
    }

    return null;
}

function mergeStableFacts(previousFacts: string[], incomingFacts: string[]): string[] {
    const mergedFacts = [...previousFacts];

    for (const incomingFact of incomingFacts) {
        const bucket = getStableFactBucket(incomingFact);
        const normalizedIncomingFact = normalizeComparisonKey(incomingFact);

        if (bucket) {
            for (let index = mergedFacts.length - 1; index >= 0; index--) {
                const existingFact = mergedFacts[index];
                if (normalizeComparisonKey(existingFact) === normalizedIncomingFact) {
                    continue;
                }

                if (getStableFactBucket(existingFact) === bucket) {
                    mergedFacts.splice(index, 1);
                }
            }
        }

        mergedFacts.push(incomingFact);
    }

    return dedupeLines(mergedFacts).slice(-MAX_STORED_STABLE_FACTS);
}

function splitSummaryLines(summary: string): string[] {
    return summary
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !IGNORE_SUMMARY_LINE_PATTERN.test(line));
}

export function classifySummaryText(summary: string): Omit<UserSummaryRecord, 'updatedAt'> {
    const stableFacts: string[] = [];
    const recentNotes: string[] = [];

    for (const line of splitSummaryLines(summary)) {
        if (RECENT_NOTE_PATTERN.test(line)) {
            recentNotes.push(line);
        } else {
            stableFacts.push(line);
        }
    }

    return {
        stableFacts: dedupeLines(stableFacts).slice(-MAX_STORED_STABLE_FACTS),
        recentNotes: dedupeLines(recentNotes).slice(-MAX_STORED_RECENT_NOTES),
    };
}

export function mergeStructuredSummary(
    previous: Pick<UserSummaryRecord, 'stableFacts' | 'recentNotes'> | undefined,
    incomingSummary: string,
): Omit<UserSummaryRecord, 'updatedAt'> {
    const incoming = classifySummaryText(incomingSummary);

    return {
        stableFacts: mergeStableFacts(previous?.stableFacts ?? [], incoming.stableFacts),
        recentNotes: dedupeLines([
            ...(previous?.recentNotes ?? []),
            ...incoming.recentNotes,
        ]).slice(-MAX_STORED_RECENT_NOTES),
    };
}

export function formatStructuredSummary(summary: Pick<UserSummaryRecord, 'stableFacts' | 'recentNotes'>): string {
    return [
        ...summary.stableFacts.slice(-MAX_OUTPUT_STABLE_FACTS),
        ...summary.recentNotes.slice(-MAX_OUTPUT_RECENT_NOTES),
    ].join('\n').trim();
}

export class UserSummaryStore {
    private summaries = new Map<string, UserSummaryRecord>();
    private readonly filePath: string;

    constructor(filePath: string = config.conversation.userSummariesFilePath) {
        this.filePath = filePath;
        this.load();
    }

    public getSummary(userId: string): string {
        const record = this.summaries.get(userId);
        return record ? formatStructuredSummary(record) : '';
    }

    public getUpdatedAt(userId: string): number | undefined {
        return this.summaries.get(userId)?.updatedAt;
    }

    public setSummary(userId: string, summary: string): void {
        const normalizedSummary = summary.trim();
        if (!normalizedSummary) {
            this.summaries.delete(userId);
            this.save();
            return;
        }

        const existingRecord = this.summaries.get(userId);
        const mergedRecord = mergeStructuredSummary(existingRecord, normalizedSummary);

        if (mergedRecord.stableFacts.length === 0 && mergedRecord.recentNotes.length === 0) {
            this.summaries.delete(userId);
            this.save();
            return;
        }

        this.summaries.set(userId, {
            ...mergedRecord,
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
            const parsed = JSON.parse(raw) as Record<string, UserSummaryRecord | LegacyUserSummaryRecord>;

            for (const [userId, value] of Object.entries(parsed)) {
                if (!value || typeof value.updatedAt !== 'number') {
                    continue;
                }

                if (Array.isArray((value as UserSummaryRecord).stableFacts) || Array.isArray((value as UserSummaryRecord).recentNotes)) {
                    const record = value as UserSummaryRecord;
                    const stableFacts = dedupeLines(record.stableFacts ?? []).slice(-MAX_STORED_STABLE_FACTS);
                    const recentNotes = dedupeLines(record.recentNotes ?? []).slice(-MAX_STORED_RECENT_NOTES);

                    if (stableFacts.length === 0 && recentNotes.length === 0) {
                        continue;
                    }

                    this.summaries.set(userId, {
                        stableFacts,
                        recentNotes,
                        updatedAt: record.updatedAt,
                    });
                    continue;
                }

                if (typeof (value as LegacyUserSummaryRecord).summary === 'string') {
                    const legacyRecord = value as LegacyUserSummaryRecord;
                    const mergedRecord = classifySummaryText(legacyRecord.summary);

                    if (mergedRecord.stableFacts.length === 0 && mergedRecord.recentNotes.length === 0) {
                        continue;
                    }

                    this.summaries.set(userId, {
                        ...mergedRecord,
                        updatedAt: legacyRecord.updatedAt,
                    });
                }
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