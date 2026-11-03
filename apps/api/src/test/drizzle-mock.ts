import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

/**
 * Like `chain`, but records every builder call, so a spec can inspect what the
 * service built: `calls.where[0][0]` is the first argument of the first
 * `.where(...)`. Render it with `renderSql`.
 */
export function recordingChain<T>(result: T, calls: Record<string, unknown[][]> = {}): any {
  const promise = Promise.resolve(result);
  const proxy: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then' || prop === 'catch' || prop === 'finally') {
          return (promise as any)[prop].bind(promise);
        }
        return (...args: unknown[]) => {
          (calls[String(prop)] ??= []).push(args);
          return proxy;
        };
      },
    },
  );
  return proxy;
}

/** Renders a Drizzle SQL fragment to its text and bound parameters. */
export function renderSql(fragment: unknown): { sql: string; params: unknown[] } {
  const { sql, params } = new PgDialect().sqlToQuery(fragment as SQL);
  return { sql, params };
}

/**
 * Minimal stand-in for a Drizzle query builder.
 *
 * Drizzle builders are thenable: every method returns the builder, and awaiting
 * it runs the query. `chain(result)` reproduces that with a Proxy — any method
 * name returns the same proxy, and awaiting it resolves to `result`. That keeps
 * the specs free of assumptions about the exact call order inside a service,
 * which is what makes them survive refactors of the query itself.
 */
export function chain<T>(result: T): any {
  const promise = Promise.resolve(result);
  const proxy: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then' || prop === 'catch' || prop === 'finally') {
          return (promise as any)[prop].bind(promise);
        }
        return () => proxy;
      },
    },
  );
  return proxy;
}

/**
 * A `DrizzleService` double. Each builder entry point is a jest mock returning
 * an empty result by default; a spec overrides one call at a time with
 * `db.select.mockReturnValueOnce(chain([row]))`.
 */
export function createDbMock() {
  const db: any = {
    select: jest.fn(() => chain([])),
    insert: jest.fn(() => chain([])),
    update: jest.fn(() => chain([])),
    delete: jest.fn(() => chain([])),
    transaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) => fn(db)),
    query: {
      users: { findFirst: jest.fn(async () => null) },
    },
  };
  return db;
}

export function createDrizzleMock(db = createDbMock()) {
  return { db, drizzle: { db } };
}
