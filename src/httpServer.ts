import express, { Express, Request, Response } from 'express';
import * as whatsapp from 'whatsapp-web.js';
import bodyParser from 'body-parser';


import { config } from './config';
import { Log } from './log';
import { WhatsApp } from './whatsapp';

export class HttpServer {
    private app: Express;
    private whatsapp: WhatsApp;

    constructor(whatsapp: WhatsApp) {
        this.whatsapp = whatsapp;
        this.app = express();
        this.app.use(bodyParser.json({ limit: '10mb' }));

        this.app.post('/send-message', async (req: Request, res: Response) => {
            const { chatId, content, imageBase64 } = req.body as { chatId?: string; content?: string; imageBase64?: string };
            if (!chatId || (!content && !imageBase64)) {
                res.status(400).json({ error: 'chatId and at least one of content or imageBase64 are required' });
                return;
            }
            if (!config.httpServer.whitelistChatIds.includes(chatId)) {
                res.status(403).json({ error: 'chatId is not allowed' });
                Log.log(`Blocked attempt to send message to non-whitelisted chatId: ${chatId}`);
                return;
            }
            try {
                let result;
                if (imageBase64) {
                    // Send image (base64 string)
                    const { MessageMedia } = require('whatsapp-web.js');
                    const mimeType = 'image/png'; // You may want to allow client to specify mime type
                    const mediaObj = new MessageMedia(mimeType, imageBase64);
                    const options: whatsapp.MessageSendOptions = {};
                    if (content) {
                        options.caption = content;
                    }
                    result = await this.whatsapp.sendMessage(chatId, mediaObj, options);
                } else {
                    result = await this.whatsapp.sendMessage(chatId, content || '');
                }
                Log.log(`Custom message sent to ${chatId}: ${content ? content.split('\n')[0] : '[image]'}`);
                res.json({ status: 'Message sent' });
            } catch (err) {
                let errorMsg = 'Unknown error';
                if (err instanceof Error) {
                    errorMsg = err.message;
                } else if (typeof err === 'string') {
                    errorMsg = err;
                }
                Log.log('Error sending message: ' + errorMsg);
                res.status(500).json({ error: 'Failed to send message', details: errorMsg });
            }
        });
    }

    start() {
        const PORT = config.httpServer.port;
        this.app.listen(PORT, () => {
            Log.log(`HTTP server listening on port ${PORT}`);
        });
    }
}
