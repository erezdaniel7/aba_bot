import schedule from 'node-schedule';
import moment from 'moment';

import { WhatsApp } from "./whatsapp";
import { config } from './config';
import { Log } from './log';
import { Message } from './message';
import { ShabbatHug } from './heDate/shabbatHug';

const whatsapp = new WhatsApp();
const message = new Message();

async function sendTodayMessage(chatId: string, date?: moment.MomentInput): Promise<void> {
    if (ShabbatHug.isIssurMelacha(date)) {
        Log.log('Today is Shabbat or holiday! no message sent!');
        return;
    }
    await whatsapp.sendMessage(chatId, await message.generateMessage(date));
    Log.log('today message sent!');
}

(async () => {
    await sendTodayMessage(config.whatsApp.testGroupChatId, moment());
    await sendTodayMessage(config.whatsApp.testGroupChatId, moment().add(1, 'day').set('hour', 8));
})();


Log.log('App started!');
schedule.scheduleJob('0 0 20 * * *', () => sendTodayMessage(config.whatsApp.testGroupChatId, moment().add(1, 'day').set('hour', 8)));
schedule.scheduleJob('0 0 6 * * 0-5', () => sendTodayMessage(config.whatsApp.testGroupChatId, moment().add(1, 'day')));
schedule.scheduleJob('0 0 7 * * 0-5', () => sendTodayMessage(config.whatsApp.groupChatId));