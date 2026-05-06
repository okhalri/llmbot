export interface CachedMessage {
  discordId: string;
  authorId: string;
  displayName: string;
  content: string;
  isBot: boolean;
  timestamp: Date;
  promptTokens?: number;
  completionTokens?: number;
}

export interface ChannelCache {
  contextStartedAt: Date;
  contextStartMessageId: string | null;
  lastFetchedMessageId: string | null;
  messages: CachedMessage[];
  lastAssistantMessageIndex: number | null;
}

export interface GuildState {
  isActive: boolean;
  systemPrompt: string;
  botDisplayName: string;
  temperature: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  includeUserPrompt: boolean;
}


export interface DeepSeekResult {
  thinking: string | null;
  reply: string;
  promptTokens: number;
  completionTokens: number;
}

export class DeepSeekError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeepSeekError";
  }
}
