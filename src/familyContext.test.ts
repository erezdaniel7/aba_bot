import { describe, expect, it } from '@jest/globals';

import { FamilyContext } from './familyContext';

describe('FamilyContext mentioned members helpers', () => {
    it('finds explicitly mentioned family relations in a message', () => {
        const familyContext = new FamilyContext();
        const mentioned = familyContext.findMentionedMembers('אמא אמרה שנדבר בערב על התוכניות.');

        expect(mentioned.some((member) => member.relation === 'אמא')).toBe(true);
    });

    it('builds a compact section for mentioned family members', () => {
        const familyContext = new FamilyContext();
        const section = familyContext.buildMentionedMembersSection(
            'אמא ביקשה לעדכן את אבא לגבי הערב.',
            (member) => member.relation === 'אמא' ? 'אחראית על חלק מהתיאומים.' : '',
        );

        expect(section).toContain('מידע על בני משפחה שהוזכרו');
        expect(section).toContain('קשר משפחתי: אמא');
    });

    it('does not leak phone numbers into the prompt section', () => {
        const familyContext = new FamilyContext();
        const section = familyContext.buildPromptSection();

        expect(section).not.toContain('@c.us');
    });
});
