export const config = {

    httpServer: {
        port: 3000,
        whitelistChatIds: [
            '', // Add allowed chat IDs here
        ]
    },

    whatsApp: {
        adminChatId: '',
        testGroupChatId: '',
        groupChatId: '',
        users: [
            '',
            '',
            '',
            '',
        ]
    },

    ics_list: [
        'https://calendar.google.com/calendar/ical/....',
    ],

    log_file_path: 'log/log.log'

};
