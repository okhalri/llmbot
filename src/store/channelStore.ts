import { TextChannel } from "discord.js";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { CachedMessage, ChannelCache } from "../types";
import { getChatCompletion } from "../deepseek";
import { resolveMarkup } from "../utils/parseDiscordMarkup";

const MAX_CONTEXT_MESSAGES = 200;

const store = new Map<string, ChannelCache>();

export function getStore(): Map<string, ChannelCache> {
  return store;
}

export function hasChannel(channelId: string): boolean {
  return store.has(channelId);
}

export function initChannel(
  channelId: string,
  startedAt: Date,
  anchorMessageId: string | null
): void {
  store.set(channelId, {
    contextStartedAt: startedAt,
    contextStartMessageId: anchorMessageId,
    lastFetchedMessageId: null,
    messages: [],
    lastAssistantMessageIndex: null,
  });
}

export function clearChannel(channelId: string): void {
  store.delete(channelId);
}

export function clearAllChannels(): void {
  store.clear();
}

export function appendBotMessage(channelId: string, msg: CachedMessage): void {
  const cache = store.get(channelId);
  if (!cache) return;
  cache.messages.push(msg);
  cache.lastAssistantMessageIndex = cache.messages.length - 1;
}

export function getLastAssistantMessageIndex(channelId: string): number | null {
  return store.get(channelId)?.lastAssistantMessageIndex ?? null;
}

export function getLastAssistantMessageId(channelId: string): string | null {
  const cache = store.get(channelId);
  if (!cache || cache.lastAssistantMessageIndex === null) return null;
  return cache.messages[cache.lastAssistantMessageIndex]?.discordId ?? null;
}

export function setChannelFence(channelId: string, fenceId: string): void {
  const cache = store.get(channelId);
  if (cache && cache.contextStartMessageId === null && cache.lastFetchedMessageId === null) {
    cache.contextStartMessageId = fenceId;
  }
}

export function popLastAssistantMessage(channelId: string): void {
  const cache = store.get(channelId);
  if (!cache || cache.lastAssistantMessageIndex === null) return;
  cache.messages.splice(cache.lastAssistantMessageIndex, 1);
  cache.lastAssistantMessageIndex = null;
}

// Removes all consecutive bot messages from the end of the cache.
// Returns their discordIds and the summed token counts for deduction.
export function popTrailingBotMessages(channelId: string): {
  ids: string[];
  promptTokens: number;
  completionTokens: number;
} {
  const cache = store.get(channelId);
  if (!cache) return { ids: [], promptTokens: 0, completionTokens: 0 };
  const ids: string[] = [];
  let promptTokens = 0;
  let completionTokens = 0;
  while (cache.messages.length > 0 && cache.messages[cache.messages.length - 1].isBot) {
    const msg = cache.messages.pop()!;
    ids.push(msg.discordId);
    promptTokens += msg.promptTokens ?? 0;
    completionTokens += msg.completionTokens ?? 0;
  }
  cache.lastAssistantMessageIndex = null;
  return { ids, promptTokens, completionTokens };
}

export async function syncAndGetContext(
  channel: TextChannel,
  botUserId: string
): Promise<ChatCompletionMessageParam[]> {
  const cache = store.get(channel.id);
  if (!cache) return [];

  await fetchNewMessages(channel, cache, botUserId);

  if (cache.messages.length >= MAX_CONTEXT_MESSAGES) {
    await summarizeOldMessages(cache);
  }

  return buildMessageParams(cache, botUserId);
}

async function fetchNewMessages(
  channel: TextChannel,
  cache: ChannelCache,
  botUserId: string
): Promise<void> {
  // No fence set yet — skip until start.ts stamps the reply ID as fence
  if (cache.lastFetchedMessageId === null && cache.contextStartMessageId === null) return;

  try {
    let afterId =
      cache.lastFetchedMessageId ??
      cache.contextStartMessageId ??
      undefined;

    const fetched: CachedMessage[] = [];

    while (true) {
      const batch = await channel.messages.fetch({
        after: afterId,
        limit: 100,
      });

      if (batch.size === 0) break;

      for (const msg of batch.values()) {
        if (msg.author.bot && msg.author.id !== botUserId) continue;
        if (msg.interaction) continue;

        const content = await resolveMarkup(msg.content, channel.guild, botUserId);
        fetched.push({
          discordId: msg.id,
          authorId: msg.author.id,
          displayName: msg.member?.displayName ?? msg.author.username,
          content,
          isBot: msg.author.id === botUserId,
          timestamp: msg.createdAt,
        });
      }

      if (batch.size < 100) break;

      const sorted = [...batch.values()].sort((a, b) =>
        a.id.localeCompare(b.id)
      );
      afterId = sorted[sorted.length - 1].id;
    }

    if (fetched.length === 0) return;

    fetched.sort((a, b) => a.discordId.localeCompare(b.discordId));

    const existingIds = new Set(cache.messages.map((m) => m.discordId));
    for (const msg of fetched) {
      if (!existingIds.has(msg.discordId)) {
        cache.messages.push(msg);
      }
    }

    cache.messages.sort((a, b) => a.discordId.localeCompare(b.discordId));

    if (cache.messages.length > 0) {
      cache.lastFetchedMessageId =
        cache.messages[cache.messages.length - 1].discordId;
    }
  } catch (err) {
    console.error("[channelStore] Failed to fetch messages:", err);
  }
}

async function summarizeOldMessages(cache: ChannelCache): Promise<void> {
  const halfCount = Math.floor(MAX_CONTEXT_MESSAGES / 2);
  const toSummarize = cache.messages.slice(0, halfCount);

  const transcript = toSummarize
    .map((m) => `${m.displayName}: ${m.content}`)
    .join("\n");

  try {
    const result = await getChatCompletion(
      [
        {
          role: "user",
          content: `Summarize the following conversation concisely, preserving key facts, decisions, and context:\n\n${transcript}`,
        },
      ],
      true
    );

    const summary: CachedMessage = {
      discordId: `summary-${Date.now()}`,
      authorId: "summary",
      displayName: "Summary",
      content: result.reply,
      isBot: false,
      timestamp: new Date(),
    };

    cache.messages = [summary, ...cache.messages.slice(halfCount)];
  } catch (err) {
    console.error("[channelStore] Summarization failed, dropping old messages:", err);
    cache.messages = cache.messages.slice(halfCount);
  }
}

function buildMessageParams(
  cache: ChannelCache,
  botUserId: string
): ChatCompletionMessageParam[] {
  const params: ChatCompletionMessageParam[] = [];

  for (const msg of cache.messages) {
    if (msg.authorId === "summary") {
      params.push({
        role: "system",
        content: `Previous conversation summary: ${msg.content}`,
      });
    } else if (msg.isBot || msg.authorId === botUserId) {
      params.push({ role: "assistant", content: msg.content });
    } else {
      params.push({
        role: "user",
        content: `${msg.displayName}: ${msg.content}`,
      });
    }
  }

  return params;
}
