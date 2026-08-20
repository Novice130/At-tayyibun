import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as relations from './relations';

export type DB = ReturnType<typeof drizzle<typeof schema & typeof relations>>;

@Injectable()
export class DrizzleService implements OnModuleDestroy {
  private readonly logger = new Logger(DrizzleService.name);
  readonly db: DB;
  private readonly pool: Pool;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    this.pool = new Pool({
      connectionString: url,
      // Neon serves standard CA-signed certs; verify them. Never disable
      // verification — it defeats the purpose of TLS.
      ssl: { rejectUnauthorized: true },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    this.db = drizzle(this.pool, { schema: { ...schema, ...relations }, casing: 'snake_case' });
    this.logger.log('node-postgres pool init');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
