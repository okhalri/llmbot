import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel } from "discord.js";
import {
  getLastAssistantMessageIndex,
  popLastAssistantMessage,
  syncAndGetContext,
  appendBotMessage,
  hasChannel,
} from "../store/channelStore";
import { getFullSystemPrompt, recordUsage, getBotDisplayName } from "../store/guildStore";
import { getChatCompletion } from "../deepseek";
import { errorEmbed } from "../utils/embeds";
import { startTyping } from "../utils/typing";
import { sendFormattedResponse } from "../utils/formatting";

export const data = new SlashCommandBuilder()
  .setName("retry")
  .setDescription("Retry the last bot response in this channel");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const channelId = interaction.channelId;

  if (!hasChannel(channelId)) {
    await interaction.reply({ embeds: [errorEmbed("Use /start to activate the bot in this channel first.")] });
    return;
  }

  if (getLastAssistantMessageIndex(channelId) === null) {
    await interaction.reply({ embeds: [errorEmbed("No previous response to retry.")] });
    return;
  }

  await interaction.deferReply();

  const channel = interaction.channel as TextChannel;
  const stopTyping = startTyping(channel);

  try {
    popLastAssistantMessage(channelId);

    const contextMessages = await syncAndGetContext(channel, interaction.client.user!.id);
    const messages = [
      { role: "system" as const, content: getFullSystemPrompt() },
      ...contextMessages,
    ];

    const result = await getChatCompletion(messages);
    stopTyping();

    recordUsage(result.promptTokens, result.completionTokens);

    const placeholder = await interaction.editReply("...");

    await sendFormattedResponse(placeholder, channel, result.thinking, result.reply);

    appendBotMessage(channelId, {
      discordId: placeholder.id,
      authorId: interaction.client.user!.id,
      displayName: getBotDisplayName(),
      content: result.reply,
      isBot: true,
      timestamp: new Date(),
    });
  } catch (err) {
    stopTyping();
    const msg = err instanceof Error ? err.message : String(err);
    await interaction.editReply({ embeds: [errorEmbed(msg)] });
  }
}
