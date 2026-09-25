import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FinishReason, GoogleGenerativeAI, GoogleGenerativeAIFetchError, GoogleGenerativeAIResponseError } from '@google/generative-ai';
import type { Part, ResponseSchema } from '@google/generative-ai';
import { BackupProvider, buildBackupProviders } from './backup-providers';

// Gemini's free tier (a key from aistudio.google.com/apikey, no credit
// card required) rather than a metered/billed provider — every AI
// feature in this app is a nice-to-have, not something worth asking the
// operator to add a payment method for.
//
// Google periodically retires a model out from under existing code —
// gemini-2.5-flash stopped working for new API keys mid-project — and
// each time, its 404 response names the replacement right in the error
// text ('...use models/gemini-3.8-flash...'). AiService below reads
// that name out of the error and switches to it on the fly, so a future
// retirement heals itself on the very next request instead of needing
// another deploy. This is only the starting point.
const DEFAULT_MODEL = 'gemini-3.8-flash';

// Matches the replacement Google's own 404 message names, e.g.
// "Please update your code to use models/gemini-3.8-flash for...".
const MODEL_SUGGESTION_RE = /use models\/([a-z0-9._-]+)/i;

// Provider-neutral content blocks — text plus inline binary (an image or
// a PDF, both sent the same way to Gemini) — so callers never import
// anything provider-specific.
export type AiContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; mimeType: string; data: string }
  | { type: 'document'; mimeType: string; data: string };

function toParts(blocks: AiContentBlock[]): Part[] {
  return blocks.map((b) => (b.type === 'text' ? { text: b.text } : { inlineData: { mimeType: b.mimeType, data: b.data } }));
}

// Gemini's schema dialect is close to JSON Schema but stricter: it
// rejects unknown keys like `additionalProperties`, and a string enum
// needs an explicit `format: 'enum'` alongside `enum: [...]` — neither
// of which the schemas written against the old Anthropic client (plain
// JSON Schema) bother with. Translating here means every call site keeps
// writing ordinary JSON Schema.
function sanitizeSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizeSchema);
  if (!node || typeof node !== 'object') return node;
  const { additionalProperties: _drop, ...rest } = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    out[key] = sanitizeSchema(value);
  }
  if (out.type === 'string' && Array.isArray(out.enum) && out.format === undefined) {
    out.format = 'enum';
  }
  return out;
}

export interface AiProbeResult {
  configured: boolean;
  model: string;
  ok: boolean;
  answeredBy: string | null;
  checkedAt: string;
  lastFailure: { at: string; model: string; status?: number; message: string } | null;
  fallbacks: string[];
  backups: Array<{ provider: string; configured: boolean; models: string[] }>;
}

const PROBE_CACHE_MS = 60_000;
const FALLBACK_CACHE_MS = 60 * 60_000;
const MAX_FALLBACKS = 3;

