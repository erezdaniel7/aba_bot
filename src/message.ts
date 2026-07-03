import moment from 'moment';

import { AiMessageGenerator } from './aiMessageGenerator';
import { AiMetrics } from './aiMetrics';
import { Calendar, CalendarMessageData } from './calendar';
import { FamilyContext } from './familyContext';
import { Log } from './log';

interface DailyEventExtras {
    wishes: Record<number, string>;
    messageExtension: string;
}

export class Message {
    private calendar = new Calendar();
    private aiMessageGenerator = new AiMessageGenerator();
    private aiMetrics = new AiMetrics();
    private familyContext = new FamilyContext();

    async generateMessage(date?: moment.MomentInput, useAI: boolean = true): Promise<string> {
        const data = await this.calendar.collectData(date, {
            useCache: false,
            daysAhead: 1,
        });

        const message = await this.buildMessage(data, useAI);

        this.aiMetrics.recordDailyMessage(message);
        return message;
    }

    private async buildMessage(data: CalendarMessageData, useAI: boolean): Promise<string> {
        const sections: string[] = [];

        sections.push(`📅 ${data.heDate} | ${data.formattedDate}`);

        if (data.sabbathTime?.['Parsha']) {
            sections.push(`📖 פרשת השבוע: ${data.sabbathTime['Parsha']}`);
        }

        if (data.sabbathTime) {
            sections.push(
                `🕯️ הדלקת נרות ${data.sabbathTime['CandleLightingTime'].format('HH:mm')} | צאת שבת ${data.sabbathTime['HavdalahTime'].format('HH:mm')}`
            );
        }

        if (data.holiday) {
            sections.push(`✡️ ${data.holiday}`);
        }

        const extras = useAI
            ? await this.generateEventExtras(data)
            : { wishes: {}, messageExtension: '' } as DailyEventExtras;

        if (data.events.length === 0) {
            sections.push('אין אירועים היום.');
        } else {
            const eventLines = data.events.map((event, index) => {
                const wish = extras.wishes[index + 1];
                const wishSuffix = wish ? ` - ${wish}` : '';
                return `🔹 ${this.formatEventLine(event)}${wishSuffix}`;
            });
            sections.push(['📌 אירועים:', ...eventLines].join('\n'));
        }

        if (data.sabbathTime && data.tomorrowEvents.length > 0) {
            const tomorrowLines = data.tomorrowEvents.map((event) => `🔹 ${this.formatEventLine(event)}`);
            sections.push(['📆 אירועי מחר:', ...tomorrowLines].join('\n'));
        }

        if (extras.messageExtension) {
            sections.push(extras.messageExtension);
        }

        return sections.join('\n\n');
    }

    private normalizeEventSummary(summary: string): string {
        return summary
            .replace(/\s+/g, ' ')
            .replace(/[!]{2,}/g, '!')
            .trim();
    }

    private formatEventLine(event: CalendarMessageData['events'][number]): string {
        const eventSummary = this.normalizeEventSummary(event.summary ?? 'אירוע');

        if (event.datetype === 'date') {
            return eventSummary;
        }

        return `${moment(event.start).format('HH:mm')} - ${eventSummary}`;
    }

    private async generateEventExtras(data: CalendarMessageData): Promise<DailyEventExtras> {
        const emptyExtras: DailyEventExtras = { wishes: {}, messageExtension: '' };

        const eventsList = data.events.length > 0
            ? data.events.map((event, index) => `${index + 1}. ${this.formatEventLine(event)}`).join('\n')
            : 'אין אירועים היום.';

        const familyContextSection = this.familyContext.buildPromptSection();
        const systemPrompt = `אתה "אבא בוט", בוט משפחתי שמכין את החלקים האנושיים של הודעת בוקר יומית בעברית.
מבנה ההודעה קבוע ונבנה אוטומטית, ולכן עליך להוסיף אך ורק שני דברים, בעברית תקינה ובטון חם וקצר:
1. "wishes": ברכה קצרה לאירועים שבאמת מתאימים לה (למשל "בהצלחה", "מזל טוב", "רפואה שלמה", "נסיעה טובה"). מותר לשלב אימוג'י בודד ומתאים בברכה אם הוא תורם. אם אירוע לא דורש ברכה, אל תכלול אותו כלל. אם אין אירועים, החזר אובייקט ריק.
2. "messageExtension": משפט סיום קצר אחד (עד כ-20 מילים) שמסיים את ההודעה בחום. זה יכול להיות משהו שקשור לאירועי היום, אנקדוטה קצרה שקשורה לאירועים או למשפחה, או פשוט ברכת בוקר טוב. תמיד החזר כאן טקסט לא ריק. מותר לשלב אימוג'ים בודדים ומתאימים.
אל תמציא אירועים, שעות או פרטים. אל תגזים באימוג'ים. אל תחזור על שם האירוע בתוך הברכה.
החזר JSON תקין בלבד, ללא טקסט נוסף, במבנה המדויק:
{"wishes": {"<מספר האירוע>": "<הברכה>"}, "messageExtension": "<משפט סיום>"}${familyContextSection ? `

${familyContextSection}` : ''}`;

        const prompt = `אירועי היום:\n${eventsList}\n\nהחזר JSON בלבד לפי ההנחיות.`;

        try {
            const raw = await this.aiMessageGenerator.generateMessage(prompt, systemPrompt, [], [], {
                temperature: 0.7,
                topP: 0.9,
                maxTokens: 250,
            });

            return this.parseEventExtras(raw, data.events.length);
        } catch (error) {
            Log.log('Failed to generate daily event extras: ' + (error as Error).message);
            return emptyExtras;
        }
    }

    private parseEventExtras(raw: string, eventCount: number): DailyEventExtras {
        const emptyExtras: DailyEventExtras = { wishes: {}, messageExtension: '' };

        const jsonText = this.extractJsonObject(raw);
        if (!jsonText) {
            return emptyExtras;
        }

        try {
            const parsed = JSON.parse(jsonText) as { wishes?: unknown; messageExtension?: unknown };
            const wishes: Record<number, string> = {};

            if (parsed.wishes && typeof parsed.wishes === 'object') {
                for (const [key, value] of Object.entries(parsed.wishes as Record<string, unknown>)) {
                    const index = Number(key);
                    if (
                        Number.isInteger(index) &&
                        index >= 1 &&
                        index <= eventCount &&
                        typeof value === 'string' &&
                        value.trim()
                    ) {
                        wishes[index] = value.trim();
                    }
                }
            }

            const messageExtension = typeof parsed.messageExtension === 'string'
                ? parsed.messageExtension.trim()
                : '';

            return { wishes, messageExtension };
        } catch (error) {
            Log.log('Failed to parse daily event extras JSON: ' + (error as Error).message);
            return emptyExtras;
        }
    }

    private extractJsonObject(raw: string): string | null {
        if (!raw) {
            return null;
        }

        const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const candidate = fenced ? fenced[1] : raw;
        const start = candidate.indexOf('{');
        const end = candidate.lastIndexOf('}');

        if (start === -1 || end === -1 || end <= start) {
            return null;
        }

        return candidate.slice(start, end + 1);
    }
}