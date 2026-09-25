import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FinishReason, GoogleGenerativeAI, GoogleGenerativeAIFetchError, GoogleGenerativeAIResponseError } from '@google/generative-ai';
import type { Part, ResponseSchema } from '@google/generative-ai';

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
  checkedAt: string;
  lastFailure: { at: string; model: string; status?: number; message: string } | null;
  fallbacks: string[];
}

const PROBE_CACHE_MS = 60_000;
const FALLBACK_CACHE_MS = 60 * 60_000;
const MAX_FALLBACKS = 3;

// One Gemini client for every AI feature in the API (prescription
// reading, the test finder, report/result explanations), so the key
// check, the model choice and the error handling live in one place
// instead of being copied into each service.
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: GoogleGenerativeAI | null;
  private readonly apiKey: string | undefined;
  private fallbackCache: { at: number; models: string[] } | null = null;
  // Mutable: a 404 that names a replacement model updates this for
  // every request from then on, for the life of the running process.
  private currentModel = DEFAULT_MODEL;
  // The raw reason behind the last generic "could not reach" error —
  // customers only ever see the friendly message, this is for /health/ai.
  private lastFailure: { at: string; model: string; status?: number; message: string } | null = null;
  private probeCache: { at: number; result: AiProbeResult } | null = null;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('GEMINI_API_KEY');
    this.client = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
    if (!this.client) {
      this.logger.warn('GEMINI_API_KEY not set — AI features will fail until configured.');
    }
  }

  get enabled(): boolean {
    return this.client != null;
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
    const text = await this.send(opts.system, opts.content, opts.maxTokens ?? 4000, sanitizeSchema(opts.schema) as ResponseSchema);
    try {
      return JSON.parse(text) as T;
    } catch {
      this.logger.error(`Structured output did not parse: ${text.slice(0, 200)}`);
      throw new BadRequestException('Could not read that right now — please try again.');
    }
  }

  // A one-word round trip to Gemini, cached for a minute so the public
  // /health/ai endpoint can't be used to burn through the free quota.
  async probe(): Promise<AiProbeResult> {
    if (this.probeCache && Date.now() - this.probeCache.at < PROBE_CACHE_MS) {
      return this.probeCache.result;
    }
    let ok = false;
    if (this.client) {
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
      checkedAt: new Date().toISOString(),
      lastFailure: this.lastFailure,
      fallbacks: this.client ? await this.fallbackModels() : [],
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
    responseSchema?: ResponseSchema,
  ): Promise<string> {
    this.requireClient();
    const call = (model: string) => this.callModel(model, system, blocks, maxTokens, responseSchema);
    let lastErr: unknown;

    // 1. The current model — healing a retirement (404 naming the
    //    replacement) and giving a momentary overload (503) one retry.
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

    // 2. Still busy / out of free quota on that model — free-tier limits
    //    are per model, so another available Flash model usually answers.
    if (isBusy(lastErr)) {
      for (const alt of await this.fallbackModels()) {
        try {
          const text = await call(alt);
          this.logger.warn(`"${this.currentModel}" was busy — answered by fallback "${alt}".`);
          return text;
        } catch (err) {
          lastErr = err;
          const skippable = isBusy(err) || (err instanceof GoogleGenerativeAIFetchError && err.status === 404);
          if (!skippable) break;
        }
      }
    }

    throw this.toHttpError(lastErr);
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
    return this.fallbackCache.models.filter((name) => name !== this.currentModel).slice(0, MAX_FALLBACKS);
  }

  private toHttpError(err: unknown): Error {
    if (err instanceof GoogleGenerativeAIResponseError) {
      // A safety/recitation/language block — content genuinely refused.
      return new BadRequestException('Our assistant could not process this request.');
    }
    this.lastFailure = {
      at: new Date().toISOString(),
      model: this.currentModel,
      status: err instanceof GoogleGenerativeAIFetchError ? err.status : undefined,
      message: (err instanceof Error ? err.message : String(err)).slice(0, 400),
    };
    if (err instanceof GoogleGenerativeAIFetchError && err.status === 400) {
      this.logger.error(`Gemini rejected the request: ${err.message}`);
      return new BadRequestException('That file could not be read — try a clearer photo or a PDF.');
    }
    this.logger.error('Gemini request failed', err instanceof Error ? err.stack : err);
    if (isBusy(err)) {
      return new ServiceUnavailableException('Our assistant is busy right now — please try again in a minute.');
    }
    return new ServiceUnavailableException('Could not reach our assistant right now — please try again.');
  }
}

function isBusy(err: unknown): boolean {
  return err instanceof GoogleGenerativeAIFetchError && (err.status === 503 || err.status === 429);
}
