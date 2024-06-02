import moment from 'moment';

import { Sabbath } from './heDate/sabbath';
import { Calendar } from "./calendar";

const HeDate = require('./heDate/heDate');
const getJwishHoliday = require('./heDate/heHoliday');
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

        const sabbathTime = Sabbath.getSabbathTime(moment(date).add(1, 'day'));
        if (sabbathTime) {
            message += '🕯🕯' + sabbathTime['פרשת שבוע'] + '🕯🕯' + "\n" +
                "הדלקת נרות: " + sabbathTime['הדלקת נרות'] + "\n" +
                "צאת שבת: " + sabbathTime['צאת שבת'] + "\n\n";
        }

        const events = await this.calendar.getDailyEvents(date);
        if (events.length === 0) {
            message += "אין אירועים היום! 🎉🎉";
        }
        else {
            message += "⭐בוקר טוב! הנה האירועים של היום:\n";
            message += events.map((event) => {
                return '🔹' + (event.datetype === 'date' ? '' : moment(event.start).format('HH:mm') + ' - ') + event.summary;
            }).join('\n');
        }

        message += '\n\nזיכרו! ההודעה הזו קבועה אבל היומן תמיד מעודכן!! 😎';

        message += '\n\nשיהיה לכם יום נהדר! 🌞';

        return message;
    }
}