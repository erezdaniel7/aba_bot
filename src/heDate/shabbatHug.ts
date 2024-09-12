

import { CandleLightingEvent, HavdalahEvent, HebrewCalendar, Location, ParshaEvent, TimedEvent } from '@hebcal/core';
import moment from 'moment';

export type ShabbatHugData = {
    CandleLightingTime: moment.Moment;
    HavdalahTime: moment.Moment;
    Parsha?: string;
}

export class ShabbatHug {

    public static location = new Location(30.98822, 34.93176, true, 'Asia/Jerusalem');

    public static getShabatHugimDate(date: moment.MomentInput): ShabbatHugData | null {
        const res: Partial<ShabbatHugData> = {};
        const events = HebrewCalendar.calendar({
            start: moment(date).toDate(),
            end: moment(date).add(3, 'days').toDate(),
            candlelighting: true,
            location: ShabbatHug.location,
            sedrot: true, // פרשת השבוע
            il: true,
            omer: false,
            noRoshChodesh: true,
            noMinorFast: true,
            noSpecialShabbat: true,
            noModern: true,
            noHolidays: true,
        });

        for (const ev of events) {
            if (ev instanceof CandleLightingEvent && moment(date).isSame(ev.eventTime, 'date')) {
                res.CandleLightingTime = moment(ev.eventTime);
            }
            else if (!res.CandleLightingTime) {
                return null;
            }
            else if (ev instanceof HavdalahEvent) {
                res.HavdalahTime = moment(ev.eventTime);
            }
            else if (ev instanceof ParshaEvent) {
                res.Parsha = ev.render('he');
            }
        }

        return res as ShabbatHugData;
    }

    public static isIssurMelacha(date: moment.MomentInput): boolean {
        const events = HebrewCalendar.calendar({
            start: moment(date).add(-2, 'days').toDate(),
            end: moment(date).add(1, 'days').toDate(),
            candlelighting: true,
            location: ShabbatHug.location,
            sedrot: false, // פרשת השבוע
            il: true,
            omer: false,
            noRoshChodesh: true,
            noMinorFast: true,
            noSpecialShabbat: true,
            noModern: true,
            noHolidays: true,
        });
        let res = false;
        events.sort((a, b) => (a as TimedEvent).eventTime.getTime() - (b as TimedEvent).eventTime.getTime());
        for (const ev of events) {
            if (ev instanceof CandleLightingEvent && moment(date).isAfter(ev.eventTime)) {
                res = true;
            }
            else if (ev instanceof HavdalahEvent && moment(date).isAfter(ev.eventTime)) {
                res = false;
            }
        }
        return res;
    }
}