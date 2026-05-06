import {
  AutocompleteInteraction,
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
  setIncludeUserPrompt,
  getSystemPrompt,
  getBotDisplayName,
} from "../store/guildStore";
import { listPrompts, getPrompt } from "../store/promptStore";
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
      .setName("stored_prompt")
      .setDescription("Use a saved named system prompt")
      .setRequired(false)
      .setAutocomplete(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("system_prompt")
      .setDescription("Inline system prompt (overrides stored_prompt if both given)")
      .setRequired(false)
  )
  .addStringOption((opt) =>
    opt
      .setName("bot_name")
      .setDescription("Display name for the bot")
      .setRequired(false)
  )
  .addBooleanOption((opt) =>
    opt
      .setName("user_prompt")
      .setDescription("Append the USER_PROMPT from .env to the system prompt")
      .setRequired(false)
  );

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused().toLowerCase();
  const choices = listPrompts()
    .filter((p) => p.name.toLowerCase().includes(focused))
    .slice(0, 25)
    .map((p) => ({ name: p.name, value: p.name }));
  await interaction.respond(choices);
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const messageLinkRaw = interaction.options.getString("message_link");
  const storedPromptName = interaction.options.getString("stored_prompt");
  const systemPromptOpt = interaction.options.getString("system_prompt");
  const botNameOpt = interaction.options.getString("bot_name");
  const userPromptOpt = interaction.options.getBoolean("user_prompt") ?? true;

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

  // Resolve system prompt: inline wins over stored, stored wins over default
  if (systemPromptOpt) {
    setSystemPrompt(systemPromptOpt);
  } else if (storedPromptName) {
    const stored = getPrompt(storedPromptName);
    if (stored === undefined) {
      await interaction.editReply({ embeds: [errorEmbed(`No saved prompt named \`${storedPromptName}\`.`)] });
      return;
    }
    setSystemPrompt(stored);
  }

  if (botNameOpt) setBotDisplayName(botNameOpt);
  setIncludeUserPrompt(userPromptOpt);

  const channelId = interaction.channelId;
  initChannel(channelId, contextStartedAt, contextStartMessageId);
  setActive(true);

  const channelMention = `<#${channelId}>`;
  const anchorDesc = contextStartMessageId
    ? `Starting from message \`${contextStartMessageId}\``
    : `Starting from now`;
  const promptLabel = systemPromptOpt
    ? "inline"
    : storedPromptName
    ? `stored: \`${storedPromptName}\``
    : "default";

  const reply = await interaction.editReply(
    `Bot activated in ${channelMention}.\n` +
    `${anchorDesc}\n` +
    `**System prompt:** ${getSystemPrompt()} *(${promptLabel})*\n` +
    `**Bot name:** ${getBotDisplayName()}`
  );

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
