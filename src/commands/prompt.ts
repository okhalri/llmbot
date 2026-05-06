import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import {
  setPrompt,
  deletePrompt,
  listPrompts,
  getPrompt,
  hasPrompt,
} from "../store/promptStore";
import { errorEmbed } from "../utils/embeds";

export const data = new SlashCommandBuilder()
  .setName("prompt")
  .setDescription("Manage saved system prompts")
  .addSubcommand((sub) =>
    sub
      .setName("save")
      .setDescription("Save or overwrite a named system prompt")
      .addStringOption((opt) =>
        opt.setName("name").setDescription("Prompt name").setRequired(true).setMaxLength(50)
      )
      .addStringOption((opt) =>
        opt.setName("text").setDescription("Prompt content").setRequired(true).setMaxLength(4000)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("Delete a saved prompt")
      .addStringOption((opt) =>
        opt.setName("name").setDescription("Prompt name").setRequired(true).setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("List all saved prompts")
  )
  .addSubcommand((sub) =>
    sub
      .setName("view")
      .setDescription("Show the full content of a saved prompt")
      .addStringOption((opt) =>
        opt.setName("name").setDescription("Prompt name").setRequired(true).setAutocomplete(true)
      )
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
  const sub = interaction.options.getSubcommand();

  if (sub === "save") {
    const name = interaction.options.getString("name", true).trim();
    const text = interaction.options.getString("text", true);
    const existed = hasPrompt(name);
    setPrompt(name, text);
    await interaction.reply(
      existed ? `Prompt \`${name}\` updated.` : `Prompt \`${name}\` saved.`
    );
    return;
  }

  if (sub === "delete") {
    const name = interaction.options.getString("name", true);
    const deleted = deletePrompt(name);
    if (!deleted) {
      await interaction.reply({ embeds: [errorEmbed(`No prompt named \`${name}\`.`)] });
      return;
    }
    await interaction.reply(`Prompt \`${name}\` deleted.`);
    return;
  }

  if (sub === "list") {
    const all = listPrompts();
    if (all.length === 0) {
      await interaction.reply("No saved prompts.");
      return;
    }
    const lines = all.map((p) => `**${p.name}** — ${p.content.slice(0, 60)}${p.content.length > 60 ? "…" : ""}`);
    await interaction.reply(lines.join("\n"));
    return;
  }

  if (sub === "view") {
    const name = interaction.options.getString("name", true);
    const content = getPrompt(name);
    if (content === undefined) {
      await interaction.reply({ embeds: [errorEmbed(`No prompt named \`${name}\`.`)] });
      return;
    }
    const body = `**${name}**\n\`\`\`\n${content}\n\`\`\``;
    await interaction.reply(body.length <= 2000 ? body : { content: `**${name}**`, files: [{ attachment: Buffer.from(content, "utf-8"), name: `${name}.txt` }] });
    return;
  }
}
