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

    family: {
        description: 'Short shared context about the family.',
        members: [
            {
                relation: 'Dad',
                name: 'Dad',
                gender: 'male',
                phoneNumber: '972XXXXXXXXX@c.us',
                shortDescription: 'Short helpful info about this family member.',
            },
        ],
    },

    azureOpenAI: {
        endpoint: '',
        apiKey: '',
        deploymentName: '',
        apiVersion: '2024-12-01-preview',
    },

    ics_list: [
        'https://calendar.google.com/calendar/ical/....',
    ],

    conversation: {
        userSummariesFilePath: 'data/user-summaries.json',
        chatHistoryFilePath: 'data/chat-history.json',
    },

    log_file_path: 'log/log.log',
    ai_log_file_path: 'log/ai.log'

};
