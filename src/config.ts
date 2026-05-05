import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

export interface Config {
  discordToken: string;
  deepseekApiKey: string;
  allowedGuildId: string;
  deepseekModel: string;
  deepseekTemperature: number;
  botDisplayName: string;
  basePrompt: string;
}

function loadEnv(): Config {
  dotenv.config({ override: true });

  const required = {
    discordToken: process.env.DISCORD_TOKEN,
    deepseekApiKey: process.env.DEEPSEEK_API_KEY,
    allowedGuildId: process.env.ALLOWED_GUILD_ID,
  };

  for (const [key, value] of Object.entries(required)) {
    if (!value || value.trim() === "") {
      throw new Error(
        `Missing required environment variable: ${key.replace(/([A-Z])/g, "_$1").toUpperCase()}`
      );
    }
  }

  const temperature = parseFloat(process.env.DEEPSEEK_TEMPERATURE ?? "0.7");
  if (isNaN(temperature) || temperature < 0 || temperature > 2) {
    throw new Error(
      "DEEPSEEK_TEMPERATURE must be a number between 0.0 and 2.0"
    );
  }

  return {
    discordToken: required.discordToken!,
    deepseekApiKey: required.deepseekApiKey!,
    allowedGuildId: required.allowedGuildId!,
    deepseekModel: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    deepseekTemperature: temperature,
    botDisplayName: process.env.BOT_DISPLAY_NAME ?? "Assistant",
    basePrompt: process.env.BASE_PROMPT ?? "",
  };
}

export let config: Config = loadEnv();

let reloadTimeout: NodeJS.Timeout | null = null;

const envPath = path.resolve(process.cwd(), ".env");

fs.watch(envPath, () => {
  if (reloadTimeout) clearTimeout(reloadTimeout);
  reloadTimeout = setTimeout(() => {
    try {
      config = loadEnv();
      console.log("[config] .env reloaded successfully");
    } catch (err) {
      console.error("[config] Failed to reload .env:", err);
    }
  }, 1000);
});
