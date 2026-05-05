export interface ParsedMessageLink {
  guildId: string;
  channelId: string;
  messageId: string;
}

const LINK_PATTERN =
  /^https:\/\/(?:ptb\.|canary\.)?discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)$/;

export function parseMessageLink(link: string): ParsedMessageLink | null {
  const match = link.trim().match(LINK_PATTERN);
  if (!match) return null;
  return {
    guildId: match[1],
    channelId: match[2],
    messageId: match[3],
  };
}
