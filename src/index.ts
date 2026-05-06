import "dotenv/config";
import { Client, GatewayIntentBits, REST, Routes } from "discord.js";
import { config } from "./config";
import { getIsActive } from "./store/guildStore";
import { loadPrompts } from "./store/promptStore";
import { handleMessageCreate } from "./handlers/messageCreate";
import { handleInteractionCreate } from "./handlers/interactionCreate";

import { data as startData } from "./commands/start";
import { data as stopData } from "./commands/stop";
import { data as clearData } from "./commands/clear";
import { data as systempromptData } from "./commands/systemprompt";
import { data as retryData } from "./commands/retry";
import { data as contextData } from "./commands/context";
import { data as tldrData } from "./commands/tldr";
import { data as usageData } from "./commands/usage";
import { data as configData } from "./commands/config";
import { data as promptData } from "./commands/prompt";

const commandDefs = [
  startData,
  stopData,
  clearData,
  systempromptData,
  retryData,
  contextData,
  tldrData,
  usageData,
  configData,
  promptData,
].map((d) => d.toJSON());

async function main(): Promise<void> {
  loadPrompts();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
  });

  client.once("ready", async (c) => {
    console.log(`[bot] Logged in as ${c.user.tag}`);
    console.log(`[bot] Restricted to guild: ${config.allowedGuildId}`);

    const rest = new REST({ version: "10" }).setToken(config.discordToken);
    await rest
      .put(
        Routes.applicationGuildCommands(c.user.id, config.allowedGuildId),
        { body: commandDefs }
      )
      .then(() => console.log("[commands] Guild commands registered"))
      .catch((err) => console.error("[commands] Failed to register commands:", err));

    if (getIsActive()) {
      c.user.setPresence({ status: "online", activities: [{ name: "Active", type: 3 }] });
    } else {
      c.user.setPresence({ status: "idle", activities: [{ name: "Stopped", type: 4 }] });
    }
  });

  client.on("messageCreate", (msg) => {
    handleMessageCreate(msg).catch(console.error);
  });

  client.on("interactionCreate", (interaction) => {
    handleInteractionCreate(interaction).catch(console.error);
  });

  const shutdown = () => {
    client.destroy();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await client.login(config.discordToken);
}

main().catch((err) => {
  console.error("[bot] Fatal error during startup:", err);
  process.exit(1);
});
