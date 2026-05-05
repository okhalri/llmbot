import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { setSystemPrompt } from "../store/guildStore";

export const data = new SlashCommandBuilder()
  .setName("systemprompt")
  .setDescription("Set the system prompt for the bot")
  .addStringOption((opt) =>
    opt
      .setName("text")
      .setDescription("The new system prompt")
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const text = interaction.options.getString("text", true);
  setSystemPrompt(text);
  await interaction.reply(`System prompt updated:\n> ${text}`);
}
