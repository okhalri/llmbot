import { EmbedBuilder } from "discord.js";

export function errorEmbed(description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle("Error")
    .setDescription(description);
}
