import { Message, TextChannel } from "discord.js";
import { config } from "../config";
import {
  syncAndGetContext,
  hasChannel,
  appendBotMessage,
} from "../store/channelStore";
import {
  getIsActive,
  getFullSystemPrompt,
  recordUsage,
  getUsage,
  getBotDisplayName,
} from "../store/guildStore";
import { getChatCompletion, getChatCompletionWithImages } from "../deepseek";
import { errorEmbed } from "../utils/embeds";
import { startTyping } from "../utils/typing";
import { buildResponseButtons, sendFormattedResponse } from "../utils/formatting";
import { resolveMarkup } from "../utils/parseDiscordMarkup";

export const processingChannels = new Set<string>();

export async function handleMessageCreate(message: Message): Promise<void> {
  // 1. Ignore bots
  if (message.author.bot) return;

  // 2. DM check
  if (!message.guild) {
    await message.reply({ embeds: [errorEmbed("This bot only works inside the authorized server.")] });
    return;
  }

  // 3. Guild whitelist
  if (message.guild.id !== config.allowedGuildId) {
    await message.reply({ embeds: [errorEmbed("This server is not authorized.")] });
    return;
  }

  // 4. Active check
  if (!getIsActive()) return;

  // 5. Bot must be mentioned
  const botUserId = message.client.user?.id;
  if (!botUserId || !message.mentions.users.has(botUserId)) return;

  // 6. Channel must be initialized
  if (!hasChannel(message.channelId)) {
    await message.reply({ embeds: [errorEmbed("Use /start to activate the bot in this channel first.")] });
    return;
  }

  // 7. One response at a time per channel
  if (processingChannels.has(message.channelId)) {
    await message.reply({ embeds: [errorEmbed("Already processing a response in this channel. Please wait.")] });
    return;
  }
  processingChannels.add(message.channelId);

  const channel = message.channel as TextChannel;
  const stopTyping = startTyping(channel);

  try {
    const resolvedContent = await resolveMarkup(message.content, message.guild, botUserId);

    const contextMessages = await syncAndGetContext(channel, botUserId);
    const messages = [
      { role: "system" as const, content: getFullSystemPrompt() },
      ...contextMessages,
    ];

    // Collect image attachments
    const imageUrls: string[] = [];
    for (const attachment of message.attachments.values()) {
      if (attachment.contentType?.startsWith("image/")) {
        imageUrls.push(attachment.url);
      }
    }

    // Override last user message with resolved content
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIdx !== -1) {
      const actualIdx = messages.length - 1 - lastUserIdx;
      messages[actualIdx] = {
        role: "user",
        content: `${message.member?.displayName ?? message.author.username}: ${resolvedContent}`,
      };
    } else {
      messages.push({
        role: "user",
        content: `${message.member?.displayName ?? message.author.username}: ${resolvedContent}`,
      });
    }

    const placeholder = await message.reply("...");

    const result = imageUrls.length > 0
      ? await getChatCompletionWithImages(messages, imageUrls)
      : await getChatCompletion(messages);

    stopTyping();
    recordUsage(result.promptTokens, result.completionTokens);
    const { promptTokens, completionTokens } = getUsage();

    const buttons = buildResponseButtons(message.channelId, placeholder.id);
    await sendFormattedResponse(
      placeholder,
      channel,
      result.thinking,
      result.reply,
      promptTokens + completionTokens,
      [buttons]
    );

    appendBotMessage(message.channelId, {
      discordId: placeholder.id,
      authorId: botUserId,
      displayName: getBotDisplayName(),
      content: result.reply,
      isBot: true,
      timestamp: new Date(),
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });

    message.client.user?.setPresence({
      status: "online",
      activities: [{ name: `#${channel.name}`, type: 3 }],
    });
  } catch (err) {
    stopTyping();
    const msg = err instanceof Error ? err.message : String(err);
    await message.reply({ embeds: [errorEmbed(msg)] }).catch(() => {});
  } finally {
    processingChannels.delete(message.channelId);
  }
}
