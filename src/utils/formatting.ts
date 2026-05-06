import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Message, TextChannel } from "discord.js";

// Reserve ~30 chars for the token footer on the last chunk
const MAX_CHUNK = 1970;

function splitText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt <= 0) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

export function buildResponseButtons(
  channelId: string,
  placeholderId: string
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`redo:${channelId}:${placeholderId}`)
      .setLabel("Redo")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`extend:${channelId}:${placeholderId}`)
      .setLabel("Keep going")
      .setStyle(ButtonStyle.Secondary)
  );
}

export async function sendFormattedResponse(
  placeholder: Message,
  channel: TextChannel,
  thinking: string | null,
  reply: string,
  totalTokens: number,
  components: ActionRowBuilder<ButtonBuilder>[]
): Promise<void> {
  const footer = `\n-# ${totalTokens.toLocaleString()} tokens`;

  const parts: string[] = [];
  if (thinking && thinking.trim()) {
    parts.push("```\n" + thinking.trim() + "\n```");
  }
  parts.push(reply.trim() || "(empty response)");

  const allChunks: string[] = [];
  for (const part of parts) {
    allChunks.push(...splitText(part, MAX_CHUNK));
  }

  if (allChunks.length === 0) {
    await placeholder.edit({ content: "(empty response)" + footer, components });
    return;
  }

  // Append footer to last chunk
  allChunks[allChunks.length - 1] += footer;

  if (allChunks.length === 1) {
    await placeholder.edit({ content: allChunks[0], components });
    return;
  }

  await placeholder.edit(allChunks[0]);

  for (let i = 1; i < allChunks.length - 1; i++) {
    await channel.send(allChunks[i]);
  }

  await channel.send({ content: allChunks[allChunks.length - 1], components });
}
