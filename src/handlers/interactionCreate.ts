import { AutocompleteInteraction, ButtonInteraction, ChatInputCommandInteraction, Interaction } from "discord.js";
import { handleButtonInteraction } from "./buttonCreate";
import { errorEmbed } from "../utils/embeds";

type CommandModule = {
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
};

const commands = new Map<string, CommandModule>();

async function loadCommands(): Promise<void> {
  const modules = [
    "start",
    "stop",
    "clear",
    "systemprompt",
    "retry",
    "context",
    "tldr",
    "usage",
    "config",
    "prompt",
  ];

  for (const name of modules) {
    const mod = await import(`../commands/${name}`);
    commands.set(name, mod);
  }
}

loadCommands().catch(console.error);

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  if (interaction.isButton()) {
    await handleButtonInteraction(interaction as ButtonInteraction);
    return;
  }

  if (interaction.isAutocomplete()) {
    const command = commands.get(interaction.commandName);
    if (command?.autocomplete) {
      await command.autocomplete(interaction).catch(console.error);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) {
    await interaction.reply({ embeds: [errorEmbed(`Unknown command: ${interaction.commandName}`)] });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const embed = errorEmbed(msg);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [embed], ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
    }
  }
}
