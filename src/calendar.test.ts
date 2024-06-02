import { describe, expect } from '@jest/globals';
import axios from 'axios';

import { Calendar } from './calendar';

describe('Calendar', () => {

    let calendar: Calendar;

    beforeEach(() => {
        jest.spyOn(axios, 'get').mockResolvedValue({ data: icsMock });
        jest.doMock('./config', () => ({
            config: {
                ics_list: ['mockIcs1']
            },
            log_file_path: 'log/log.log'
        }));
        const Calendar = require('./Calendar').Calendar;
        calendar = new Calendar();
    });

    it('should call getAllEvents function 1 time', async () => {
        const spyOnGetAllEvents = jest.spyOn(calendar as any, 'getAllEvents');
        const date = new Date('2024-05-19');
        await calendar.getDailyEvents(date);


        expect(spyOnGetAllEvents).toHaveBeenCalledTimes(1);
    });

    it('should return an empty array if no events are found for the given date', async () => {
        const date = new Date('2024-05-18');
        const events = await calendar.getDailyEvents(date);

        expect(events.length).toBe(0);
    });

    it('should show events for the given date', async () => {
        const date = new Date('2024-05-13');
        const events = await calendar.getDailyEvents(date);
        expect(events.length).toBe(1);
        expect(events[0].datetype).toBe('date-time');
    });

    it('should show all day event', async () => {
        const date = new Date('2024-05-14');
        const events = await calendar.getDailyEvents(date);

        expect(events.length).toBe(1);
        expect(events[0].datetype).toBe('date');
    });

    it('should show 3 day event', async () => {
        let events = await calendar.getDailyEvents(new Date('2024-05-06'));
        expect(events.length).toBe(1);
        expect(events[0].datetype).toBe('date');

        events = await calendar.getDailyEvents(new Date('2024-05-07'));
        expect(events.length).toBe(1);
        expect(events[0].datetype).toBe('date');

        events = await calendar.getDailyEvents(new Date('2024-05-08'));
        expect(events.length).toBe(1);
        expect(events[0].datetype).toBe('date');
    });

    it('should show repeat all day event', async () => {
        let events = await calendar.getDailyEvents(new Date('2024-03-31'));
        expect(events.length).toBe(1);
        expect(events[0].datetype).toBe('date');

        events = await calendar.getDailyEvents(new Date('2024-04-07'));
        expect(events.length).toBe(1);
        expect(events[0].datetype).toBe('date');

        events = await calendar.getDailyEvents(new Date('2024-04-14'));
        expect(events.length).toBe(1);
        expect(events[0].datetype).toBe('date');

        events = await calendar.getDailyEvents(new Date('2024-04-21'));
        expect(events.length).toBe(1);
        expect(events[0].datetype).toBe('date');

        events = await calendar.getDailyEvents(new Date('2024-04-28'));
        expect(events.length).toBe(1);
        expect(events[0].datetype).toBe('date');
    });

    it('should retuen repeat event on the first show', async () => {
        const date = new Date('2024-05-19');
        const events = await calendar.getDailyEvents(date);

        expect(events.length).toBe(2);
    });

    it('should show daily event', async () => {
        const date = new Date('2024-05-22');
        const events = await calendar.getDailyEvents(date);

        expect(events.length).toBe(1);
    });

    it('should show weekly event', async () => {
        const date = new Date('2024-05-26');
        const events = await calendar.getDailyEvents(date);

        expect(events.length).toBe(2);
    });

    it('should not show deleted daily event', async () => {
        const date = new Date('2024-05-21');
        const events = await calendar.getDailyEvents(date);

        expect(events.length).toBe(0);
    });

    it('should not show deleted weekly event', async () => {
        const date = new Date('2024-06-02');
        const events = await calendar.getDailyEvents(date);

        expect(events.length).toBe(1); // only the daily event will return.
    });

    it('should show daily event that edit', async () => {
        const date = new Date('2024-07-15');
        const events = await calendar.getDailyEvents(date);

        expect(events.length).toBe(3);
        expect(events[1].summary).toBe('test daily - edit and change day');
        expect(events[1].start).toStrictEqual(new Date('2024-07-15T13:15:00.000Z'));
    });

    it('should show weekly event that edit', async () => {
        const date = new Date('2024-07-15');
        const events = await calendar.getDailyEvents(date);

        expect(events.length).toBe(3);
        expect(events[0].summary).toBe('test weekly - edit and change day');
        expect(events[0].start).toStrictEqual(new Date('2024-07-15T07:30:00.000Z'));
    });

    it('should sort events by start date', async () => {
        const date = new Date('2024-07-21');
        const events = await calendar.getDailyEvents(date);

        expect(events.length).toBe(2);
        expect(events[0].summary).toBe('test weekly');
        expect(events[1].summary).toBe('test daily');
    });

    it('should adjust timezone - winter', async () => {
        const date = new Date('2024-12-22');
        const events = await calendar.getDailyEvents(date);

        expect(events.length).toBe(2);
        expect(events[0].start).toStrictEqual(new Date('2024-12-22T08:00:00.000Z'));
        expect(events[1].start).toStrictEqual(new Date('2024-12-22T19:00:00.000Z'));
    });

    it('should adjust timezone - summer', async () => {
        const date = new Date('2025-06-15');
        const events = await calendar.getDailyEvents(date);

        expect(events.length).toBe(2);
        expect(events[0].start).toStrictEqual(new Date('2025-06-15T07:00:00.000Z'));
        expect(events[1].start).toStrictEqual(new Date('2025-06-15T18:00:00.000Z'));
    });


});


