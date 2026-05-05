import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { config } from "../config";
import { initChannel, setChannelFence } from "../store/channelStore";
import {
  setActive,
  setBotDisplayName,
  setSystemPrompt,
  getSystemPrompt,
  getBotDisplayName,
} from "../store/guildStore";
import { errorEmbed } from "../utils/embeds";
import { parseMessageLink } from "../utils/parseMessageLink";

export const data = new SlashCommandBuilder()
  .setName("start")
  .setDescription("Activate the bot in this channel")
  .addStringOption((opt) =>
    opt
      .setName("message_link")
      .setDescription("Discord message link to use as context anchor")
      .setRequired(false)
  )
  .addStringOption((opt) =>
    opt
      .setName("system_prompt")
      .setDescription("System prompt for the bot")
      .setRequired(false)
  )
  .addStringOption((opt) =>
    opt
      .setName("bot_name")
      .setDescription("Display name for the bot")
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const messageLinkRaw = interaction.options.getString("message_link");
  const systemPromptOpt = interaction.options.getString("system_prompt");
  const botNameOpt = interaction.options.getString("bot_name");

  let contextStartedAt = new Date();
  let contextStartMessageId: string | null = null;

  if (messageLinkRaw) {
    const parsed = parseMessageLink(messageLinkRaw);
    if (!parsed) {
      await interaction.editReply({ embeds: [errorEmbed("Invalid message link format.")] });
      return;
    }

    if (parsed.guildId !== config.allowedGuildId) {
      await interaction.editReply({ embeds: [errorEmbed("Message link points to a different server.")] });
      return;
    }

    const targetChannel = interaction.guild?.channels.cache.get(parsed.channelId);
    if (!targetChannel || !(targetChannel instanceof TextChannel)) {
      await interaction.editReply({ embeds: [errorEmbed("Could not find the channel from the message link.")] });
      return;
    }

    try {
      const targetMsg = await targetChannel.messages.fetch(parsed.messageId);
      contextStartedAt = targetMsg.createdAt;
      contextStartMessageId = targetMsg.id;
    } catch {
      await interaction.editReply({ embeds: [errorEmbed("Could not fetch the message from the link.")] });
      return;
    }
  }

  if (systemPromptOpt) setSystemPrompt(systemPromptOpt);
  if (botNameOpt) setBotDisplayName(botNameOpt);

  const channelId = interaction.channelId;
  initChannel(channelId, contextStartedAt, contextStartMessageId);
  setActive(true);

  const channelMention = `<#${channelId}>`;
  const anchorDesc = contextStartMessageId
    ? `Starting from message \`${contextStartMessageId}\``
    : `Starting from now`;

  const reply = await interaction.editReply(
    `Bot activated in ${channelMention}.\n` +
    `${anchorDesc}\n` +
    `**System prompt:** ${getSystemPrompt()}\n` +
    `**Bot name:** ${getBotDisplayName()}`
  );

  // When no anchor is given, use this reply's snowflake as the fence so
  // fetchNewMessages only sees messages that arrive after /start.
  if (!messageLinkRaw) {
    setChannelFence(channelId, reply.id);
  }

  const channel = interaction.channel;
  if (channel instanceof TextChannel) {
    interaction.client.user?.setPresence({
      status: "online",
      activities: [{ name: `#${channel.name}`, type: 3 }],
    });
  }
}
