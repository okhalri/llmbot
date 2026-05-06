import * as fs from "fs";
import * as path from "path";

const PROMPTS_PATH = path.resolve(process.cwd(), "data", "prompts.json");

const prompts = new Map<string, string>();

export function loadPrompts(): void {
  if (!fs.existsSync(PROMPTS_PATH)) return;
  try {
    const raw = fs.readFileSync(PROMPTS_PATH, "utf-8");
    const data: Record<string, string> = JSON.parse(raw);
    for (const [name, content] of Object.entries(data)) {
      prompts.set(name, content);
    }
    console.log(`[promptStore] Loaded ${prompts.size} stored prompt(s)`);
  } catch (err) {
    console.error("[promptStore] Failed to load prompts:", err);
  }
}

function save(): void {
  try {
    fs.mkdirSync(path.dirname(PROMPTS_PATH), { recursive: true });
    const data: Record<string, string> = {};
    for (const [name, content] of prompts.entries()) {
      data[name] = content;
    }
    fs.writeFileSync(PROMPTS_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("[promptStore] Failed to save prompts:", err);
  }
}

export function getPrompt(name: string): string | undefined {
  return prompts.get(name);
}

export function setPrompt(name: string, content: string): void {
  prompts.set(name, content);
  save();
}

export function deletePrompt(name: string): boolean {
  const existed = prompts.delete(name);
  if (existed) save();
  return existed;
}

export function listPrompts(): Array<{ name: string; content: string }> {
  return [...prompts.entries()].map(([name, content]) => ({ name, content }));
}

export function hasPrompt(name: string): boolean {
  return prompts.has(name);
}
