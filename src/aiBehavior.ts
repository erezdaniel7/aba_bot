import moment from 'moment';

import { config } from './config';

const SUMMARY_UPDATE_COOLDOWN_MS = 6 * 60 * 60 * 1000;

const TRIVIAL_MESSAGE_PATTERNS = [
    /^(כן|לא|סבבה|אוקיי|אוקי|סגור|מעולה|תודה|תודה רבה|סבבה תודה|חח+|חחח+|חחחח+|ok|okay|thanks)[!.?\s]*$/i,
    /^(בוקר טוב|לילה טוב|צהריים טובים|ערב טוב)[!.?\s]*$/i,
];

const STABLE_SIGNAL_PATTERN = /אוהב|אוהבת|מעדיף|מעדיפה|מתאמן|מתאמנת|לומד|לומדת|עובד|עובדת|גר|גרה|תמיד|בדרך כלל|לרוב|כל יום|כל שבוע|חשוב לי|חשוב לי מאוד|רוצה להשתפר|תחביב|תחביבים|קבוע/i;
const CORRECTION_SIGNAL_PATTERN = /לא נכון|בעצם|תשנה|תשני|תעדכן|תעדכני|מעכשיו|מעתה|במקום/i;
const MEANINGFUL_DISCLOSURE_PATTERN = /אני|אנחנו|עברתי|עברנו|התחלתי|התחלנו|הצטרפתי|הצטרפנו|מתעניין|מתעניינת|נהנה|נהנית|יש לי|יש לנו|מנסה ללמוד|רוצה ללמוד/i;
const QUESTION_LIKE_PATTERN = /\?|^(מה|מתי|איפה|איך|למה|מי|האם|אפשר|יש|תוכל|תוכלי|אתה|את)\b/i;
const ENTITY_SIGNAL_PATTERN = buildEntitySignalPattern();
const LOW_SIGNAL_GROUP_MESSAGE_PATTERN = buildLowSignalGroupMessagePattern();

const OPENING_STYLES = [
    'פתיחה חמה ומשפחתית',
    'פתיחה קלילה ושובבה',
    'פתיחה קצרה ומוארת',
    'פתיחה חגיגית ועדינה',
];

const TONE_STYLES = [
    'חם ואישי',
    'רענן ואנרגטי',
    'רגוע ומהורהר',
    'חיובי ומשחקי',
];

const QUOTE_STYLES = [
    'ציטוט קצר על סקרנות ולמידה',
    'משפט קצר על משפחה ושמחה',
    'רעיון קטן על התמדה והתקדמות',
    'נגיעה משעשעת על מתמטיקה או מדעי המחשב',
];

const CLOSING_STYLES = [
    'סיום קצר ומחבק',
    'סיום אופטימי וענייני',
    'איחול קליל ליום טוב',
    'חתימה חמימה בלי לחזור על אותן מילים קבועות',
];

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildEntitySignalPattern(): RegExp {
    const terms = new Set<string>();

    for (const keyword of config.family.signalKeywords ?? []) {
        const normalized = keyword.trim();
        if (normalized) {
            terms.add(normalized);
        }
    }

    for (const member of config.family.members) {
        const name = member.name.trim();
        const relation = member.relation.trim();

        if (name) {
            terms.add(name);
        }

        if (relation) {
            terms.add(relation);
        }
    }

    const escapedTerms = Array.from(terms)
        .filter((term) => term.length > 0)
        .sort((left, right) => right.length - left.length)
        .map((term) => escapeRegex(term));

    return new RegExp(escapedTerms.join('|') || 'משפחה', 'i');
}

function buildLowSignalGroupMessagePattern(): RegExp {
    const phrases = (config.family.lowSignalGroupPhrases ?? [])
        .map((phrase) => phrase.trim())
        .filter((phrase) => phrase.length > 0)
        .map((phrase) => escapeRegex(phrase));

    return new RegExp(phrases.join('|') || '$^', 'i');
}

function buildPromptSnippet(content: string): string {
    const compact = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(0, 3)
        .join(' | ');

    return compact.length > 220 ? `${compact.slice(0, 217)}...` : compact;
}

function pickBySeed<T>(items: T[], seed: number, offset = 0): T {
    return items[Math.abs(seed + offset) % items.length];
}

