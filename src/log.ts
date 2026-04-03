import fs from 'fs';
import path from 'path';

import { config } from './config';

export class Log {
    private static consoleWritable = Boolean(process.stdout && process.stdout.writable && !process.stdout.destroyed);
    private static consoleErrorHandlerAttached = false;

    static log(message: string) {
        this.ensureConsoleErrorHandler();
        this.writeToConsole(message);
        this.writeToFile(config.log_file_path, message);
    }

    static logAi(message: string) {
        this.writeToFile(config.ai_log_file_path, message);
    }

    private static ensureConsoleErrorHandler() {
        if (this.consoleErrorHandlerAttached) {
            return;
        }

        this.consoleErrorHandlerAttached = true;

        if (!process.stdout || typeof process.stdout.on !== 'function') {
            this.consoleWritable = false;
            return;
        }

        process.stdout.on('error', (error: NodeJS.ErrnoException) => {
            const errorCode = error?.code;
            if (errorCode === 'EPIPE' || errorCode === 'ERR_STREAM_DESTROYED') {
                this.consoleWritable = false;
            }
        });
    }

    private static writeToConsole(message: string) {
        if (!this.consoleWritable) {
            return;
        }

        if (!process.stdout || process.stdout.destroyed || !process.stdout.writable) {
            this.consoleWritable = false;
            return;
        }

        try {
            console.log(new Date() + ' - ' + message);
        } catch (error) {
            const errorCode = (error as NodeJS.ErrnoException).code;
            if (errorCode === 'EPIPE' || errorCode === 'ERR_STREAM_DESTROYED') {
                this.consoleWritable = false;
                return;
            }

            throw error;
        }
    }

    private static writeToFile(filePath: string | undefined, message: string) {
        if (!filePath) {
            return;
        }

        try {
            const folderPath = path.dirname(filePath);
            if (folderPath && folderPath !== '.') {
                fs.mkdirSync(folderPath, { recursive: true });
            }

            fs.appendFileSync(filePath, new Date() + ' - ' + message + '\n');
        } catch {
            // Avoid throwing from the logger itself.
        }
    }
}

