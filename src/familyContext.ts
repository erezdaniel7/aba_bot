import { config } from './config';

type FamilyMember = typeof config.family.members[number];

export class FamilyContext {
    public buildPromptSection(): string {
        const intro = config.family.description.trim();
        const configuredIdentityRules = config.family.identityRules ?? [
            '"אבא בוט" הוא הבוט בלבד ואינו אדם במשפחה.',
            '"אבא" הוא קשר משפחתי של אדם, ולא שם הבוט.',
            'לעולם אין לאחד בין זהות הבוט לבין זהות בן משפחה.',
        ];
        const identityRules = [
            'זהויות חשובות:',
            ...configuredIdentityRules.map((rule) => `- ${rule}`),
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

    public findMentionedMembers(text: string, options?: { excludePhoneNumber?: string; maxResults?: number }): FamilyMember[] {
        const normalizedText = text.trim();
        if (!normalizedText) {
            return [];
        }

        const excludedMember = this.findMemberByPhone(options?.excludePhoneNumber);
        const maxResults = options?.maxResults ?? 3;

        return config.family.members
            .filter((member) => {
                if (excludedMember && member.phoneNumber === excludedMember.phoneNumber) {
                    return false;
                }

                return this.textMentionsMember(normalizedText, member);
            })
            .slice(0, maxResults);
    }

    public buildMentionedMembersSection(
        text: string,
        getSummary?: (member: FamilyMember) => string,
        options?: { excludePhoneNumber?: string; maxResults?: number },
    ): string {
        const mentionedMembers = this.findMentionedMembers(text, options);
        if (mentionedMembers.length === 0) {
            return '';
        }

        const lines = ['מידע על בני משפחה שהוזכרו:'];
        for (const member of mentionedMembers) {
            const details: string[] = [];

            if (member.name.trim()) {
                details.push(`שם פרטי: ${member.name.trim()}`);
            }

            if (member.relation.trim()) {
                details.push(`קשר משפחתי: ${member.relation.trim()}`);
            }

            if (member.shortDescription.trim()) {
                details.push(`מידע רשמי: ${member.shortDescription.trim()}`);
            }

            const dynamicSummary = getSummary?.(member)?.trim();
            if (dynamicSummary) {
                details.push(`הקשר מהשיחות: ${dynamicSummary}`);
            }

            lines.push(`- ${details.join(' | ')}`);
        }

        return lines.join('\n');
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

    private textMentionsMember(text: string, member: FamilyMember): boolean {
        const candidates = [member.name.trim()];
        const relation = member.relation.trim();

        if (relation && !['בן', 'בת', 'ילד', 'ילדה'].includes(relation)) {
            candidates.push(relation);
        }

        return candidates
            .filter((candidate) => candidate.length > 0)
            .some((candidate) => this.containsWholeTerm(text, candidate));
    }

    private containsWholeTerm(text: string, term: string): boolean {
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|[^\\p{L}\\p{N}])${escapedTerm}([^\\p{L}\\p{N}]|$)`, 'iu').test(text);
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