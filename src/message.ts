import moment from 'moment';

import { AiMessageGenerator } from './aiMessageGenerator';
import { Calendar, CalendarMessageData } from './calendar';

export class Message {
    private calendar = new Calendar();
    private aiMessageGenerator = new AiMessageGenerator();

    async generateMessage(date?: moment.MomentInput, useAI: boolean = true): Promise<string> {
        const data = await this.calendar.collectData(date, {
            useCache: false,
            daysAhead: 1,
        });

        if (useAI) {
            return this.buildMessageWithAI(data);
        }
        return this.buildMessage(data);
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

    private async buildMessageWithAI(data: CalendarMessageData): Promise<string> {
        const systemPrompt = `אתה בוט וואטסאפ ידידותי ששולח הודעות בוקר יומיות בעברית לקבוצה משפחתית.
צור הודעת בוקר חמה ומעניינת על בסיס המידע שתקבל.
השתמש באימוג'ים בצורה טבעית.
שמור על הפורמט הבא: תאריך עברי ולועזי, חג (אם יש), זמני שבת (אם יש), אירועים (אם יש), וברכת יום טוב.
הוסף משפט מעניין או ציטוט קצר שמתאים ליום.`;

        let prompt = `הנה המידע להודעת הבוקר של היום:\n`;
        prompt += `תאריך עברי: ${data.heDate}\n`;
        prompt += `תאריך לועזי: ${data.formattedDate}\n`;
        if (data.holiday) prompt += `חג/מועד: ${data.holiday}\n`;
        if (data.sabbathTime) {
            if (data.sabbathTime['Parsha']) prompt += `פרשת השבוע: ${data.sabbathTime['Parsha']}\n`;
            prompt += `הדלקת נרות: ${data.sabbathTime['CandleLightingTime'].format('HH:mm')}\n`;
            prompt += `צאת שבת: ${data.sabbathTime['HavdalahTime'].format('HH:mm')}\n`;
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

        return this.aiMessageGenerator.generateMessage(prompt, systemPrompt);
    }
}