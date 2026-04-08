import moment from 'moment';

import { buildDailyVariationInstructions, buildRecentDailyMemorySection } from './aiBehavior';
import { AiMessageGenerator } from './aiMessageGenerator';
import { AiMetrics } from './aiMetrics';
import { Calendar, CalendarMessageData } from './calendar';
import { ChatHistory } from './chatHistory';
import { config } from './config';
import { FamilyContext } from './familyContext';

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

        const message = useAI
            ? await this.buildMessageWithAI(data)
            : this.buildMessage(data);

        this.aiMetrics.recordDailyMessage(message);
        return message;
    }

    private buildMessage(data: CalendarMessageData): string {
        let message = '';

        message = data.heDate + ' ' + data.formattedDate + '\n';
        if (data.holiday) message += '✡' + data.holiday + '✡\n';
        message += '\n';

        if (data.sabbathTime) {
            if (data.sabbathTime['Parsha']) message += '📜' + data.sabbathTime['Parsha'] + '📜' + "\n";
            message += '🕯הדלקת נרות: ' + data.sabbathTime['CandleLightingTime'].format('HH:mm') + '🕯' + "\n" +
                '🌟צאת שבת: ' + data.sabbathTime['HavdalahTime'].format('HH:mm') + '🌟' + "\n\n";
        }

        if (data.events.length === 0) {
            message += "אין אירועים היום! 🎉🎉";
        }
        else {
            message += "📅בוקר טוב! הנה האירועים של היום:\n";
            message += data.events.map((event) => {
                return '🔹' + (event.datetype === 'date' ? '' : moment(event.start).format('HH:mm') + ' - ') + event.summary;
            }).join('\n');
        }

        if (data.sabbathTime && data.tomorrowEvents.length > 0) {
            message += '\n\n📅 ואלו של מחר:\n';
            message += data.tomorrowEvents.map((event) => {
                return '🔹' + (event.datetype === 'date' ? '' : moment(event.start).format('HH:mm') + ' - ') + event.summary;
            }).join('\n');
        }

        message += '\n\nזיכרו! ההודעה הזו קבועה אבל היומן תמיד מעודכן!! 😎';

        message += '\n\nשיהיה לכם יום נהדר! 🌞';

        return message;
    }

    private getRecentDailyMemorySection(): string {
        const chatHistory = new ChatHistory();
        const relevantChatIds = [config.whatsApp.groupChatId, config.whatsApp.testGroupChatId]
            .filter((chatId, index, chatIds) => Boolean(chatId) && chatIds.indexOf(chatId) === index);

        const recentGroupMessages = relevantChatIds.flatMap((chatId) => {
            return chatHistory.getHistory(chatId, { limit: 20 })
                .filter((entry) => entry.role === 'assistant')
                .map((entry) => entry.content);
        });

        return buildRecentDailyMemorySection(recentGroupMessages, 3);
    }

    private async buildMessageWithAI(data: CalendarMessageData): Promise<string> {
        const familyContextSection = this.familyContext.buildPromptSection();
        const variationInstructions = buildDailyVariationInstructions(data.formattedDate);
        const recentDailyMemorySection = this.getRecentDailyMemorySection();
        const systemPrompt = `אתה "אבא בוט" בוט וואטסאפ ידידותי ששולח הודעות בוקר יומיות בעברית לקבוצה משפחתית.
זהות מחייבת: אתה תמיד מזדהה רק כ"אבא בוט".
"אבא בוט" אינו בן משפחה אנושי, ו"אבא" הוא קשר משפחתי של אדם.
לעולם אל תחתום או תתאר את עצמך כאדם מהמשפחה או כווריאציה אנושית של "אבא".
צור הודעת בוקר חמה, טבעית ומגוונת על בסיס המידע שתקבל.
השתמש באימוג'ים בצורה טבעית, אבל לא בהגזמה.
שמור על הפורמט הבא: תאריך עברי ולועזי, חג (אם יש), זמני שבת (אם יש), אירועים (אם יש), וברכת יום טוב.
הוסף משפט מעניין או ציטוט קצר שמתאים ליום.
אל תחזור על אותה פתיחה, אותה ברכה או אותו רעיון פעמיים באותה הודעה או ימים רבים ברצף.
אם אין אירועים היום, העדף ניסוח קצר ורענן במקום טקסט ממלא.${recentDailyMemorySection ? `

${recentDailyMemorySection}` : ''}${variationInstructions ? `

${variationInstructions}` : ''}${familyContextSection ? `

${familyContextSection}` : ''}`;

        let prompt = `הנה המידע להודעת הבוקר של היום:\n`;
        prompt += `תאריך עברי: ${data.heDate}\n`;
        prompt += `תאריך לועזי: ${data.formattedDate}\n`;
        if (data.holiday) prompt += `חג/מועד: ${data.holiday}\n`;
        if (data.sabbathTime) {
            if (data.sabbathTime['Parsha']) prompt += `פרשת השבוע: ${data.sabbathTime['Parsha']}\n`;
            prompt += `הדלקת נרות: ${data.sabbathTime['CandleLightingTime'].format('HH:mm')}\n`;
            prompt += `הבדלה: ${data.sabbathTime['HavdalahTime'].format('HH:mm')}\n`;
        }
        if (data.events.length === 0) {
            prompt += `אין אירועים היום.\n`;
        } else {
            prompt += `אירועים היום:\n`;
            prompt += data.events.map((event) => {
                return '- ' + (event.datetype === 'date' ? '' : moment(event.start).format('HH:mm') + ' - ') + event.summary;
            }).join('\n') + '\n';
        }
        if (data.tomorrowEvents.length > 0) {
            prompt += `אירועים מחר:\n`;
            prompt += data.tomorrowEvents.map((event) => {
                return '- ' + (event.datetype === 'date' ? '' : moment(event.start).format('HH:mm') + ' - ') + event.summary;
            }).join('\n') + '\n';
        }

        return this.aiMessageGenerator.generateMessage(prompt, systemPrompt, [], [], {
            temperature: 1.05,
            topP: 0.95,
            frequencyPenalty: 0.45,
            presencePenalty: 0.2,
            maxTokens: 420,
        });
    }
}