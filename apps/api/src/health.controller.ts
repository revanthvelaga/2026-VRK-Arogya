import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// Every other controller is mounted under a prefix, so `/` used to 404 even
// on a perfectly healthy API — which reads as "the server is down" when you
// check it in a browser. Root and /health both answer here instead.
@Controller()
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

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
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
