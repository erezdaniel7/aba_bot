import { describe, expect, it } from '@jest/globals';

import {
    buildDailyVariationInstructions,
    buildRecentDailyMemorySection,
    isLikelyDailyMessage,
    shouldUpdateUserSummary,
} from './aiBehavior';

describe('buildDailyVariationInstructions', () => {
    it('is deterministic for the same date', () => {
        const a = buildDailyVariationInstructions('2026-04-07');
        const b = buildDailyVariationInstructions('2026-04-07');

        expect(a).toBe(b);
    });

    it('rotates style hints across different dates', () => {
        const first = buildDailyVariationInstructions('2026-04-07');
        const second = buildDailyVariationInstructions('2026-04-08');

        expect(first).not.toBe(second);
    });

    it('treats DD/MM/YYYY input the same as ISO input', () => {
        const iso = buildDailyVariationInstructions('2026-04-08');
        const localized = buildDailyVariationInstructions('08/04/2026');

        expect(localized).toBe(iso);
    });
});

describe('daily message memory helpers', () => {
    it('detects likely daily messages and ignores alert noise', () => {
        expect(isLikelyDailyMessage('🌅 בוקר טוב משפחה יקרה!\n📅 היום יום שלישי...')).toBe(true);
        expect(isLikelyDailyMessage('⚔️ - היכנסו למרחב המוגן')).toBe(false);
    });

    it('builds a compact memory section from recent daily messages only', () => {
        const section = buildRecentDailyMemorySection([
            '🌅 בוקר טוב משפחה יקרה!\n📅 היום יום שני, י"ט ניסן ה\'תשפ"ו',
            '⚔️ - היכנסו למרחב המוגן',
            '🗓 יום שלישי, כ\' ניסן ה\'תשפ"ו\nבוקר טוב לכולם! 🌞',
        ], 2);

        expect(section).toContain('מסרי בוקר קודמים');
        expect(section).toContain('בוקר טוב');
        expect(section).not.toContain('היכנסו למרחב המוגן');
    });
});

describe('shouldUpdateUserSummary', () => {
    it('skips trivial short acknowledgements', () => {
        expect(shouldUpdateUserSummary('כן', 'בשמחה!', undefined, 0)).toBe(false);
    });

    it('skips updates when the previous update was too recent', () => {
        const now = new Date('2026-04-08T12:00:00Z').getTime();
        const oneHourAgo = now - 60 * 60 * 1000;

        expect(
            shouldUpdateUserSummary(
                'אני אוהב להתאמן על מסלול חדש כל יום',
                'איזה יופי, זה נשמע מעולה!',
                oneHourAgo,
                now,
            ),
        ).toBe(false);
    });

    it('updates when a meaningful new preference is shared after enough time', () => {
        const now = new Date('2026-04-08T12:00:00Z').getTime();
        const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;

        expect(
            shouldUpdateUserSummary(
                'לאחרונה התחלתי להתאמן גם על טיפוס ואני רוצה להשתפר בזה קבוע',
                'מעולה, זה נשמע כמו כיוון קבוע וחשוב לזכור.',
                twoDaysAgo,
                now,
            ),
        ).toBe(true);
    });

    it('updates when a configured family keyword appears in the message', () => {
        expect(
            shouldUpdateUserSummary(
                'היום שיחקנו טניס שולחן עם אחי בחצר',
                'איזה כיף לשמוע.',
                undefined,
                0,
            ),
        ).toBe(true);
    });

    it('does not update on long generic questions just because the bot reply is long', () => {
        expect(
            shouldUpdateUserSummary(
                'מה קורה היום ואם יש משהו מעניין לדבר עליו בערב?',
                'בשמחה! היום יש כמה אפשרויות נחמדות ואפשר גם לחשוב על משהו משפחתי נעים אחר כך אם יתאים לכם, ונוכל לבדוק יחד מה הכי נוח לכולם.',
                undefined,
                0,
            ),
        ).toBe(false);
    });

    it('updates on meaningful new self-disclosure even without an existing family keyword', () => {
        expect(
            shouldUpdateUserSummary(
                'עברתי לאחרונה לחוג רובוטיקה ואני ממש נהנה לבנות דברים חדשים',
                'איזה יופי, זה נשמע תחום מעולה.',
                undefined,
                0,
            ),
        ).toBe(true);
    });
});
