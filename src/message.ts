import moment from 'moment';

import { ShabbatHug } from './heDate/shabbatHug';
import { Calendar } from "./calendar";

const HeDate = require('./heDate/heDate');
function getJwishHoliday(e: any) { switch (e.getMonth()) { case 1: if (e.getDate() == 1 || e.getDate() == 2) return "ראש השנה"; else if (e.getDate() == 3 && e.getDay() != 7) return "צום גדליה"; else if (e.getDate() == 4 && e.getDay() == 1) return "צום גדליה (נדחה)"; else if (e.getDate() == 9) return "ערב יום כיפור"; else if (e.getDate() == 10) return "יום כיפור"; else if (e.getDate() == 14) return "ערב סוכות"; else if (e.getDate() == 15) return "סוכות"; else if (e.getDate() == 16) return "א' חוה\"מ"; else if (e.getDate() == 17) return "ב' חוה\"מ"; else if (e.getDate() == 18) return "ג' חוה\"מ"; else if (e.getDate() == 19) return "ד' חוה\"מ"; else if (e.getDate() == 20) return "ה' חוה\"מ"; else if (e.getDate() == 21) return "הושענא רבה"; else if (e.getDate() == 22) return "שמיני עצרת ושמחת תורה"; break; case 2: if (e.getYear() > 5757 && (e.getDate() == 12 && e.getDay() != 6 || e.getDate() == 11 && e.getDay() == 5)) return "יום הזיכרון ליצחק רבין"; break; case 3: if (e.getDate() == 24) return "ערב חנוכה"; else if (e.getDate() == 25) return "א' חנוכה"; else if (e.getDate() == 26) return "ב' חנוכה"; else if (e.getDate() == 27) return "ג' חנוכה"; else if (e.getDate() == 28) return "ד' חנוכה"; else if (e.getDate() == 29) return "ה' חנוכה"; else if (e.getDate() == 30) return "ו' חנוכה"; break; case 4: if (e.getDate() <= 3) { var t = 0; if (HeDate.getyeartype(e.getYear()) == -1) t = 1; if (e.getDate() == 0 + t) return "ו' חנוכה"; else if (e.getDate() == 1 + t) return "ז' חנוכה"; else if (e.getDate() == 2 + t) return "זאת חנוכה" } else if (e.getDate() == 10) return "צום עשרה בטבת"; break; case 5: if (e.getDate() == 15) return "ראש השנה לאילנות"; break; case 6: if (e.getDate() == 14) return "פורים קטן"; else if (e.getDate() == 15) return "שושן פורים קטן"; break; case 7: if (e.getDate() == 11 && e.getDay() == 5 || e.getDate() == 13 && e.getDay() != 7) return "תענית אסתר"; else if (e.getDate() == 14) return "פורים"; else if (e.getDate() == 15) return "שושן פורים"; break; case 8: if (e.getDate() == 14) return "ערב פסח"; else if (e.getDate() == 15) return "פסח"; else if (e.getDate() == 16) return "א' חוה\"מ"; else if (e.getDate() == 17) return "ב' חוה\"מ"; else if (e.getDate() == 18) return "ג' חוה\"מ"; else if (e.getDate() == 19) return "ד' חוה\"מ"; else if (e.getDate() == 20) return "ה' חוה\"מ"; else if (e.getDate() == 21) return "שביעי של פסח"; if (e.getYear() >= 5711) { if (e.getDate() == 26 && e.getDay() == 5) return "יום הזיכרון לשואה ולגבורה (מוקדם)"; else if (e.getDate() == 28 && e.getDay() == 2 && e.getYear() >= 5757) return "יום הזיכרון לשואה ולגבורה (נדחה)"; else if (e.getDate() == 27 && e.getDay() != 6 && e.getDay() != 1 || e.getYear() < 5757) return "יום הזיכרון לשואה ולגבורה" } break; case 9: if (e.getYear() == 5708 && e.getDate() <= 6) { if (e.getDate() == 5) return "יום העצמאות"; if (e.getDate() == 4) return "יום הזיכרון לחללי מערכות ישראל" } if (e.getYear() >= 5709 && e.getDate() <= 6) { if (e.getDate() == 5 && e.getDay() == 4) return "יום העצמאות"; if (e.getYear() < 5714) { if (e.getDate() == 6 && e.getDay() == 1) return "יום העצמאות (נדחה)" } else { if (e.getDate() == 3 && e.getDay() == 5) return "יום העצמאות (הוקדם)" } if (e.getDate() == 4 && e.getDay() == 5) return "יום העצמאות (הוקדם)"; if (e.getYear() < 5764) { if (e.getDate() == 5 && e.getDay() == 2) return "יום העצמאות" } else { if (e.getDate() == 6 && e.getDay() == 3) return "יום העצמאות (נדחה)" } if (e.getDate() == 4 && e.getDay() == 3) return "יום הזיכרון לחללי מערכות ישראל"; if (e.getYear() < 5714) { if (e.getDate() == 4 && e.getDay() == 5) return "יום הזיכרון לחללי מערכות ישראל (הוקדם)" } else { if (e.getDate() == 2 && e.getDay() == 4) return "יום הזיכרון לחללי מערכות ישראל (הוקדם)" } if (e.getDate() == 3 && e.getDay() == 4) return "יום הזיכרון לחללי מערכות ישראל (הוקדם)"; if (e.getYear() < 5764) { if (e.getDate() == 4 && e.getDay() == 1) return "יום הזיכרון לחללי מערכות ישראל" } else { if (e.getDate() == 5 && e.getDay() == 2) return "יום הזיכרון לחללי מערכות ישראל (נדחה)" } } else if (e.getDate() == 18) return 'ל"ג בעומר'; else if (e.getDate() == 28) return "יום ירושלים"; break; case 10: if (e.getDate() == 5) return "ערב שבועות"; else if (e.getDate() == 6) return "שבועות"; break; case 11: if (e.getDate() == 17 && e.getDay() != 7) return 'צום י"ז בתמוז'; else if (e.getDate() == 18 && e.getDay() == 1) return 'צום י"ז בתמוז (נדחה)'; break; case 12: if (e.getDate() == 9 && e.getDay() != 7) return "צום ט' באב"; if (e.getDate() == 10 && e.getDay() == 1) return "צום ט' באב (נדחה)"; else if (e.getDate() == 15) return 'ט"ו באב'; break; case 13: if (e.getDate() == 29) return "ערב ראש השנה"; break }return null }
// TODO import HeDate & getJwishHoliday from he-date NPM package when it will be published

