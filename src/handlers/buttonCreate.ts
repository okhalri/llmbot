import { ButtonInteraction, TextChannel } from "discord.js";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { processingChannels } from "./messageCreate";
import {
  syncAndGetContext,
  appendBotMessage,
  popTrailingBotMessages,
  getLastAssistantMessageId,
  hasChannel,
} from "../store/channelStore";
import { getFullSystemPrompt, recordUsage, subtractUsage, getUsage, getBotDisplayName } from "../store/guildStore";
import { getChatCompletion } from "../deepseek";
import { errorEmbed } from "../utils/embeds";
import { startTyping } from "../utils/typing";
import { buildResponseButtons, sendFormattedResponse } from "../utils/formatting";

export async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(":");
  const action = parts[0];
  const channelId = parts[1];
  const placeholderId = parts[2];

  if (!channelId || !placeholderId) return;

  if (!hasChannel(channelId)) {
    await interaction.reply({ embeds: [errorEmbed("No active session in this channel.")], ephemeral: true });
    return;
  }

  // Only the most recent response gets live buttons
  if (getLastAssistantMessageId(channelId) !== placeholderId) {
    await interaction.reply({ embeds: [errorEmbed("This button only works on the most recent response.")], ephemeral: true });
    return;
  }

  if (processingChannels.has(channelId)) {
    await interaction.reply({ embeds: [errorEmbed("Already processing a response in this channel.")], ephemeral: true });
    return;
  }

  if (action === "redo") {
    await handleRedo(interaction, channelId, placeholderId);
  } else if (action === "extend") {
    await handleExtend(interaction, channelId, placeholderId);
  }
}

async function handleRedo(
  interaction: ButtonInteraction,
  channelId: string,
  placeholderId: string
): Promise<void> {
  await interaction.deferUpdate();

  // Remove buttons and mark as redoing
  await interaction.message.edit({ components: [] }).catch(() => {});

  processingChannels.add(channelId);
  const channel = interaction.channel as TextChannel;
  const stopTyping = startTyping(channel);

  try {
    // Pop every trailing bot message from cache (covers the original response +
    // any extensions), deduct their token costs, then delete their Discord messages.
    const { ids: cachedIds, promptTokens: removedPrompt, completionTokens: removedCompletion } =
      popTrailingBotMessages(channelId);
    subtractUsage(removedPrompt, removedCompletion);

    await interaction.message.delete().catch(() => {});
    for (const id of cachedIds) {
      if (id !== interaction.message.id) {
        await channel.messages.fetch(id).then((m) => m.delete()).catch(() => {});
      }
    }

    const contextMessages = await syncAndGetContext(channel, interaction.client.user!.id);
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: getFullSystemPrompt() },
      ...contextMessages,
    ];

    const result = await getChatCompletion(messages);
    stopTyping();
    recordUsage(result.promptTokens, result.completionTokens);
    const { promptTokens, completionTokens } = getUsage();

    const placeholder = await channel.send("...");
    const buttons = buildResponseButtons(channelId, placeholder.id);
    await sendFormattedResponse(
      placeholder,
      channel,
      result.thinking,
      result.reply,
      promptTokens + completionTokens,
      [buttons]
    );

    appendBotMessage(channelId, {
      discordId: placeholder.id,
      authorId: interaction.client.user!.id,
      displayName: getBotDisplayName(),
      content: result.reply,
      isBot: true,
      timestamp: new Date(),
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });
  } catch (err) {
    stopTyping();
    const msg = err instanceof Error ? err.message : String(err);
    await channel.send({ embeds: [errorEmbed(msg)] }).catch(() => {});
  } finally {
    processingChannels.delete(channelId);
  }
}

async function handleExtend(
  interaction: ButtonInteraction,
  channelId: string,
  placeholderId: string
): Promise<void> {
  await interaction.deferUpdate();

  // Remove buttons from current message so it can't be double-clicked
  await interaction.message.edit({ components: [] }).catch(() => {});

  processingChannels.add(channelId);
  const channel = interaction.channel as TextChannel;
  const stopTyping = startTyping(channel);

  try {
    const contextMessages = await syncAndGetContext(channel, interaction.client.user!.id);
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: getFullSystemPrompt() },
      ...contextMessages,
      { role: "user", content: "Please continue." },
    ];

    const result = await getChatCompletion(messages);
    stopTyping();
    recordUsage(result.promptTokens, result.completionTokens);
    const { promptTokens, completionTokens } = getUsage();

    const placeholder = await channel.send("...");
    const buttons = buildResponseButtons(channelId, placeholder.id);
    await sendFormattedResponse(
      placeholder,
      channel,
      result.thinking,
      result.reply,
      promptTokens + completionTokens,
      [buttons]
    );

    appendBotMessage(channelId, {
      discordId: placeholder.id,
      authorId: interaction.client.user!.id,
      displayName: getBotDisplayName(),
      content: result.reply,
      isBot: true,
      timestamp: new Date(),
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });
  } catch (err) {
    stopTyping();
    const msg = err instanceof Error ? err.message : String(err);
    await channel.send({ embeds: [errorEmbed(msg)] }).catch(() => {});
  } finally {
    processingChannels.delete(channelId);
  }
}
