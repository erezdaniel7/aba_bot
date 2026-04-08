import fs from 'fs';
import path from 'path';

import { config } from './config';

const BROKEN_PIPE_PATTERN = /\bEPIPE\b|broken pipe|ERR_STREAM_DESTROYED/i;

export function isBrokenPipeLikeError(error: unknown): boolean {
    if (!error) {
        return false;
    }

    if (typeof error === 'string') {
        return BROKEN_PIPE_PATTERN.test(error);
    }

    const nodeError = error as NodeJS.ErrnoException & {
        cause?: unknown;
        errno?: number | string;
    };

    if (nodeError.code === 'EPIPE' || nodeError.code === 'ERR_STREAM_DESTROYED') {
        return true;
    }

    if (nodeError.errno === -4047) {
        return true;
    }

    if (typeof nodeError.message === 'string' && BROKEN_PIPE_PATTERN.test(nodeError.message)) {
        return true;
    }

    return isBrokenPipeLikeError(nodeError.cause);
}

function silenceConsoleInNonInteractiveMode(): void {
    if (process.stdout?.isTTY || process.stderr?.isTTY) {
        return;
    }

    const noop = () => undefined;
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
        console[method] = noop as typeof console[typeof method];
    }

    for (const stream of [process.stdout, process.stderr]) {
        if (!stream) {
            continue;
        }

        const patchedStream = stream as typeof stream & {
            __abaBotSilentWritePatched?: boolean;
        };

        if (patchedStream.__abaBotSilentWritePatched) {
            continue;
        }

        const originalWrite = stream.write.bind(stream) as (...args: any[]) => boolean;
        stream.write = ((chunk: any, ...args: any[]) => {
            try {
                return originalWrite(chunk, ...args);
            } catch (error) {
                if (isBrokenPipeLikeError(error)) {
                    return true;
                }

                throw error;
            }
        }) as typeof stream.write;

        patchedStream.__abaBotSilentWritePatched = true;
    }
}

silenceConsoleInNonInteractiveMode();

export class Log {
    private static consoleWritable = Boolean(
        process.stdout &&
        process.stdout.isTTY &&
        process.stdout.writable &&
        !process.stdout.destroyed
    );
    private static consoleErrorHandlerAttached = false;

    static log(message: string) {
        this.ensureConsoleErrorHandler();
        this.writeToConsole(message);
        this.writeToFile(config.log_file_path, message);
    }

    static logAi(message: string) {
        const separator = '------------------------------------------------------------------------';
        this.writeToFile(config.ai_log_file_path, `\n${separator}\n${message}\n${separator}`);
    }

    private static ensureConsoleErrorHandler() {
        if (this.consoleErrorHandlerAttached) {
            return;
        }

        this.consoleErrorHandlerAttached = true;

        const handleStreamError = (error: NodeJS.ErrnoException) => {
            if (isBrokenPipeLikeError(error)) {
                this.consoleWritable = false;
            }
        };

        for (const stream of [process.stdout, process.stderr]) {
            if (stream && typeof stream.on === 'function') {
                stream.on('error', handleStreamError);
            }
        }

        if (!process.stdout || typeof process.stdout.on !== 'function') {
            this.consoleWritable = false;
        }
    }

    private static writeToConsole(message: string) {
        if (!this.consoleWritable) {
            return;
        }

        if (!process.stdout || !process.stdout.isTTY || process.stdout.destroyed || !process.stdout.writable) {
            this.consoleWritable = false;
            return;
        }

        try {
            process.stdout.write(new Date() + ' - ' + message + '\n');
        } catch (error) {
            if (isBrokenPipeLikeError(error)) {
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

