import { TextChannel } from "discord.js";

export function startTyping(channel: TextChannel): () => void {
  channel.sendTyping().catch(() => {});

  const interval = setInterval(() => {
    channel.sendTyping().catch(() => {});
  }, 9000);

  return () => clearInterval(interval);
}
