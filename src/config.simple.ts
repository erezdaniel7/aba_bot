import dotenv from 'dotenv';

dotenv.config({ quiet: true });

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
        identityRules: [
            '"Dad Bot" is the bot only and is not a human family member.',
            '"Dad" is a family relation of a person, not the bot name.',
            'Never merge the bot identity with a family member identity.',
        ],
        signalKeywords: [
            'family topic',
            'shared hobby',
        ],
        lowSignalGroupPhrases: [
            'system alert',
            'status ended',
        ],
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
        endpoint: process.env.AZURE_OPENAI_ENDPOINT ?? '',
        apiKey: process.env.AZURE_OPENAI_API_KEY ?? '',
        deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT ?? '',
        apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-12-01-preview',
    },

    ics_list: [
        'https://calendar.google.com/calendar/ical/....',
    ],

    conversation: {
        userSummariesFilePath: 'data/user-summaries.json',
        entitySummariesFilePath: 'data/entity-summaries.json',
        aiMetricsFilePath: 'data/ai-metrics.json',
        chatHistoryFilePath: 'data/chat-history.json',
    },

    log_file_path: 'log/log.log',
    ai_log_file_path: 'log/ai.log'

};
