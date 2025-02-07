import * as whatsapp from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { Subject } from 'rxjs';

import { config } from './config';
import { Log } from './log';


export class WhatsApp {
    private client!: whatsapp.Client;
    private isReady$: Subject<boolean>;

    constructor() {
        this.isReady$ = new Subject<boolean>();
        this.init();
    }

    private init() {
        this.client = new whatsapp.Client({
            webVersionCache: {
                type: 'remote',
                remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
            },

            authStrategy: new whatsapp.LocalAuth({
                dataPath: 'wwebjs_auth'
            }),

            // puppeteer: {
            //     headless: false
            // }
        });

        this.client.on('qr', (qr: string) => {
            // Generate and scan this code with your phone
            Log.log('QR RECEIVED' + qr);
            qrcode.generate(qr, { small: true });
        });

        this.client.on('ready', () => {
            this.isReady$.next(true);
            this.isReady$.complete();
            Log.log('Whatsapp Client is ready!');
            this.sendMessage(config.whatsApp.adminChatId, 'Hey admin! This is an automated message.');
            this.sendMessage(config.whatsApp.testGroupChatId, 'Hey group! This is an automated message.');
        });

        this.client.on('message', (msg) => this.onMessageReceived(msg));
        this.client.initialize();
    }

    public async sendMessage(chatId: string, content: whatsapp.MessageContent): Promise<whatsapp.Message> {
        // await firstValueFrom(this.isReady$); // wait for client to be ready
        await this.isReady$.toPromise();
        return this.client.sendMessage(chatId, content);
    }

    private async onMessageReceived(msg: whatsapp.Message) {
        Log.log('MESSAGE RECEIVED:');
        Log.log('msg.author:' + msg.author);
        Log.log('msg.from:' + msg.from);
        if (config.whatsApp.users.includes(msg.from) || (msg.author && config.whatsApp.users.includes(msg.author))) { // check if the message is from an authorized user
            if (msg.author) { // if the message is from a group
                if (msg.body.toLowerCase() == 'ping') {
                    msg.reply('pong \n 🏓', msg.author || msg.from);
                }
            }
            else { // if the message is from a private chat
                if (['hi', 'hello'].some(keyword => msg.body.toLowerCase().includes(keyword))) {
                    await msg.reply('Hello!');
                }
                if (['bye', 'goodbye'].some(keyword => msg.body.toLowerCase().includes(keyword))) {
                    await msg.reply('Goodbye!');
                }
                if (['הי', 'שלום'].some(keyword => msg.body.toLowerCase().includes(keyword))) {
                    await msg.reply('שלום!');
                }
                if (['להתראות', 'ביי'].some(keyword => msg.body.toLowerCase().includes(keyword))) {
                    await msg.reply('להתראות!');
                }
                let count = msg.body.toLowerCase().split('ping').length - 1;
                for (let i = 0; i < count; i++) {
                    await msg.reply('pong \n 🏓');
                }
                count = msg.body.toLowerCase().split('פינג').length - 1;
                for (let i = 0; i < count; i++) {
                    await msg.reply('פונג \n 🏓');
                }


            }
        }
    }
}