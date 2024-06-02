import ical from 'node-ical';
import axios from 'axios';
import moment from 'moment-timezone';


import { config } from './config';

export class Calendar {

    private async getAllEvents(icsURL: string): Promise<ical.VEvent[]> {
        const { data } = await axios.get(icsURL);
        const events = ical.sync.parseICS(data)

        const eventsArray = [];

        for (const k in events) {
            if (events.hasOwnProperty(k) && events[k].type === 'VEVENT') {
                eventsArray.push(events[k] as ical.VEvent);
            }
        }

        return eventsArray;
    }

    public async getDailyEvents(date?: moment.MomentInput): Promise<ical.VEvent[]> {
        const start = moment(date).startOf('day');
        const end = moment(date).endOf('day');
        const events = [];

        for (const icsURL of config.ics_list) {
            const eventsArray = await this.getAllEvents(icsURL);
            for (const event of eventsArray) {
                if (event.rrule) {
                    // Calculate occurrences within a date range 
                    const occurrences = event.rrule.between(start.toDate(), moment(end).add(1, 'second').toDate());
                    if (occurrences.length > 0) {
                        occurrences.forEach((occurrence) => {
                            // if event is not rescheduled (will handle later) or deleted
                            if (!event.recurrences?.[moment(occurrence).format('YYYY-MM-DD')] &&
                                !event.exdate?.[moment(occurrence).format('YYYY-MM-DD')]) {
                                // Adjust timezone
                                const timeZoneOffset = event.rrule?.options.tzid ? moment.tz(event.start, event.rrule.options.tzid).utcOffset() - moment.tz(occurrence, event.rrule.options.tzid).utcOffset() : 0;
                                let eventCopy = JSON.parse(JSON.stringify(event));
                                eventCopy.start = moment(occurrence).add(timeZoneOffset, 'minutes').toDate();
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
                }
                else {
                    const eventStart = moment(event.start);
                    const eventEnd = moment(event.end);
                    if (eventStart.isBetween(start, end, undefined, '[)') || (eventStart.isBefore(start) && eventEnd.isAfter(start))) {
                        events.push(event);
                    }
                }
            }
        }

        events.sort((a, b) => { return moment(a.start).diff(moment(b.start)) });

        return events;
    }
}
