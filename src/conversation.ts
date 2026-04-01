import moment from 'moment';

import { AiMessageGenerator } from './aiMessageGenerator';
import { Calendar, type CalendarMessageData } from './calendar';
import { ChatHistory } from './chatHistory';
import { config } from './config';
import { FamilyContext } from './familyContext';
import { Log } from './log';
import { UserSummaryStore } from './userSummaryStore';

const MAX_CALENDAR_LOOKAHEAD_DAYS = 30;
const FAMILY_GROUP_HISTORY_LIMIT = 20;
const PRIVATE_HISTORY_LIMIT = 12;
const USER_SUMMARY_MAX_LENGTH = 1200;

export class Conversation {
    private calendar = new Calendar();
    private aiMessageGenerator = new AiMessageGenerator();
    private chatHistory = new ChatHistory();
    private familyContext = new FamilyContext();
    private userSummaryStore = new UserSummaryStore();

    public async generateReply(userId: string, messageText: string): Promise<string> {
        const familyGroupContext = this.buildFamilyGroupContext();
        const familyContextSection = this.familyContext.buildPromptSection();
        const currentUserSection = this.familyContext.buildCurrentUserSection(userId);
        const userSummary = this.userSummaryStore.getSummary(userId);
        const systemPrompt = `אתה "אבא בוט" בוט וואטסאפ ידידותי של משפחה ישראלית. אתה עונה בעברית.
ענה על הודעות בצורה חמה, ידידותית וקצרה.
אם השאלה קשורה ללוח זמנים, אירועים, תאריכים, חגים, שבת או תוכניות משפחתיות, קרא קודם לכלי collect_calendar_data ורק אחר כך ענה.
אם חסר מידע מהלוח כדי לענות נכון, אל תנחש. קרא לכלי.
אם השאלה לא קשורה ללוח, ענה בצורה כללית וידידותית.
אם אפשר לענות בלי לוח השנה, אל תקרא לכלי.

היום הוא ${moment().format('YYYY-MM-DD')}.
אתה יכול לבקש נתוני לוח שנה לתאריך מסוים ולטווח מסוים של ימים.${familyContextSection ? `

${familyContextSection}` : ''}${userSummary ? `

${currentUserSection}` : currentUserSection ? `

${currentUserSection}` : ''}${userSummary ? `

סיכום פנימי על המשתמש:
${userSummary}` : ''}${familyGroupContext ? `

הקשר אחרון מקבוצת המשפחה:
${familyGroupContext}` : ''}`;

        this.chatHistory.addMessage(userId, 'user', messageText);

        const history = this.chatHistory.getHistory(userId, { limit: PRIVATE_HISTORY_LIMIT });
        const conversationMessages = history.slice(0, -1).map((entry) => ({
            role: entry.role as 'user' | 'assistant',
            content: entry.content,
        }));

        const reply = await this.aiMessageGenerator.generateMessage(messageText, systemPrompt, conversationMessages, [
            {
                tool: {
                    type: 'function',
                    function: {
                        name: 'collect_calendar_data',
                        description: 'Fetch family calendar data for a requested date and number of upcoming days.',
                        parameters: {
                            type: 'object',
                            properties: {
                                date: {
                                    type: 'string',
                                    description: 'Anchor date in YYYY-MM-DD format. Omit to use today.',
                                },
                                daysAhead: {
                                    type: 'number',
                                    description: `How many days to fetch, from 1 to ${MAX_CALENDAR_LOOKAHEAD_DAYS}.`,
                                },
                            },
                            additionalProperties: false,
                        },
                    },
                },
                execute: async (argumentsJson: string) => this.collectCalendarDataForAi(argumentsJson),
            },
        ]);

        this.chatHistory.addMessage(userId, 'assistant', reply);
        await this.updateUserSummary(userId, messageText, reply, userSummary, currentUserSection);
        return reply;
    }

    public recordFamilyGroupUserMessage(senderId: string, messageText: string): void {
        const trimmedMessage = messageText.trim();
        if (!trimmedMessage) {
            return;
        }

        this.chatHistory.addMessage(config.whatsApp.groupChatId, 'user', trimmedMessage, { senderId });
    }

    public recordFamilyGroupAssistantMessage(messageText: string): void {
        const trimmedMessage = messageText.trim();
        if (!trimmedMessage) {
            return;
        }

        this.chatHistory.addMessage(config.whatsApp.groupChatId, 'assistant', trimmedMessage, { senderId: 'aba_bot' });
    }