function createDateSeed(date?: moment.MomentInput): number {
    let value: moment.Moment;

    if (moment.isMoment(date)) {
        value = date.clone();
    } else if (typeof date === 'string') {
        const localizedDate = moment(date, 'DD/MM/YYYY', true);
        if (localizedDate.isValid()) {
            value = localizedDate;
        } else {
            const isoDate = moment(date, moment.ISO_8601, true);
            value = isoDate.isValid() ? isoDate : moment(date);
        }
    } else {
        value = moment(date ?? moment());
    }

    return value.startOf('day').year() * 1000 + value.dayOfYear();
}

export function buildDailyVariationInstructions(date?: moment.MomentInput): string {
    const seed = createDateSeed(date);
    const opening = pickBySeed(OPENING_STYLES, seed, 0);
    const tone = pickBySeed(TONE_STYLES, seed, 3);
    const quote = pickBySeed(QUOTE_STYLES, seed, 7);
    const closing = pickBySeed(CLOSING_STYLES, seed, 11);

    return [
        'הנחיות גיוון להיום:',
        `- סגנון פתיחה מועדף: ${opening}.`,
        `- טון מוביל: ${tone}.`,
        `- סוג המשפט/ציטוט: ${quote}.`,
        `- אופי הסיום: ${closing}.`,
        '- אל תחזור על אותה מילה או אותו רעיון ביותר ממשפט אחד.',
        '- אם אין אירועים מיוחדים, שמור על מרכז ההודעה קצר ורענן בלי טקסט ממלא.',
        '- הימנע במיוחד מחזרות כמו "יום מלא", "אנרגיות טובות", או אותה פתיחת בוקר שוב ושוב.',
    ].join('\n');
}

export function isLikelyDailyMessage(content: string): boolean {
    const normalized = content.trim();
    if (!normalized || LOW_SIGNAL_GROUP_MESSAGE_PATTERN.test(normalized)) {
        return false;
    }

    return /בוקר טוב|ציטוט ליום|משפט ליום|שיהיה לכם יום|יום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)|חג[:\s]|תאריך עברי/i.test(normalized);
}

export function buildRecentDailyMemorySection(messages: string[], limit = 3): string {
    const snippets = Array.from(new Set(
        messages
            .filter((message) => isLikelyDailyMessage(message))
            .map((message) => buildPromptSnippet(message))
            .filter((snippet) => snippet.length > 0),
    ));

    const recentSnippets = snippets.slice(-limit);
    if (recentSnippets.length === 0) {
        return '';
    }

    return [
        'מסרי בוקר קודמים שנשלחו לאחרונה:',
        ...recentSnippets.map((snippet, index) => `${index + 1}. ${snippet}`),
        'אל תמחזר את אותה פתיחה, אותה חתימה או אותו ציטוט מתוך הדוגמאות האלה.',
    ].join('\n');
}

export function shouldUpdateUserSummary(
    messageText: string,
    reply: string,
    lastUpdatedAt?: number,
    now: number = Date.now(),
): boolean {
    const normalizedMessage = messageText.trim();

    if (!normalizedMessage) {
        return false;
    }

    if (TRIVIAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(normalizedMessage)) && normalizedMessage.length <= 25) {
        return false;
    }

    const hasStableSignal = STABLE_SIGNAL_PATTERN.test(normalizedMessage);
    const hasCorrectionSignal = CORRECTION_SIGNAL_PATTERN.test(normalizedMessage);
    const hasEntitySignal = ENTITY_SIGNAL_PATTERN.test(normalizedMessage);
    const hasMeaningfulDisclosure = MEANINGFUL_DISCLOSURE_PATTERN.test(normalizedMessage);
    const isQuestionLike = QUESTION_LIKE_PATTERN.test(normalizedMessage);
    const messageInformationScore = normalizedMessage.length;
    void reply;

    if (
        typeof lastUpdatedAt === 'number'
        && now - lastUpdatedAt < SUMMARY_UPDATE_COOLDOWN_MS
        && !hasCorrectionSignal
    ) {
        return false;
    }

    if (hasCorrectionSignal || hasStableSignal) {
        return true;
    }

    if (hasMeaningfulDisclosure && messageInformationScore >= 30) {
        return true;
    }

    if (isQuestionLike) {
        return false;
    }

    if (hasEntitySignal && messageInformationScore >= 25) {
        return true;
    }

    return messageInformationScore >= 120;
}

export function isLowSignalFamilyGroupMessage(content: string): boolean {
    return LOW_SIGNAL_GROUP_MESSAGE_PATTERN.test(content);
}
