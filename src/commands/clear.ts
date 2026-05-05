import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { clearChannel } from "../store/channelStore";

export const data = new SlashCommandBuilder()
  .setName("clear")
  .setDescription("Clear the conversation context for this channel");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  clearChannel(interaction.channelId);
  await interaction.reply("Context cleared for this channel.");
}