// Backups get the schema in the prompt instead of a native schema
// parameter (support for that varies across providers), then this pulls
// the JSON back out of whatever they wrap it in.
function extractJson(text: string, required: string[]): string {
  const cleaned = text.replace(/```(?:json)?/gi, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in response');
  const json = cleaned.slice(start, end + 1);
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const missing = required.filter((key) => !(key in parsed));
  if (missing.length) throw new Error(`JSON missing ${missing.join(', ')}`);
  return json;
}

// One entry point for every AI feature in the API (prescription reading,
// the test finder, report/result explanations). Gemini first — free, and
// the only one here that reads images — then free text-only backups
// (OpenRouter's DeepSeek/Llama/Qwen, Groq), then Perplexity if a paid
// key was added. Each backup is on only if its key is set.
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: GoogleGenerativeAI | null;
  private readonly apiKey: string | undefined;
  private readonly backups: BackupProvider[];
  private fallbackCache: { at: number; models: string[] } | null = null;
  // Gemini models the list advertises but that 404 for this key (e.g.
  // retired "for new users") — skipped as fallbacks from then on.
  private readonly deadModels = new Set<string>();
  // Mutable: a 404 that names a replacement model updates this for
  // every request from then on, for the life of the running process.
  private currentModel = DEFAULT_MODEL;
  private lastAnsweredBy: string | null = null;
  // The raw reason behind the last generic "could not reach" error —
  // customers only ever see the friendly message, this is for /health/ai.
  private lastFailure: { at: string; model: string; status?: number; message: string } | null = null;
  private probeCache: { at: number; result: AiProbeResult } | null = null;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('GEMINI_API_KEY');
    this.client = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
    this.backups = buildBackupProviders((key) => config.get<string>(key));
    if (!this.enabled) {
      this.logger.warn('No AI provider key set (GEMINI_API_KEY etc.) — AI features will fail until configured.');
    }
  }

  get enabled(): boolean {
    return this.client != null || this.backups.some((b) => b.configured);
  }

  private requireClient(): GoogleGenerativeAI {
    if (!this.client) {
      throw new ServiceUnavailableException('AI features are not configured on this server (missing GEMINI_API_KEY)');
    }
    return this.client;
  }

  // A JSON answer constrained to `schema`, so the caller gets parseable
  // data rather than prose it has to pick apart.
  async json<T>(opts: {
    system: string;
    content: AiContentBlock[];
    schema: Record<string, unknown>;
    maxTokens?: number;
  }): Promise<T> {
    const text = await this.send(opts.system, opts.content, opts.maxTokens ?? 4000, opts.schema);
    try {
      return JSON.parse(text) as T;
    } catch {
      this.logger.error(`Structured output did not parse: ${text.slice(0, 200)}`);
      throw new BadRequestException('Could not read that right now — please try again.');
    }
  }

  // A one-word round trip, cached for a minute so the public /health/ai
  // endpoint can't be used to burn through the free quota.
  async probe(): Promise<AiProbeResult> {
    if (this.probeCache && Date.now() - this.probeCache.at < PROBE_CACHE_MS) {
      return this.probeCache.result;
    }
    let ok = false;
    if (this.enabled) {
      try {
        await this.text({ system: 'Reply with the single word OK.', prompt: 'ping', maxTokens: 10 });
        ok = true;
      } catch {
        ok = false;
      }
    }
    const result: AiProbeResult = {
      configured: this.client != null,
      model: this.currentModel,
      ok,
      answeredBy: ok ? this.lastAnsweredBy : null,
      checkedAt: new Date().toISOString(),
      lastFailure: this.lastFailure,
      fallbacks: this.client ? await this.fallbackModels() : [],
      backups: await Promise.all(
        this.backups.map(async (b) => ({ provider: b.name, configured: b.configured, models: await b.models() })),
      ),
    };
    this.probeCache = { at: Date.now(), result };
    return result;
  }

  async text(opts: { system: string; prompt: string; maxTokens?: number }): Promise<string> {
    const text = await this.send(opts.system, [{ type: 'text', text: opts.prompt }], opts.maxTokens ?? 1500);
    return text.trim();
  }

  private async send(
    system: string,
    blocks: AiContentBlock[],
    maxTokens: number,
    schema?: Record<string, unknown>,
  ): Promise<string> {
    if (!this.enabled) this.requireClient();
    let lastErr: unknown = null;

    if (this.client) {
      try {
        return await this.sendGemini(system, blocks, maxTokens, schema);
      } catch (err) {
        // A safety refusal isn't something to route around elsewhere.
        if (err instanceof GoogleGenerativeAIResponseError) throw this.toHttpError(err);
        lastErr = err;
      }
    }

    // Backups are text-only — a prescription photo/PDF stays with Gemini.
    if (blocks.every((b) => b.type === 'text')) {
      const userText = blocks.map((b) => (b.type === 'text' ? b.text : '')).join('\n\n');
      const prompt = schema
        ? `${userText}\n\nRespond with ONLY a JSON object — no prose, no code fences — matching this JSON Schema:\n${JSON.stringify(schema)}`
        : userText;
      const required = Array.isArray(schema?.required) ? (schema.required as string[]) : [];
      for (const provider of this.backups) {
        for (const model of await provider.models()) {
          try {
            const text = await provider.chat(model, system, prompt, maxTokens);
            const answer = schema ? extractJson(text, required) : text;
            this.lastAnsweredBy = `${provider.name}:${model}`;
            this.logger.warn(`Gemini unavailable — answered by ${provider.name} "${model}".`);
            return answer;
          } catch (err) {
            lastErr = err;
            this.logger.warn(`Backup ${provider.name} "${model}" failed: ${err instanceof Error ? err.message : err}`);
          }
        }
      }
    }

    throw this.toHttpError(lastErr);
  }

  // Gemini with its own recovery: heal a retired model (404 naming the
  // replacement), give a momentary overload one retry, then try other
  // Gemini Flash models this key can call. Throws the raw last error.
  private async sendGemini(
    system: string,
    blocks: AiContentBlock[],
    maxTokens: number,
    schema?: Record<string, unknown>,
  ): Promise<string> {
    const responseSchema = schema ? (sanitizeSchema(schema) as ResponseSchema) : undefined;
    const call = async (model: string) => {
      const text = await this.callModel(model, system, blocks, maxTokens, responseSchema);
      this.lastAnsweredBy = `gemini:${model}`;
      return text;
    };
    let lastErr: unknown;

    let retriedOverload = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await call(this.currentModel);
      } catch (err) {
        lastErr = err;
        if (!(err instanceof GoogleGenerativeAIFetchError)) break;
        if (err.status === 404) {
          const replacement = MODEL_SUGGESTION_RE.exec(err.message)?.[1];
          if (!replacement || replacement === this.currentModel) break;
          this.logger.warn(`Gemini model "${this.currentModel}" is no longer available — switching to "${replacement}".`);
          this.currentModel = replacement;
          continue;
        }
        if (err.status === 503 && !retriedOverload) {
          retriedOverload = true;
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        break;
      }
    }

    if (isBusy(lastErr)) {
      for (const alt of await this.fallbackModels()) {
        try {
          const text = await call(alt);
          this.logger.warn(`"${this.currentModel}" was busy — answered by Gemini fallback "${alt}".`);
          return text;
        } catch (err) {
          lastErr = err;
          if (err instanceof GoogleGenerativeAIFetchError && err.status === 404) {
            this.deadModels.add(alt);
            continue;
          }
          if (!isBusy(err)) break;
        }
      }
    }
    throw lastErr;
  }

  private async callModel(
    modelName: string,
    system: string,
    blocks: AiContentBlock[],
    maxTokens: number,
    responseSchema?: ResponseSchema,
  ): Promise<string> {
    const model = this.requireClient().getGenerativeModel({ model: modelName, systemInstruction: system });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: toParts(blocks) }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        ...(responseSchema ? { responseMimeType: 'application/json', responseSchema } : {}),
      },
    });
    const text = result.response.text();
    if (result.response.candidates?.[0]?.finishReason === FinishReason.MAX_TOKENS) {
      this.logger.warn('Gemini response hit max output tokens');
    }
    return text;
  }

  // Flash models this key can call, straight from Google's model list —
  // so fallbacks are never guessed names that may not exist. Cached an
  // hour; an empty list just means no fallback, never a crash.
  private async fallbackModels(): Promise<string[]> {
    if (!this.fallbackCache || Date.now() - this.fallbackCache.at > FALLBACK_CACHE_MS) {
      let models: string[] = [];
      try {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
          headers: { 'x-goog-api-key': this.apiKey ?? '' },
        });
        if (res.ok) {
          const body = (await res.json()) as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> };
          models = (body.models ?? [])
            .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
            .map((m) => m.name.replace(/^models\//, ''))
            .filter((name) => /flash/i.test(name) && !/image|tts|audio|live|embed|thinking/i.test(name))
            // Stable models before preview/experimental ones.
            .sort((a, b) => Number(/preview|exp/i.test(a)) - Number(/preview|exp/i.test(b)));
        } else {
          this.logger.warn(`Could not list Gemini models (${res.status})`);
        }
      } catch (err) {
        this.logger.warn(`Could not list Gemini models: ${err instanceof Error ? err.message : err}`);
      }
      this.fallbackCache = { at: Date.now(), models };
    }
    return this.fallbackCache.models
      .filter((name) => name !== this.currentModel && !this.deadModels.has(name))
      .slice(0, MAX_FALLBACKS);
  }

  private toHttpError(err: unknown): Error {
    if (err instanceof GoogleGenerativeAIResponseError) {
      // A safety/recitation/language block — content genuinely refused.
      return new BadRequestException('Our assistant could not process this request.');
    }
    this.lastFailure = {
      at: new Date().toISOString(),
      model: this.currentModel,
      status: (err as { status?: number } | null)?.status,
      message: (err instanceof Error ? err.message : String(err)).slice(0, 400),
    };
    if (err instanceof GoogleGenerativeAIFetchError && err.status === 400) {
      this.logger.error(`Gemini rejected the request: ${err.message}`);
      return new BadRequestException('That file could not be read — try a clearer photo or a PDF.');
    }
    this.logger.error('AI request failed on every provider', err instanceof Error ? err.stack : err);
    if (isBusy(err)) {
      return new ServiceUnavailableException('Our assistant is busy right now — please try again in a minute.');
    }
    return new ServiceUnavailableException('Could not reach our assistant right now — please try again.');
  }
}

function isBusy(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  return status === 503 || status === 429;
}
