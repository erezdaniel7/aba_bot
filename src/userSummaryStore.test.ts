import { describe, expect, it } from '@jest/globals';

import {
    classifySummaryText,
    formatStructuredSummary,
    mergeStructuredSummary,
} from './userSummaryStore';

describe('classifySummaryText', () => {
    it('separates stable facts from recent notes', () => {
        const result = classifySummaryText([
            'המשתמש הוא בן במשפחה.',
            'תלמיד במסגרת לימודים קבועה.',
            'אוהב ספורט ופתרון פאזלים.',
            'לאחרונה דיבר על טכניקות אימון.',
        ].join('\n'));

        expect(result.stableFacts).toContain('המשתמש הוא בן במשפחה.');
        expect(result.stableFacts).toContain('תלמיד במסגרת לימודים קבועה.');
        expect(result.recentNotes).toContain('לאחרונה דיבר על טכניקות אימון.');
    });
});

describe('mergeStructuredSummary', () => {
    it('preserves old stable facts when a new summary only adds recent context', () => {
        const previous = classifySummaryText([
            'המשתמש הוא בן במשפחה.',
            'תלמיד במסגרת לימודים קבועה.',
            'אוהב ספורט ופתרון פאזלים.',
        ].join('\n'));

        const merged = mergeStructuredSummary(previous, [
            'המשתמש דיבר לאחרונה על שיפור טכניקה.',
        ].join('\n'));

        const formatted = formatStructuredSummary(merged);
        expect(formatted).toContain('תלמיד במסגרת לימודים קבועה.');
        expect(formatted).toContain('אוהב ספורט ופתרון פאזלים.');
        expect(formatted).toContain('המשתמש דיבר לאחרונה על שיפור טכניקה.');
    });

    it('limits recent notes while keeping the newest ones', () => {
        const previous = classifySummaryText('המשתמש הוא בן במשפחה.');
        const merged = mergeStructuredSummary(previous, [
            'לאחרונה דיבר על טכניקה.',
            'בזמן האחרון מתעניין גם בטיפוס.',
            'השבוע תרגל כוח מתפרץ.',
            'לאחרונה שאל על אימון שיווי משקל.',
        ].join('\n'));

        expect(merged.recentNotes.length).toBeLessThanOrEqual(3);
        expect(merged.recentNotes[merged.recentNotes.length - 1]).toContain('אימון שיווי משקל');
    });

    it('replaces contradictory stable facts with the newer fact', () => {
        const previous = classifySummaryText([
            'תלמיד במסגרת קודמת.',
            'אוהב ספורט.',
        ].join('\n'));

        const merged = mergeStructuredSummary(previous, [
            'תלמיד במסגרת חדשה.',
            'אוהב ספורט.',
        ].join('\n'));

        const formatted = formatStructuredSummary(merged);
        expect(formatted).toContain('תלמיד במסגרת חדשה.');
        expect(formatted).not.toContain('תלמיד במסגרת קודמת.');
    });
});
