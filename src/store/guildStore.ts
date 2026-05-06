import { config } from "../config";
import { GuildState } from "../types";

const state: GuildState = {
  isActive: false,
  systemPrompt: config.systemPrompt,
  botDisplayName: config.botDisplayName,
  temperature: config.deepseekTemperature,
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  includeUserPrompt: true,
};

export function getState(): GuildState {
  return { ...state };
}

export function getIsActive(): boolean {
  return state.isActive;
}

export function setActive(val: boolean): void {
  state.isActive = val;
}

export function getSystemPrompt(): string {
  return state.systemPrompt;
}

export function getFullSystemPrompt(): string {
  const parts = [config.basePrompt, state.systemPrompt];
  if (state.includeUserPrompt) parts.push(config.userPrompt);
  return parts.map((p) => p.trim()).filter(Boolean).join("\n\n");
}

export function setIncludeUserPrompt(val: boolean): void {
  state.includeUserPrompt = val;
}

export function setSystemPrompt(text: string): void {
  state.systemPrompt = text;
}

export function getTemperature(): number {
  return state.temperature;
}

export function setTemperature(val: number): void {
  state.temperature = val;
}

export function getBotDisplayName(): string {
  return state.botDisplayName;
}

export function setBotDisplayName(name: string): void {
  state.botDisplayName = name;
}

export function getUsage(): { promptTokens: number; completionTokens: number } {
  return {
    promptTokens: state.totalPromptTokens,
    completionTokens: state.totalCompletionTokens,
  };
}

export function recordUsage(promptTokens: number, completionTokens: number): void {
  state.totalPromptTokens += promptTokens;
  state.totalCompletionTokens += completionTokens;
}

export function resetAll(): void {
  state.isActive = false;
  state.systemPrompt = config.systemPrompt;
  state.botDisplayName = config.botDisplayName;
  state.temperature = config.deepseekTemperature;
  state.includeUserPrompt = true;
}