    private async collectCalendarDataForAi(argumentsJson: string): Promise<string> {
        try {
            const parsed = JSON.parse(argumentsJson) as { date?: string; daysAhead?: number };
            const requestedDate = parsed.date && moment(parsed.date, 'YYYY-MM-DD', true).isValid()
                ? moment(parsed.date, 'YYYY-MM-DD')
                : moment();
            const daysAhead = Math.min(MAX_CALENDAR_LOOKAHEAD_DAYS, Math.max(1, Math.floor(parsed.daysAhead ?? 7)));
            const calendarData = await this.calendar.collectData(requestedDate, {
                useCache: true,
                daysAhead,
            });

            return this.formatCalendarDataForAi(calendarData, daysAhead);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Log.log('Error collecting calendar data for AI: ' + errorMessage);
            return JSON.stringify({ error: errorMessage });
        }
    }

    private formatCalendarDataForAi(calendarData: CalendarMessageData, daysAhead: number): string {
        const upcomingDays = calendarData.upcomingDays.map((day) => {
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

        let todayContext = `תאריך עברי: ${calendarData.heDate}\n`;
        todayContext += `תאריך לועזי: ${calendarData.formattedDate}\n`;

        if (calendarData.holiday) {
            todayContext += `חג/מועד: ${calendarData.holiday}\n`;
        }

        if (calendarData.sabbathTime) {
            if (calendarData.sabbathTime['Parsha']) {
                todayContext += `פרשת השבוע: ${calendarData.sabbathTime['Parsha']}\n`;
            }
            todayContext += `הדלקת נרות: ${calendarData.sabbathTime['CandleLightingTime'].format('HH:mm')}\n`;
            todayContext += `צאת שבת: ${calendarData.sabbathTime['HavdalahTime'].format('HH:mm')}\n`;
        }

        return [
            `נתוני לוח שנה ל-${daysAhead} ימים:`,
            '',
            'מידע על היום:',
            todayContext.trim(),
            '',
            'ימים קרובים:',
            upcomingDays,
        ].join('\n');
    }

    private buildFamilyGroupContext(): string {
        const familyGroupHistory = this.chatHistory.getHistory(config.whatsApp.groupChatId, {
            limit: FAMILY_GROUP_HISTORY_LIMIT,
        });

        if (familyGroupHistory.length === 0) {
            return '';
        }

        return familyGroupHistory.map((entry) => {
            const senderName = entry.role === 'assistant'
                ? 'אבא בוט'
                : this.familyContext.resolveMemberName(entry.senderId) ?? entry.senderId ?? 'משתמש';

            return `${senderName}: ${entry.content}`;
        }).join('\n');
    }

    private async updateUserSummary(
        userId: string,
        messageText: string,
        reply: string,
        previousSummary: string,
        currentUserSection: string
    ): Promise<void> {
        try {
            const summaryPrompt = [
                'עדכן סיכום פנימי קצר על המשתמש עבור בוט משפחתי.',
                'הסיכום מיועד רק למערכת ולא יוצג למשתמש.',
                'שמור רק מידע יציב ושימושי: העדפות, בני משפחה רלוונטיים, נושאים חוזרים, תכניות קבועות והקשר מתמשך.',
                'אל תנחש. אל תכתוב תכונות אופי ספקולטיביות. אל תוסיף פרטים שלא נתמכים בשיחה.',
                'אם יש זיהוי מפורש של המשתמש מתוך נתוני המשפחה, השתמש בו ואל תכתוב שאין מידע על השם שלו.',
                'אם אין מידע יציב, החזר מחרוזת ריקה.',
                'החזר טקסט קצר בלבד, עד 6 שורות.',
                '',
                'זיהוי המשתמש הנוכחי:',
                currentUserSection || '(לא ידוע)',
                '',
                'סיכום קודם:',
                previousSummary || '(ריק)',
                '',
                'הודעת המשתמש האחרונה:',
                messageText,
                '',
                'תשובת הבוט האחרונה:',
                reply,
            ].join('\n');

            const updatedSummary = await this.aiMessageGenerator.generateMessage(
                summaryPrompt,
                'אתה מעדכן זיכרון פנימי תמציתי על משתמש. החזר רק את הסיכום החדש ללא הקדמה.',
            );

            this.userSummaryStore.setSummary(userId, updatedSummary.slice(0, USER_SUMMARY_MAX_LENGTH));
        } catch (error) {
            Log.log('Error updating user summary: ' + (error as Error).message);
        }
    }
}