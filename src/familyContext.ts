import { config } from './config';

export class FamilyContext {
    public buildPromptSection(): string {
        const intro = config.family.description.trim();
        const memberLines = config.family.members
            .map((member) => {
                const details: string[] = [`שם: ${this.getDisplayName(member)}`];

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
        return match ? this.getDisplayName(match) : null;
    }

    private findMemberByPhone(phoneNumber?: string) {
        if (!phoneNumber) {
            return null;
        }

        const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
        return config.family.members.find((member) => {
            return this.normalizePhoneNumber(member.phoneNumber) === normalizedPhone;
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
}