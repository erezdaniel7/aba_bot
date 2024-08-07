import schedule from 'node-schedule';
import moment from 'moment';

import { WhatsApp } from "./whatsapp";
import { config } from './config';
import { Log } from './log';
import { Message } from './message';

const whatsapp = new WhatsApp();
const message = new Message();

async function sendTodayMessage(chatId: string, date?: moment.MomentInput): Promise<void> {
    await whatsapp.sendMessage(chatId, await message.generateMessage(date));
    Log.log('today message sent!');
}

(async () => {
    await sendTodayMessage(config.whatsApp.testGroupChatAlias);
    await sendTodayMessage(config.whatsApp.testGroupChatAlias, moment().add(1, 'day'));
})();


Log.log('App started!');
schedule.scheduleJob('0 0 20 * * *', () => sendTodayMessage(config.whatsApp.testGroupChatAlias, moment().add(1, 'day')));
schedule.scheduleJob('0 0 6 * * 0-5', () => sendTodayMessage(config.whatsApp.testGroupChatAlias, moment().add(1, 'day')));
schedule.scheduleJob('0 0 7 * * 0-5', () => sendTodayMessage(config.whatsApp.groupChatAlias));