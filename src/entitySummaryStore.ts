import { config } from './config';
import { UserSummaryStore } from './userSummaryStore';

export class EntitySummaryStore extends UserSummaryStore {
    constructor() {
        super(config.conversation.entitySummariesFilePath);
    }
}
