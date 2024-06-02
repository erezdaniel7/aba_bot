import fs from 'fs';

import { config } from './config';

export class Log {
    static log(message: string) {
        console.log(new Date() + " - " + message);
        // Write the log to a file
        if (config.log_file_path) {
            // Create the folder if it doesn't exist
            const folderPath = config.log_file_path.substring(0, config.log_file_path.lastIndexOf('/'));
            fs.mkdirSync(folderPath, { recursive: true });

            fs.appendFileSync(config.log_file_path, new Date() + " - " + message + '\n');
        }
    }
}

