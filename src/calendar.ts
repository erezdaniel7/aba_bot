import ical from 'node-ical';
import axios from 'axios';
import moment from 'moment-timezone';

import { config } from './config';
import { ShabbatHug } from './heDate/shabbatHug';

const HeDate = require('./heDate/heDate');

function getJwishHoliday(e: any) { switch (e.getMonth()) { case 1: if (e.getDate() == 1 || e.getDate() == 2) return "ראש השנה"; else if (e.getDate() == 3 && e.getDay() != 7) return "צום גדליה"; else if (e.getDate() == 4 && e.getDay() == 1) return "צום גדליה (נדחה)"; else if (e.getDate() == 9) return "ערב יום כיפור"; else if (e.getDate() == 10) return "יום כיפור"; else if (e.getDate() == 14) return "ערב סוכות"; else if (e.getDate() == 15) return "סוכות"; else if (e.getDate() == 16) return "א' חוה\"מ"; else if (e.getDate() == 17) return "ב' חוה\"מ"; else if (e.getDate() == 18) return "ג' חוה\"מ"; else if (e.getDate() == 19) return "ד' חוה\"מ"; else if (e.getDate() == 20) return "ה' חוה\"מ"; else if (e.getDate() == 21) return "הושענא רבה"; else if (e.getDate() == 22) return "שמיני עצרת ושמחת תורה"; break; case 2: if (e.getYear() > 5757 && (e.getDate() == 12 && e.getDay() != 6 || e.getDate() == 11 && e.getDay() == 5)) return "יום הזיכרון ליצחק רבין"; break; case 3: if (e.getDate() == 24) return "ערב חנוכה"; else if (e.getDate() == 25) return "א' חנוכה"; else if (e.getDate() == 26) return "ב' חנוכה"; else if (e.getDate() == 27) return "ג' חנוכה"; else if (e.getDate() == 28) return "ד' חנוכה"; else if (e.getDate() == 29) return "ה' חנוכה"; else if (e.getDate() == 30) return "ו' חנוכה"; break; case 4: if (e.getDate() <= 3) { var t = 0; if (HeDate.getyeartype(e.getYear()) == -1) t = 1; if (e.getDate() == 0 + t) return "ו' חנוכה"; else if (e.getDate() == 1 + t) return "ז' חנוכה"; else if (e.getDate() == 2 + t) return "זאת חנוכה" } else if (e.getDate() == 10) return "צום עשרה בטבת"; break; case 5: if (e.getDate() == 15) return "ראש השנה לאילנות"; break; case 6: if (e.getDate() == 14) return "פורים קטן"; else if (e.getDate() == 15) return "שושן פורים קטן"; break; case 7: if (e.getDate() == 11 && e.getDay() == 5 || e.getDate() == 13 && e.getDay() != 7) return "תענית אסתר"; else if (e.getDate() == 14) return "פורים"; else if (e.getDate() == 15) return "שושן פורים"; break; case 8: if (e.getDate() == 14) return "ערב פסח"; else if (e.getDate() == 15) return "פסח"; else if (e.getDate() == 16) return "א' חוה\"מ"; else if (e.getDate() == 17) return "ב' חוה\"מ"; else if (e.getDate() == 18) return "ג' חוה\"מ"; else if (e.getDate() == 19) return "ד' חוה\"מ"; else if (e.getDate() == 20) return "ה' חוה\"מ"; else if (e.getDate() == 21) return "שביעי של פסח"; if (e.getYear() >= 5711) { if (e.getDate() == 26 && e.getDay() == 5) return "יום הזיכרון לשואה ולגבורה (מוקדם)"; else if (e.getDate() == 28 && e.getDay() == 2 && e.getYear() >= 5757) return "יום הזיכרון לשואה ולגבורה (נדחה)"; else if (e.getDate() == 27 && e.getDay() != 6 && e.getDay() != 1 || e.getYear() < 5757) return "יום הזיכרון לשואה ולגבורה" } break; case 9: if (e.getYear() == 5708 && e.getDate() <= 6) { if (e.getDate() == 5) return "יום העצמאות"; if (e.getDate() == 4) return "יום הזיכרון לחללי מערכות ישראל" } if (e.getYear() >= 5709 && e.getDate() <= 6) { if (e.getDate() == 5 && e.getDay() == 4) return "יום העצמאות"; if (e.getYear() < 5714) { if (e.getDate() == 6 && e.getDay() == 1) return "יום העצמאות (נדחה)" } else { if (e.getDate() == 3 && e.getDay() == 5) return "יום העצמאות (הוקדם)" } if (e.getDate() == 4 && e.getDay() == 5) return "יום העצמאות (הוקדם)"; if (e.getYear() < 5764) { if (e.getDate() == 5 && e.getDay() == 2) return "יום העצמאות" } else { if (e.getDate() == 6 && e.getDay() == 3) return "יום העצמאות (נדחה)" } if (e.getDate() == 4 && e.getDay() == 3) return "יום הזיכרון לחללי מערכות ישראל"; if (e.getYear() < 5714) { if (e.getDate() == 4 && e.getDay() == 5) return "יום הזיכרון לחללי מערכות ישראל (הוקדם)" } else { if (e.getDate() == 2 && e.getDay() == 4) return "יום הזיכרון לחללי מערכות ישראל (הוקדם)" } if (e.getDate() == 3 && e.getDay() == 4) return "יום הזיכרון לחללי מערכות ישראל (הוקדם)"; if (e.getYear() < 5764) { if (e.getDate() == 4 && e.getDay() == 1) return "יום הזיכרון לחללי מערכות ישראל" } else { if (e.getDate() == 5 && e.getDay() == 2) return "יום הזיכרון לחללי מערכות ישראל (נדחה)" } } else if (e.getDate() == 18) return 'ל"ג בעומר'; else if (e.getDate() == 28) return "יום ירושלים"; break; case 10: if (e.getDate() == 5) return "ערב שבועות"; else if (e.getDate() == 6) return "שבועות"; break; case 11: if (e.getDate() == 17 && e.getDay() != 7) return 'צום י"ז בתמוז'; else if (e.getDate() == 18 && e.getDay() == 1) return 'צום י"ז בתמוז (נדחה)'; break; case 12: if (e.getDate() == 9 && e.getDay() != 7) return "צום ט' באב"; if (e.getDate() == 10 && e.getDay() == 1) return "צום ט' באב (נדחה)"; else if (e.getDate() == 15) return 'ט"ו באב'; break; case 13: if (e.getDate() == 29) return "ערב ראש השנה"; break }return null }

