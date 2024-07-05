import puppeteer, { Page } from 'puppeteer';
import qrcode from 'qrcode-terminal';
import { Subject } from 'rxjs';

import { Log } from './log';

export class WhatsApp {
    private page!: Page;
    private isReady$: Subject<boolean>;

    constructor() {
        this.isReady$ = new Subject<boolean>();
        this.init();
    }

    private async init() {
        const browser = await puppeteer.launch({
            userDataDir: "./user_data",
            // headless: false,
        });
        this.page = await browser.newPage();
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
        await this.page.goto('https://web.whatsapp.com/');

        await this.page.waitForSelector('div._akau[data-ref], ._ak9p', { timeout: 600000 });

        if (await this.page.$('div._akau[data-ref]')) {
            const qr = await (await this.page
                .locator('div._akau[data-ref]')
                .waitHandle())?.evaluate(el => el.getAttribute('data-ref'));
            Log.log('QR RECEIVED: ' + qr);
            qrcode.generate(qr, { small: true });
        }

        await this.page.waitForSelector('._ak9p', { timeout: 600000 });

        this.isReady$.next(true);
        this.isReady$.complete();
        Log.log('Whatsapp Client is ready!');
    }

    public async sendMessage(chatAlias: string, content: string): Promise<void> {
        await this.isReady$.toPromise();

        await this.page.waitForSelector(`span[title="${chatAlias}"]`, { timeout: 600000 });
        await this.page.click(`span[title="${chatAlias}"]`);

        let isChatSelected = false;
        do {
            await sleep(1000); // Wait for 1 second before checking the value again
            await this.page.waitForSelector(`header._amid`, { timeout: 600000 });
            isChatSelected = (await this.page.$eval(`header._amid`, (element) => element.innerHTML)).includes(`>${chatAlias}</span>`);
        } while (!isChatSelected);

        const parts = content.split('\n');
        for (let i = 0; i < parts.length; i++) {
            await this.page.keyboard.type(parts[i]);
            if (i < parts.length - 1) {
                await this.page.keyboard.down('Control');
                await this.page.keyboard.press('Enter');
                await this.page.keyboard.up('Control');
            }
        }
        await this.page.keyboard.press('Enter');
    }

}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
