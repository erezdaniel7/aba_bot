import { AzureOpenAI } from 'openai';
import { config } from './config';

export class AiMessageGenerator {

    private client: AzureOpenAI;

    constructor() {
        this.client = new AzureOpenAI({
            endpoint: config.azureOpenAI.endpoint,
            apiKey: config.azureOpenAI.apiKey,
            apiVersion: config.azureOpenAI.apiVersion,
            deployment: config.azureOpenAI.deploymentName,
        });
    }

    async generateMessage(prompt: string, systemPrompt: string, conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []): Promise<string> {
        const response = await this.client.chat.completions.create({
            model: config.azureOpenAI.deploymentName,
            messages: [
                { role: 'system', content: systemPrompt },
                ...conversationHistory,
                { role: 'user', content: prompt },
            ],
        });

        return response.choices[0]?.message?.content ?? '';
    }
}