const EVENT_CACHE_TTL_MS = 60 * 60 * 1000;
const MESSAGE_DATA_CACHE_TTL_MS = 60 * 60 * 1000;

export interface CalendarUpcomingDay {
    heDate: string;
    formattedDate: string;
    holiday: string | null;
    sabbathTime: any;
    events: ical.VEvent[];
}

export interface CalendarMessageData {
    heDate: string;
    formattedDate: string;
    holiday: string | null;
    sabbathTime: any;
    events: ical.VEvent[];
    tomorrowEvents: ical.VEvent[];
    upcomingDays: CalendarUpcomingDay[];
}

export class Calendar {

    private eventCache: Map<string, { events: ical.VEvent[]; timestamp: number }> = new Map();
    private messageDataCache: Map<string, { data: CalendarMessageData; timestamp: number }> = new Map();

    public clearCache(): void {
        this.eventCache.clear();
        this.messageDataCache.clear();
    }

    private async getAllEvents(icsURL: string): Promise<ical.VEvent[]> {
        const { data } = await axios.get(icsURL);
        const events = ical.sync.parseICS(data);
        const eventsArray = [];

        for (const k in events) {
            if (events.hasOwnProperty(k) && events[k].type === 'VEVENT') {
                eventsArray.push(events[k] as ical.VEvent);
            }
        }

        return eventsArray;
    }

