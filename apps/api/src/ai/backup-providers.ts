import { Logger } from '@nestjs/common';

// Free (or optional) text-only providers that step in when Gemini can't
// answer. All three speak the same OpenAI-style chat API, so one small
// client covers them; each only switches on if its key is set. Model
// lists come live from each provider where possible, so a model being
// renamed or dropped from a free tier is picked up without a deploy.

export class BackupProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string | undefined;
  // Given the provider's /models list (null when it has none to fetch),
  // the models to try, best first.
  choose: (models: Array<{ id: string; pricing?: { prompt?: string; completion?: string } }> | null) => string[];
  hasModelList: boolean;
}

const MODEL_LIST_CACHE_MS = 60 * 60_000;
const REQUEST_TIMEOUT_MS = 45_000;

export class BackupProvider {
  private readonly logger = new Logger(BackupProvider.name);
  private cache: { at: number; models: string[] } | null = null;

  constructor(private readonly cfg: ProviderConfig) {}

  get name(): string {
    return this.cfg.name;
  }

  get configured(): boolean {
    return Boolean(this.cfg.apiKey);
  }

  async models(): Promise<string[]> {
    if (!this.configured) return [];
    if (this.cache && Date.now() - this.cache.at < MODEL_LIST_CACHE_MS) return this.cache.models;
    let listed: Array<{ id: string }> | null = null;
    if (this.cfg.hasModelList) {
      try {
        const res = await fetch(`${this.cfg.baseUrl}/models`, {
          headers: { Authorization: `Bearer ${this.cfg.apiKey}` },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        listed = ((await res.json()) as { data?: Array<{ id: string }> }).data ?? [];
      } catch (err) {
        this.logger.warn(`Could not list ${this.cfg.name} models: ${err instanceof Error ? err.message : err}`);
        return this.cache?.models ?? [];
      }
    }
    const models = this.cfg.choose(listed);
    this.cache = { at: Date.now(), models };
    return models;
  }

  async chat(model: string, system: string, prompt: string, maxTokens: number): Promise<string> {
    const res = await fetch(`${this.cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      throw new BackupProviderError(`${this.cfg.name}/${model}: HTTP ${res.status} ${detail}`, res.status);
    }
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new BackupProviderError(`${this.cfg.name}/${model}: empty response`);
    }
    // Reasoning models (DeepSeek R1 and friends) can prepend their
    // working inside <think> tags — never something to show a customer.
    return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  }
}

const NOT_CHAT = /whisper|tts|guard|embed|vision|audio|image|playai|moderation/i;

export function buildBackupProviders(env: (key: string) => string | undefined): BackupProvider[] {
  return [
    // OpenRouter's ":free" models — DeepSeek, Llama, Qwen and others,
    // no card needed. DeepSeek first, then whatever else is free today.
    new BackupProvider({
      name: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: env('OPENROUTER_API_KEY'),
      hasModelList: true,
      choose: (models) =>
        (models ?? [])
          .filter((m) => m.id.endsWith(':free') && !NOT_CHAT.test(m.id))
          .map((m) => m.id)
          .sort((a, b) => Number(!/deepseek/i.test(a)) - Number(!/deepseek/i.test(b)))
          .slice(0, 3),
    }),
    // Groq — free tier, no card, very fast open models.
    new BackupProvider({
      name: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: env('GROQ_API_KEY'),
      hasModelList: true,
      choose: (models) =>
        (models ?? [])
          .map((m) => m.id)
          .filter((id) => !NOT_CHAT.test(id))
          // Bigger general models first — better at following the JSON format.
          .sort((a, b) => Number(!/70b|120b|versatile/i.test(a)) - Number(!/70b|120b|versatile/i.test(b)))
          .slice(0, 2),
    }),
    // Perplexity — paid (needs API credits), so only used if a key is
    // deliberately added. Last in line for that reason.
    new BackupProvider({
      name: 'perplexity',
      baseUrl: 'https://api.perplexity.ai',
      apiKey: env('PERPLEXITY_API_KEY'),
      hasModelList: false,
      choose: () => ['sonar'],
    }),
  ];
}
