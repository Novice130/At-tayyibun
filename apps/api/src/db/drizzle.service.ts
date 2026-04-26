import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from './schema';
import * as relations from './relations';

neonConfig.webSocketConstructor = ws;
neonConfig.pipelineConnect = false;
neonConfig.fetchTimeout = 30000;
neonConfig.maxMessageSize = 1024 * 1024 * 10;

export type DB = ReturnType<typeof drizzle<typeof schema & typeof relations>>;

@Injectable()
export class DrizzleService implements OnModuleDestroy {
  readonly db: DB;
  private readonly pool: Pool;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    this.pool = new Pool({ connectionString: url, idleTimeout: 30000, max: 20 });
    this.db = drizzle(this.pool, { schema: { ...schema, ...relations }, casing: 'snake_case' });
    console.log('[DrizzleService] Neon pool init. ws available:', typeof ws !== 'undefined');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
