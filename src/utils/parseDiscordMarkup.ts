import { Guild } from "discord.js";

export async function resolveMarkup(
  content: string,
  guild: Guild,
  botUserId: string
): Promise<string> {
  // Strip bot mention
  content = content.replace(new RegExp(`<@!?${botUserId}>`, "g"), "").trim();

  // Resolve user mentions <@userId> and <@!userId>
  const userMentions = [...content.matchAll(/<@!?(\d+)>/g)];
  for (const match of userMentions) {
    const userId = match[1];
    try {
      const member = await guild.members.fetch(userId);
      content = content.replace(match[0], `@${member.displayName}`);
    } catch {
      content = content.replace(match[0], `@${userId}`);
    }
  }

  // Resolve channel mentions <#channelId>
  content = content.replace(/<#(\d+)>/g, (_match, channelId: string) => {
    const ch = guild.channels.cache.get(channelId);
    return ch ? `#${ch.name}` : `#${channelId}`;
  });

  // Resolve custom emojis <:name:id> and animated <a:name:id>
  content = content.replace(/<a?:(\w+):\d+>/g, (_match, name: string) => `:${name}:`);

  // Resolve timestamps <t:unixSeconds:format>
  content = content.replace(/<t:(\d+)(?::[tTdDfFR])?>/g, (_match, ts: string) => {
    const date = new Date(parseInt(ts, 10) * 1000);
    return date.toLocaleString();
  });

  return content.trim();
}
