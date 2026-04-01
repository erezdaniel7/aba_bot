import fs from 'fs';

import { config } from './config';

export class Log {
    static log(message: string) {
        console.log(new Date() + " - " + message);
        this.writeToFile(config.log_file_path, message);
    }

    static logAi(message: string) {
        this.writeToFile(config.ai_log_file_path, message);
    }

    private static writeToFile(filePath: string | undefined, message: string) {
        if (!filePath) {
            return;
        }

        const lastSlashIndex = filePath.lastIndexOf('/');
        if (lastSlashIndex >= 0) {
            const folderPath = filePath.substring(0, lastSlashIndex);
            fs.mkdirSync(folderPath, { recursive: true });
        }

        fs.appendFileSync(filePath, new Date() + " - " + message + '\n');
    }
}

