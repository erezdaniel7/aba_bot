import { config } from './config';

export class FamilyContext {
    public buildPromptSection(): string {
        const intro = config.family.description.trim();
        const identityRules = [
            'זהויות חשובות:',
            '- "אבא בוט" הוא הבוט בלבד ואינו אדם במשפחה.',
            '- "אבא" הוא קשר משפחתי של אדם (למשל דניאל), ולא שם הבוט.',
            '- לעולם אין לאחד בין זהות הבוט לבין זהות בן משפחה.',
        ].join('\n');
        const memberLines = config.family.members
            .map((member) => {
                const details: string[] = [];

                if (member.name.trim()) {
                    details.push(`שם פרטי: ${member.name.trim()}`);
                }

                if (member.relation.trim()) {
                    details.push(`קשר משפחתי: ${member.relation.trim()}`);
                }

                if (member.gender?.trim()) {
                    details.push(`מגדר: ${member.gender.trim()}`);
                }

                if (member.phoneNumber) {
                    details.push(`טלפון/צ'אט: ${member.phoneNumber}`);
                }

                if (member.shortDescription.trim()) {
                    details.push(`מידע: ${member.shortDescription.trim()}`);
                }

                return '- ' + details.join(' | ');
            })
            .join('\n');

        if (!intro && !memberLines) {
            return '';
        }

        const sections = ['מידע על המשפחה:'];
        sections.push(identityRules);
        if (intro) {
            sections.push(intro);
        }
        if (memberLines) {
            sections.push('בני משפחה:');
            sections.push(memberLines);
        }

        return sections.join('\n');
    }

    public buildCurrentUserSection(phoneNumber?: string): string {
        const member = this.findMemberByPhone(phoneNumber);
        if (!member) {
            return '';
        }

        const details = [
            `המשתמש הנוכחי מזוהה כ: ${this.getDisplayName(member)}`,
        ];

        if (member.relation.trim()) {
            details.push(`קשר משפחתי: ${member.relation.trim()}`);
        }

        if (member.gender?.trim()) {
            details.push(`מגדר: ${member.gender.trim()}`);
        }

        if (member.shortDescription.trim()) {
            details.push(`מידע רלוונטי: ${member.shortDescription.trim()}`);
        }

        return details.join('\n');
    }

    public resolveMemberName(phoneNumber?: string): string | null {
        const match = this.findMemberByPhone(phoneNumber);
        return match ? match.name.trim() : null;
    }

    public resolveMemberRelation(phoneNumber?: string): string | null {
        const match = this.findMemberByPhone(phoneNumber);
        return match ? match.relation.trim() : null;
    }

    private findMemberByPhone(phoneNumber?: string) {
        if (!phoneNumber) {
            return null;
        }

        const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
        const normalizedDigits = this.extractDigits(normalizedPhone);

        return config.family.members.find((member) => {
            const memberNormalized = this.normalizePhoneNumber(member.phoneNumber);
            if (memberNormalized === normalizedPhone) {
                return true;
            }

            const memberDigits = this.extractDigits(memberNormalized);
            if (!normalizedDigits || !memberDigits) {
                return false;
            }

            return memberDigits === normalizedDigits
                || memberDigits.endsWith(normalizedDigits)
                || normalizedDigits.endsWith(memberDigits);
        });
    }

    private getDisplayName(member: { name: string; relation: string }): string {
        const relation = member.relation.trim();
        const name = member.name.trim();

        if (relation && name) {
            return `${relation} - ${name}`;
        }

        return name || relation;
    }

    private normalizePhoneNumber(phoneNumber?: string): string {
        return (phoneNumber ?? '').trim().toLowerCase();
    }

    private extractDigits(value: string): string {
        return value.replace(/\D/g, '');
    }
}