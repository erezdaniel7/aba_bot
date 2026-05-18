import express, { Express, Request, Response } from 'express';
import bodyParser from 'body-parser';


import { config } from './config';
import { Log } from './log';
import { OutgoingMessagePayload, WhatsAppClient } from './whatsapp.types';

export class HttpServer {
    private app: Express;
    private whatsapp: WhatsAppClient;

    constructor(whatsapp: WhatsAppClient) {
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
                let payload: OutgoingMessagePayload;
                if (imageBase64) {
                    payload = {
                        base64: imageBase64,
                        mimeType: 'image/png',
                        ...(content ? { caption: content } : {}),
                    };
                } else {
                    payload = content || '';
                }

                await this.whatsapp.sendMessage(chatId, payload);
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
