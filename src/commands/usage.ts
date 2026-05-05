import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getUsage } from "../store/guildStore";

// Approximate DeepSeek pricing (USD per million tokens, as of late 2024)
const PRICE_PER_M_INPUT = 0.14;
const PRICE_PER_M_OUTPUT = 0.28;

export const data = new SlashCommandBuilder()
  .setName("usage")
  .setDescription("Show token usage since the bot was first started");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const { promptTokens, completionTokens } = getUsage();
  const total = promptTokens + completionTokens;

  const inputCost = (promptTokens / 1_000_000) * PRICE_PER_M_INPUT;
  const outputCost = (completionTokens / 1_000_000) * PRICE_PER_M_OUTPUT;
  const totalCost = inputCost + outputCost;

  await interaction.reply(
    `**Token Usage**\n` +
    `Prompt tokens: \`${promptTokens.toLocaleString()}\`\n` +
    `Completion tokens: \`${completionTokens.toLocaleString()}\`\n` +
    `Total tokens: \`${total.toLocaleString()}\`\n\n` +
    `**Estimated Cost** (deepseek-chat pricing)\n` +
    `Input: $${inputCost.toFixed(6)}\n` +
    `Output: $${outputCost.toFixed(6)}\n` +
    `Total: $${totalCost.toFixed(6)}`
  );
}