export class Message {
    private calendar = new Calendar();

    async generateMessage(date?: moment.MomentInput): Promise<string> {
        date = moment(date);
        let message = '';

        const heDate = new HeDate(date.toDate());
        message = heDate.toString() + ' ' + date.format('DD/MM/YYYY') + '\n';
        const holiday = getJwishHoliday(heDate);
        if (holiday) message += '✡' + holiday + '✡\n';
        message += '\n';

        const sabbathTime = ShabbatHug.getShabatHugimData(moment(date));
        if (sabbathTime) {
            if (sabbathTime['Parsha']) message += '📜' + sabbathTime['Parsha'] + '📜' + "\n";
            message += '🕯הדלקת נרות: ' + sabbathTime['CandleLightingTime'].format('HH:mm') + '🕯' + "\n" +
                '🌟צאת שבת: ' + sabbathTime['HavdalahTime'].format('HH:mm') + '🌟' + "\n\n";
        }

        const events = await this.calendar.getDailyEvents(date);
        if (events.length === 0) {
            message += "אין אירועים היום! 🎉🎉";
        }
        else {
            message += "📅בוקר טוב! הנה האירועים של היום:\n";
            message += events.map((event) => {
                return '🔹' + (event.datetype === 'date' ? '' : moment(event.start).format('HH:mm') + ' - ') + event.summary;
            }).join('\n');
        }

        if (sabbathTime) {
            const tomorrowEvents = await this.calendar.getDailyEvents(moment(date).add(1, 'day'));
            if (tomorrowEvents.length > 0) {
                message += '\n\n📅 ואלו של מחר:\n';
                message += tomorrowEvents.map((event) => {
                    return '🔹' + (event.datetype === 'date' ? '' : moment(event.start).format('HH:mm') + ' - ') + event.summary;
                }).join('\n');
            }
        }

        message += '\n\nזיכרו! ההודעה הזו קבועה אבל היומן תמיד מעודכן!! 😎';

        message += '\n\nשיהיה לכם יום נהדר! 🌞';

        return message;
    }
}