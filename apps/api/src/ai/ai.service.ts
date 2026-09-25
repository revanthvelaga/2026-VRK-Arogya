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
}

const PROBE_CACHE_MS = 60_000;

// One Gemini client for every AI feature in the API (prescription
// reading, the test finder, report/result explanations), so the key
// check, the model choice and the error handling live in one place
// instead of being copied into each service.
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: GoogleGenerativeAI | null;
  // Mutable: a 404 that names a replacement model updates this for
  // every request from then on, for the life of the running process.
  private currentModel = DEFAULT_MODEL;
  // The raw reason behind the last generic "could not reach" error —
  // customers only ever see the friendly message, this is for /health/ai.
  private lastFailure: { at: string; model: string; status?: number; message: string } | null = null;
  private probeCache: { at: number; result: AiProbeResult } | null = null;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('GEMINI_API_KEY');
    this.client = apiKey ? new GoogleGenerativeAI(apiKey) : null;
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
    isRetryAfterModelSwitch = false,
  ): Promise<string> {
    const client = this.requireClient();
    const model = client.getGenerativeModel({ model: this.currentModel, systemInstruction: system });

    try {
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
    } catch (err) {
      if (err instanceof GoogleGenerativeAIResponseError) {
        // A safety/recitation/language block — content genuinely refused,
        // not a transient failure worth retrying.
        throw new BadRequestException('Our assistant could not process this request.');
      }
      if (err instanceof GoogleGenerativeAIFetchError) {
        if (err.status === 429) {
          throw new ServiceUnavailableException('Our assistant is busy — please try again in a minute.');
        }
        if (err.status === 400) {
          this.logger.error(`Gemini rejected the request: ${err.message}`);
          throw new BadRequestException('That file could not be read — try a clearer photo or a PDF.');
        }
        if (err.status === 404 && !isRetryAfterModelSwitch) {
          const replacement = MODEL_SUGGESTION_RE.exec(err.message)?.[1];
          if (replacement && replacement !== this.currentModel) {
            this.logger.warn(
              `Gemini model "${this.currentModel}" is no longer available — switching to "${replacement}" and retrying.`,
            );
            this.currentModel = replacement;
            return this.send(system, blocks, maxTokens, responseSchema, true);
          }
          this.logger.error(`Gemini model "${this.currentModel}" not found and no replacement could be parsed: ${err.message}`);
        }
      }
      this.lastFailure = {
        at: new Date().toISOString(),
        model: this.currentModel,
        status: err instanceof GoogleGenerativeAIFetchError ? err.status : undefined,
        message: (err instanceof Error ? err.message : String(err)).slice(0, 400),
      };
      this.logger.error('Gemini request failed', err instanceof Error ? err.stack : err);
      throw new ServiceUnavailableException('Could not reach our assistant right now — please try again.');
    }
  }
}
