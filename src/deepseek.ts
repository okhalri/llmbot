import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { config } from "./config";
import { getTemperature } from "./store/guildStore";
import { DeepSeekError, DeepSeekResult } from "./types";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: config.deepseekApiKey,
      baseURL: "https://api.deepseek.com/v1",
    });
  }
  return _client;
}

export async function getChatCompletion(
  messages: ChatCompletionMessageParam[],
  internal = false
): Promise<DeepSeekResult> {
  const client = getClient();
  const model = config.deepseekModel;
  const temperature = internal ? 0.7 : getTemperature();

  try {
    const response = await client.chat.completions.create({
      model,
      temperature,
      messages,
    });

    const choice = response.choices[0];
    if (!choice) throw new DeepSeekError("No choices returned from DeepSeek API");

    const msg = choice.message as OpenAI.Chat.Completions.ChatCompletionMessage & {
      reasoning_content?: string;
    };

    const thinking = model === "deepseek-reasoner"
      ? (msg.reasoning_content ?? null)
      : null;

    const reply = msg.content ?? "";
    const promptTokens = response.usage?.prompt_tokens ?? 0;
    const completionTokens = response.usage?.completion_tokens ?? 0;

    return { thinking, reply, promptTokens, completionTokens };
  } catch (err) {
    if (err instanceof DeepSeekError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new DeepSeekError(`DeepSeek API error: ${message}`);
  }
}

export async function getChatCompletionWithImages(
  messages: ChatCompletionMessageParam[],
  imageUrls: string[]
): Promise<DeepSeekResult> {
  if (imageUrls.length === 0) return getChatCompletion(messages);

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) return getChatCompletion(messages);

  const imageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] =
    imageUrls.map((url) => ({
      type: "image_url" as const,
      image_url: { url },
    }));

  const textContent =
    typeof lastUserMsg.content === "string"
      ? lastUserMsg.content
      : "";

  const enrichedMessages: ChatCompletionMessageParam[] = messages.map((m) => {
    if (m === lastUserMsg) {
      return {
        role: "user",
        content: [
          { type: "text" as const, text: textContent },
          ...imageContent,
        ],
      };
    }
    return m;
  });

  try {
    return await getChatCompletion(enrichedMessages);
  } catch {
    // Fall back to text-only if model rejects images
    console.warn("[deepseek] Image content rejected, falling back to text-only");
    return getChatCompletion(messages);
  }
}
