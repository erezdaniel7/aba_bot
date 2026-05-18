export type OutgoingImagePayload = {
    base64: string;
    mimeType?: string;
    caption?: string;
};

export type OutgoingMessagePayload = string | OutgoingImagePayload;

export interface WhatsAppClient {
    sendMessage(chatId: string, payload: OutgoingMessagePayload): Promise<boolean>;
}