    public async getDailyEvents(date?: moment.MomentInput, useCache: boolean = false): Promise<ical.VEvent[]> {
        const dateKey = moment(date).format('YYYY-MM-DD');

        if (useCache) {
            const cached = this.eventCache.get(dateKey);
            if (cached && Date.now() - cached.timestamp < EVENT_CACHE_TTL_MS) {
                return cached.events;
            }
        }

        const start = moment(date).startOf('day');
        const end = moment(date).endOf('day');
        const events = [];

        for (const icsURL of config.ics_list) {
            const eventsArray = await this.getAllEvents(icsURL);
            for (const event of eventsArray) {
                if (event.rrule) {
                    const occurrences = event.rrule.between(start.toDate(), moment(end).add(1, 'second').toDate());

                    if (occurrences.length > 0) {
                        occurrences.forEach((occurrence) => {
                            const occurrenceDate = moment.utc(occurrence).format('YYYY-MM-DD');

                            if (!event.recurrences?.[occurrenceDate] && !event.exdate?.[occurrenceDate]) {
                                let adjustedStart: Date;

                                if (event.rrule?.options.tzid) {
                                    const originalLocal = moment.tz(event.start, event.rrule.options.tzid);
                                    const occurrenceUTCDate = moment.utc(occurrence).format('YYYY-MM-DD');
                                    const targetLocal = moment.tz(`${occurrenceUTCDate} ${originalLocal.format('HH:mm:ss')}`, event.rrule.options.tzid);
                                    adjustedStart = targetLocal.toDate();
                                } else {
                                    adjustedStart = occurrence;
                                }

                                const eventCopy = JSON.parse(JSON.stringify(event));
                                eventCopy.start = adjustedStart;
                                events.push(eventCopy);
                            }
                        });
                    }

                    for (const recurrencesEvent of Object.values(event.recurrences ?? {})) {
                        const eventStart = moment(recurrencesEvent.start);
                        const eventEnd = moment(recurrencesEvent.end);
                        if (eventStart.isBetween(start, end, undefined, '[)') || (eventStart.isBefore(start) && eventEnd.isAfter(start))) {
                            events.push(recurrencesEvent);
                        }
                    }
                } else {
                    const eventStart = moment(event.start);
                    const eventEnd = moment(event.end);
                    if (eventStart.isBetween(start, end, undefined, '[)') || (eventStart.isBefore(start) && eventEnd.isAfter(start))) {
                        events.push(event);
                    }
                }
            }
        }

        events.sort((a, b) => moment(a.start).diff(moment(b.start)));

        const filteredEvents = events.filter((event) => {
            return event.datetype === 'date' || moment(event.start).isBetween(start, end, undefined, '[)');
        });

        this.eventCache.set(dateKey, { events: filteredEvents, timestamp: Date.now() });

        return filteredEvents;
    }

    public async collectData(date?: moment.MomentInput, options?: { useCache?: boolean; daysAhead?: number }): Promise<CalendarMessageData> {
        const targetDate = moment(date);
        const useCache = options?.useCache ?? false;
        const daysAhead = Math.max(1, options?.daysAhead ?? 1);
        const cacheKey = `${targetDate.format('YYYY-MM-DD')}:${daysAhead}`;

        if (useCache) {
            const cached = this.messageDataCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < MESSAGE_DATA_CACHE_TTL_MS) {
                return cached.data;
            }
        }

        const heDate = new HeDate(targetDate.toDate());
        const holiday = getJwishHoliday(heDate);
        const sabbathTime = ShabbatHug.getShabatHugimData(moment(targetDate));
        const events = await this.getDailyEvents(targetDate, useCache);
        const tomorrowEvents = sabbathTime
            ? await this.getDailyEvents(moment(targetDate).add(1, 'day'), useCache)
            : [];

        const upcomingDays: CalendarUpcomingDay[] = [];
        for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
            const currentDate = moment(targetDate).add(dayOffset, 'day');
            const currentHeDate = new HeDate(currentDate.toDate());
            const dailyEvents = dayOffset === 0
                ? events
                : await this.getDailyEvents(currentDate, useCache);

            upcomingDays.push({
                heDate: currentHeDate.toString(),
                formattedDate: currentDate.format('DD/MM/YYYY'),
                holiday: getJwishHoliday(currentHeDate),
                sabbathTime: ShabbatHug.getShabatHugimData(moment(currentDate)),
                events: dailyEvents,
            });
        }

        const data: CalendarMessageData = {
            heDate: heDate.toString(),
            formattedDate: targetDate.format('DD/MM/YYYY'),
            holiday,
            sabbathTime,
            events,
            tomorrowEvents,
            upcomingDays,
        };

        if (useCache) {
            this.messageDataCache.set(cacheKey, { data, timestamp: Date.now() });
        }

        return data;
    }
}
