import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as relations from './relations';

export type DB = ReturnType<typeof drizzle<typeof schema & typeof relations>>;

@Injectable()
export class DrizzleService implements OnModuleDestroy {
  readonly db: DB;
  private readonly pool: Pool;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    this.pool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    this.db = drizzle(this.pool, { schema: { ...schema, ...relations }, casing: 'snake_case' });
    console.log('[DrizzleService] node-postgres pool init');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
