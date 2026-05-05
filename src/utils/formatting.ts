import { Message, TextChannel } from "discord.js";

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

export async function sendFormattedResponse(
  placeholder: Message,
  channel: TextChannel,
  thinking: string | null,
  reply: string
): Promise<void> {
  const parts: string[] = [];

  if (thinking && thinking.trim()) {
    const thinkingBlock = "```\n" + thinking.trim() + "\n```";
    parts.push(thinkingBlock);
  }

  parts.push(reply.trim() || "(empty response)");

  const allChunks: string[] = [];
  for (const part of parts) {
    allChunks.push(...splitText(part, 2000));
  }

  if (allChunks.length === 0) {
    await placeholder.edit("(empty response)");
    return;
  }

  await placeholder.edit(allChunks[0]);

  for (let i = 1; i < allChunks.length; i++) {
    await channel.send(allChunks[i]);
  }
}