const icsMock = `BEGIN:VCALENDAR
PRODID:-//Google Inc//Google Calendar 70.9054//EN
VERSION:2.0
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:test
X-WR-TIMEZONE:Asia/Jerusalem
BEGIN:VTIMEZONE
TZID:Asia/Jerusalem
X-LIC-LOCATION:Asia/Jerusalem
BEGIN:DAYLIGHT
TZOFFSETFROM:+0200
TZOFFSETTO:+0300
TZNAME:IDT
DTSTART:19700327T020000
RDATE:19700327T020000
RDATE:19710326T020000
RDATE:19720324T020000
RDATE:19730323T020000
RDATE:19740329T020000
RDATE:19750328T020000
RDATE:19760326T020000
RDATE:19770325T020000
RDATE:19780324T020000
RDATE:19790323T020000
RDATE:19800328T020000
RDATE:19810327T020000
RDATE:19820326T020000
RDATE:19830325T020000
RDATE:19840323T020000
RDATE:19850329T020000
RDATE:19860328T020000
RDATE:19870327T020000
RDATE:19880325T020000
RDATE:19890324T020000
RDATE:19900323T020000
RDATE:19910329T020000
RDATE:19920327T020000
RDATE:19930326T020000
RDATE:19940325T020000
RDATE:19950324T020000
RDATE:19960329T020000
RDATE:19970328T020000
RDATE:19980327T020000
RDATE:19990326T020000
RDATE:20000324T020000
RDATE:20010323T020000
RDATE:20020329T020000
RDATE:20030328T020000
RDATE:20040326T020000
RDATE:20050325T020000
RDATE:20060324T020000
RDATE:20070323T020000
RDATE:20080328T020000
RDATE:20090327T020000
RDATE:20100326T020000
RDATE:20110325T020000
RDATE:20120323T020000
RDATE:20130329T020000
RDATE:20140328T020000
RDATE:20150327T020000
RDATE:20160325T020000
RDATE:20170324T020000
RDATE:20180323T020000
RDATE:20190329T020000
RDATE:20200327T020000
RDATE:20210326T020000
RDATE:20220325T020000
RDATE:20230324T020000
RDATE:20240329T020000
RDATE:20250328T020000
RDATE:20260327T020000
RDATE:20270326T020000
RDATE:20280324T020000
RDATE:20290323T020000
RDATE:20300329T020000
RDATE:20310328T020000
RDATE:20320326T020000
RDATE:20330325T020000
RDATE:20340324T020000
RDATE:20350323T020000
RDATE:20360328T020000
RDATE:20370327T020000
END:DAYLIGHT
BEGIN:DAYLIGHT
TZOFFSETFROM:+0200
TZOFFSETTO:+0300
TZNAME:IDT
DTSTART:20380326T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=4FR
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0300
TZOFFSETTO:+0200
TZNAME:IST
DTSTART:19701025T020000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
DTSTART;TZID=Asia/Jerusalem:20240519T100000
DTEND;TZID=Asia/Jerusalem:20240519T103000
RRULE:FREQ=WEEKLY;BYDAY=SU
EXDATE;TZID=Asia/Jerusalem:20240602T100000
DTSTAMP:20240521T230137Z
UID:314vf9qulgnphnt75qie35pcqo@google.com
CREATED:20240521T175950Z
LAST-MODIFIED:20240521T202743Z
SEQUENCE:1
STATUS:CONFIRMED
SUMMARY:test weekly
TRANSP:TRANSPARENT
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=Asia/Jerusalem:20240519T210000
DTEND;TZID=Asia/Jerusalem:20240519T220000
RRULE:FREQ=DAILY
EXDATE;TZID=Asia/Jerusalem:20240521T210000
DTSTAMP:20240521T230137Z
UID:3lv3d1j85gbf0bq618s5rb0ugo@google.com
CREATED:20240521T180026Z
LAST-MODIFIED:20240521T202751Z
SEQUENCE:1
STATUS:CONFIRMED
SUMMARY:test daily
TRANSP:OPAQUE
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=Asia/Jerusalem:20240715T161500
DTEND;TZID=Asia/Jerusalem:20240715T171500
DTSTAMP:20240521T230137Z
UID:3lv3d1j85gbf0bq618s5rb0ugo@google.com
RECURRENCE-ID;TZID=Asia/Jerusalem:20240714T210000
CREATED:20240521T180026Z
LAST-MODIFIED:20240521T211950Z
SEQUENCE:3
STATUS:CONFIRMED
SUMMARY:test daily - edit and change day
TRANSP:OPAQUE
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=Asia/Jerusalem:20240715T103000
DTEND;TZID=Asia/Jerusalem:20240715T110000
DTSTAMP:20240521T230137Z
UID:314vf9qulgnphnt75qie35pcqo@google.com
RECURRENCE-ID;TZID=Asia/Jerusalem:20240714T100000
CREATED:20240521T175950Z
LAST-MODIFIED:20240521T212618Z
SEQUENCE:3
STATUS:CONFIRMED
SUMMARY:test weekly - edit and change day
TRANSP:TRANSPARENT
END:VEVENT
BEGIN:VEVENT
DTSTART:20240512T223000Z
DTEND:20240512T233000Z
DTSTAMP:20240521T230137Z
UID:3s33f9cr1c5vsgctekc7bbbqm1@google.com
CREATED:20240521T220512Z
LAST-MODIFIED:20240521T220512Z
SEQUENCE:0
STATUS:CONFIRMED
SUMMARY:event
TRANSP:OPAQUE
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20240514
DTEND;VALUE=DATE:20240515
DTSTAMP:20240521T230137Z
UID:3ps5q3cs6let795q9hk8rtlfa6@google.com
CREATED:20240521T220524Z
LAST-MODIFIED:20240521T220524Z
SEQUENCE:0
STATUS:CONFIRMED
SUMMARY:all day event
TRANSP:TRANSPARENT
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20240506
DTEND;VALUE=DATE:20240509
DTSTAMP:20240521T230137Z
UID:0psb1pinfqkiiajfaq70afura5@google.com
CREATED:20240521T225930Z
LAST-MODIFIED:20240521T225930Z
SEQUENCE:0
STATUS:CONFIRMED
SUMMARY:3 day event
TRANSP:TRANSPARENT
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20240331
DTEND;VALUE=DATE:20240401
RRULE:FREQ=WEEKLY;UNTIL=20240504;BYDAY=SU
DTSTAMP:20240521T230137Z
UID:71adas41jj8ljqlgjhgcrk4l7j@google.com
CREATED:20240521T230103Z
LAST-MODIFIED:20240521T230115Z
SEQUENCE:0
STATUS:CONFIRMED
SUMMARY:repeat all day event
TRANSP:TRANSPARENT
END:VEVENT
END:VCALENDAR
`;