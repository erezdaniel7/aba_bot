import { AzureOpenAI } from 'openai';
import type {
    ChatCompletionAssistantMessageParam,
    ChatCompletionMessageParam,
    ChatCompletionTool,
    ChatCompletionToolMessageParam,
} from 'openai/resources/chat/completions';
import { config } from './config';
import { Log } from './log';

export interface AiConversationMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface AiToolDefinition {
    tool: ChatCompletionTool;
    execute: (argumentsJson: string) => Promise<string>;
}

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

    async generateMessage(
        prompt: string,
        systemPrompt: string,
        conversationHistory: AiConversationMessage[] = [],
        tools: AiToolDefinition[] = []
    ): Promise<string> {
        const requestId = this.createRequestId();
        const messages: ChatCompletionMessageParam[] = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: prompt },
        ];

        this.logRequestStart(requestId, prompt, systemPrompt, conversationHistory, tools);

        try {
            for (let round = 0; round < 3; round++) {
                this.logRoundStart(requestId, round, messages.length);
                const response = await this.client.chat.completions.create({
                    model: config.azureOpenAI.deploymentName,
                    messages,
                    ...(tools.length > 0
                        ? {
                            tools: tools.map((toolDefinition) => toolDefinition.tool),
                            tool_choice: 'auto' as const,
                        }
                        : {}),
                });

                const message = response.choices[0]?.message;
                if (!message) {
                    this.logFinalResponse(requestId, '');
                    return '';
                }

                if (!message.tool_calls || message.tool_calls.length === 0) {
                    const finalMessage = typeof message.content === 'string' ? message.content : '';
                    this.logFinalResponse(requestId, finalMessage);
                    return finalMessage;
                }

                this.logToolCalls(requestId, round, message.tool_calls);

                const assistantMessage: ChatCompletionAssistantMessageParam = {
                    role: 'assistant',
                    content: message.content ?? null,
                    tool_calls: message.tool_calls,
                };
                messages.push(assistantMessage);

                for (const toolCall of message.tool_calls) {
                    if (!('function' in toolCall)) {
                        continue;
                    }

                    const matchingTool = tools.find((toolDefinition) => {
                        return toolDefinition.tool.type === 'function' && toolDefinition.tool.function.name === toolCall.function.name;
                    });

                    const toolResult = matchingTool
                        ? await matchingTool.execute(toolCall.function.arguments)
                        : JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` });

                    this.logToolResult(requestId, toolCall.function.name, toolCall.function.arguments, toolResult);

                    const toolMessage: ChatCompletionToolMessageParam = {
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: toolResult,
                    };
                    messages.push(toolMessage);
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            Log.logAi(`[${requestId}] ERROR\n${errorMessage}`);
            throw error;
        }

        const fallbackMessage = 'מצטער, לא הצלחתי להשלים את הבקשה כרגע.';
        this.logFinalResponse(requestId, fallbackMessage);
        return fallbackMessage;
    }

    private createRequestId(): string {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    private logRequestStart(
        requestId: string,
        prompt: string,
        systemPrompt: string,
        conversationHistory: AiConversationMessage[],
        tools: AiToolDefinition[]
    ): void {
        Log.logAi([
            `[${requestId}] REQUEST START`,
            `Model: ${config.azureOpenAI.deploymentName}`,
            `Tools: ${tools.map((toolDefinition) => toolDefinition.tool.type === 'function' ? toolDefinition.tool.function.name : toolDefinition.tool.type).join(', ') || 'none'}`,
            'System prompt:',
            systemPrompt,
            'Conversation history:',
            JSON.stringify(conversationHistory, null, 2),
            'User prompt:',
            prompt,
        ].join('\n'));
    }

    private logRoundStart(requestId: string, round: number, messageCount: number): void {
        Log.logAi(`[${requestId}] ROUND ${round + 1} START\nMessages in request: ${messageCount}`);
    }

    private logToolCalls(requestId: string, round: number, toolCalls: NonNullable<ChatCompletionAssistantMessageParam['tool_calls']>): void {
        Log.logAi([
            `[${requestId}] ROUND ${round + 1} TOOL CALLS`,
            JSON.stringify(toolCalls, null, 2),
        ].join('\n'));
    }

    private logToolResult(requestId: string, toolName: string, argumentsJson: string, toolResult: string): void {
        Log.logAi([
            `[${requestId}] TOOL RESULT`,
            `Tool: ${toolName}`,
            'Arguments:',
            argumentsJson,
            'Result:',
            toolResult,
        ].join('\n'));
    }

    private logFinalResponse(requestId: string, finalMessage: string): void {
        Log.logAi([
            `[${requestId}] FINAL RESPONSE`,
            finalMessage,
        ].join('\n'));
    }
}
