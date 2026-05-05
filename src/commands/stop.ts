import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { clearAllChannels } from "../store/channelStore";
import { resetAll } from "../store/guildStore";

export const data = new SlashCommandBuilder()
  .setName("stop")
  .setDescription("Stop the bot and clear all state");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  resetAll();
  clearAllChannels();

  interaction.client.user?.setPresence({
    status: "idle",
    activities: [{ name: "Stopped", type: 4 }],
  });

  await interaction.reply("Bot stopped. All channel context cleared. Token usage totals preserved.");
}
