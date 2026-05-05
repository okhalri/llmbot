import { config } from "../config";
import { GuildState } from "../types";

const state: GuildState = {
  isActive: false,
  systemPrompt: "You are a helpful assistant.",
  botDisplayName: config.botDisplayName,
  temperature: config.deepseekTemperature,
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
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
  const base = config.basePrompt.trim();
  const system = state.systemPrompt.trim();
  if (base && system) return `${base}\n\n${system}`;
  return base || system;
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
  state.systemPrompt = "You are a helpful assistant.";
  state.botDisplayName = config.botDisplayName;
  state.temperature = config.deepseekTemperature;
}
