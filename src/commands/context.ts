import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { syncAndGetContext, hasChannel } from "../store/channelStore";
import { errorEmbed } from "../utils/embeds";

export const data = new SlashCommandBuilder()
  .setName("context")
  .setDescription("Show the current conversation context for this channel");

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
    await interaction.editReply("No context messages yet.");
    return;
  }

  const lines = messages.map((m) => {
    const role = m.role.toUpperCase();
    const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    return `[${role}]\n${content}`;
  });

  const transcript = lines.join("\n\n---\n\n");

  if (transcript.length <= 1990) {
    await interaction.editReply("```\n" + transcript + "\n```");
    return;
  }

  const tmpPath = path.join(os.tmpdir(), `context-${channelId}-${Date.now()}.txt`);
  fs.writeFileSync(tmpPath, transcript, "utf-8");

  const attachment = new AttachmentBuilder(tmpPath, { name: "context.txt" });
  await interaction.editReply({ content: "Context too long, attached as file:", files: [attachment] });

  fs.unlinkSync(tmpPath);
}
