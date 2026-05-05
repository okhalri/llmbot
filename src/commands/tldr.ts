import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel } from "discord.js";
import { syncAndGetContext, hasChannel } from "../store/channelStore";
import { getChatCompletion } from "../deepseek";
import { errorEmbed } from "../utils/embeds";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const data = new SlashCommandBuilder()
  .setName("tldr")
  .setDescription("Summarize the current conversation in this channel");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const channelId = interaction.channelId;

  if (!hasChannel(channelId)) {
    await interaction.reply({ embeds: [errorEmbed("Use /start to activate the bot in this channel first.")] });
    return;
  }

  await interaction.deferReply();

  const channel = interaction.channel as TextChannel;
  const messages = await syncAndGetContext(channel, interaction.client.user!.id);

  if (messages.length === 0) {
    await interaction.editReply("No conversation to summarize yet.");
    return;
  }

  const transcript = messages
    .map((m) => {
      const role = m.role;
      const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      return `[${role}]: ${content}`;
    })
    .join("\n");

  const summaryMessages: ChatCompletionMessageParam[] = [
    {
      role: "user",
      content: `Summarize the following conversation in a few sentences, capturing the main topics and any conclusions reached:\n\n${transcript}`,
    },
  ];

  try {
    const result = await getChatCompletion(summaryMessages, true);
    await interaction.editReply(result.reply);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await interaction.editReply({ embeds: [errorEmbed(msg)] });
  }
}
