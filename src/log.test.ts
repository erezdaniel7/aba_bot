import { describe, expect, it } from '@jest/globals';

import { isBrokenPipeLikeError } from './log';

describe('isBrokenPipeLikeError', () => {
    it('treats EPIPE code as a broken pipe error', () => {
        const error = Object.assign(new Error('write failed'), { code: 'EPIPE' });

        expect(isBrokenPipeLikeError(error)).toBe(true);
    });

    it('treats broken-pipe messages as a broken pipe error even when code is missing', () => {
        const error = new Error('EPIPE: broken pipe, write');

        expect(isBrokenPipeLikeError(error)).toBe(true);
    });

    it('treats nested causes as broken pipe errors', () => {
        const error = Object.assign(new Error('request failed'), {
            cause: new Error('ERR_STREAM_DESTROYED'),
        });

        expect(isBrokenPipeLikeError(error)).toBe(true);
    });

    it('does not match unrelated errors', () => {
        expect(isBrokenPipeLikeError(new Error('boom'))).toBe(false);
    });
});
