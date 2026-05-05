import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { setTemperature, setBotDisplayName, getTemperature, getBotDisplayName } from "../store/guildStore";
import { errorEmbed } from "../utils/embeds";

export const data = new SlashCommandBuilder()
  .setName("config")
  .setDescription("Update bot configuration")
  .addNumberOption((opt) =>
    opt
      .setName("temperature")
      .setDescription("Response temperature (0.0 – 2.0)")
      .setRequired(false)
      .setMinValue(0.0)
      .setMaxValue(2.0)
  )
  .addStringOption((opt) =>
    opt
      .setName("bot_name")
      .setDescription("Display name for the bot")
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const temperatureOpt = interaction.options.getNumber("temperature");
  const botNameOpt = interaction.options.getString("bot_name");

  if (temperatureOpt === null && botNameOpt === null) {
    await interaction.reply({ embeds: [errorEmbed("Provide at least one option to update.")] });
    return;
  }

  if (temperatureOpt !== null) {
    if (temperatureOpt < 0 || temperatureOpt > 2) {
      await interaction.reply({ embeds: [errorEmbed("Temperature must be between 0.0 and 2.0.")] });
      return;
    }
    setTemperature(temperatureOpt);
  }

  if (botNameOpt !== null) {
    setBotDisplayName(botNameOpt);
  }

  await interaction.reply(
    `**Config updated**\n` +
    `Temperature: \`${getTemperature()}\`\n` +
    `Bot name: \`${getBotDisplayName()}\``
  );
}
