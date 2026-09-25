import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AiService } from './ai/ai.service';

// Every other controller is mounted under a prefix, so `/` used to 404 even
// on a perfectly healthy API — which reads as "the server is down" when you
// check it in a browser. Root and /health both answer here instead.
@Controller()
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ai: AiService,
  ) {}

  @Get()
  root() {
    return this.health();
  }

  @Get('health')
  async health() {
    let database = 'down';
    try {
      await this.dataSource.query('SELECT 1');
      database = 'up';
    } catch {
      database = 'down';
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      service: 'arogya-api',
      database,
      // Render sets this on every deploy — shows at a glance whether the
      // latest push is actually the one running.
      commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? null,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  // Is Gemini actually answering, and if not, Google's own reason — so a
  // "could not reach our assistant" can be diagnosed without digging
  // through server logs. Probe is cached for a minute inside AiService.
  @Get('health/ai')
  aiHealth() {
    return this.ai.probe();
  }
}
