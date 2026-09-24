import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5';

// One Claude client for every AI feature in the API (prescription reading,
// the test finder, result explanations), so the key check, the model
// choice and the refusal handling live in one place instead of being
// copied into each service.
//
// Requests opt into server-side refusal fallbacks: if a safety classifier
// declines a request (a prescription photo can look like anything), the
// API reruns it on a fallback model inside the same call rather than
// failing the customer's upload.
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic | null;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('ANTHROPIC_API_KEY');
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  get enabled(): boolean {
    return this.client != null;
  }

  private requireClient(): Anthropic {
    if (!this.client) {
      throw new ServiceUnavailableException('AI features are not configured on this server (missing ANTHROPIC_API_KEY)');
    }
    return this.client;
  }

  // A JSON answer constrained to `schema` by structured outputs, so the
  // caller gets parseable data rather than prose it has to pick apart.
  async json<T>(opts: {
    system: string;
    content: Anthropic.Beta.BetaContentBlockParam[];
    schema: Record<string, unknown>;
    maxTokens?: number;
  }): Promise<T> {
    const message = await this.send(opts.system, opts.content, opts.maxTokens ?? 4000, {
      type: 'json_schema',
      schema: opts.schema,
    });
    const text = this.textOf(message);
    try {
      return JSON.parse(text) as T;
    } catch {
      this.logger.error(`Structured output did not parse: ${text.slice(0, 200)}`);
      throw new BadRequestException('Could not read that right now — please try again.');
    }
  }

  async text(opts: { system: string; prompt: string; maxTokens?: number }): Promise<string> {
    const message = await this.send(opts.system, [{ type: 'text', text: opts.prompt }], opts.maxTokens ?? 1500);
    return this.textOf(message).trim();
  }

  private async send(
    system: string,
    content: Anthropic.Beta.BetaContentBlockParam[],
    maxTokens: number,
    format?: Anthropic.Beta.BetaJSONOutputFormat,
  ): Promise<Anthropic.Beta.BetaMessage> {
    const client = this.requireClient();
    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await client.beta.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', ...(format ? { format } : {}) },
        system,
        messages: [{ role: 'user', content }],
      });
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) {
        throw new ServiceUnavailableException('Our assistant is busy — please try again in a minute.');
      }
      if (err instanceof Anthropic.BadRequestError) {
        this.logger.error(`Claude rejected the request: ${err.message}`);
        throw new BadRequestException('That file could not be read — try a clearer photo or a PDF.');
      }
      this.logger.error('Claude request failed', err instanceof Error ? err.stack : err);
      throw new ServiceUnavailableException('Could not reach our assistant right now — please try again.');
    }

    if (message.stop_reason === 'refusal') {
      throw new BadRequestException('Our assistant could not process this request.');
    }
    if (message.stop_reason === 'max_tokens') {
      this.logger.warn('Claude response hit max_tokens');
    }
    return message;
  }

  private textOf(message: Anthropic.Beta.BetaMessage): string {
    return message.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
  }
}
