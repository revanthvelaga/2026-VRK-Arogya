import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FinishReason, GoogleGenerativeAI, GoogleGenerativeAIFetchError, GoogleGenerativeAIResponseError } from '@google/generative-ai';
import type { Part, ResponseSchema } from '@google/generative-ai';

// Gemini's free tier (a key from aistudio.google.com/apikey, no credit
// card required) rather than a metered/billed provider — every AI
// feature in this app is a nice-to-have, not something worth asking the
// operator to add a payment method for.
const MODEL = 'gemini-2.5-flash';

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

// One Gemini client for every AI feature in the API (prescription
// reading, the test finder, report/result explanations), so the key
// check, the model choice and the error handling live in one place
// instead of being copied into each service.
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: GoogleGenerativeAI | null;

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

  async text(opts: { system: string; prompt: string; maxTokens?: number }): Promise<string> {
    const text = await this.send(opts.system, [{ type: 'text', text: opts.prompt }], opts.maxTokens ?? 1500);
    return text.trim();
  }

  private async send(system: string, blocks: AiContentBlock[], maxTokens: number, responseSchema?: ResponseSchema): Promise<string> {
    const client = this.requireClient();
    const model = client.getGenerativeModel({ model: MODEL, systemInstruction: system });

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
      }
      this.logger.error('Gemini request failed', err instanceof Error ? err.stack : err);
      throw new ServiceUnavailableException('Could not reach our assistant right now — please try again.');
    }
  }
}
