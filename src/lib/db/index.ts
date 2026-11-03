import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

type Database = ReturnType<typeof drizzle<typeof schema>>;
type QueryLike = Record<PropertyKey, any>;

const globalForDb = globalThis as typeof globalThis & {
  __tallyPool?: Pool;
  __tallyDb?: Database;
};

function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for Tally PostgreSQL storage.');
  }
  if (!globalForDb.__tallyPool) {
    globalForDb.__tallyPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || 10),
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      allowExitOnIdle: false,
    });
    globalForDb.__tallyPool.on('error', (error) => {
      console.error('Tally PostgreSQL pool error:', error.message);
    });
  }
  return globalForDb.__tallyPool;
}

export function getDatabase(): Database {
  if (!globalForDb.__tallyDb) {
    globalForDb.__tallyDb = drizzle(getPool(), { schema });
  }
  return globalForDb.__tallyDb;
}

/**
 * Compatibility helpers for the original SQLite query style.
 * They remain asynchronous: callers must await .get(), .all(), and .run().
 */
function wrapQuery<T extends object>(query: T): any {
  if (Array.isArray(query)) return query;
  return new Proxy(query, {
    get(target, property) {
      if (property === 'then') {
        const then = Reflect.get(target, property, target);
        return typeof then === 'function' ? then.bind(target) : then;
      }
      if (property === 'get') {
        return async () => {
          const limited = typeof (target as QueryLike).limit === 'function'
            ? (target as QueryLike).limit(1)
            : target;
          const result = await limited as any;
          return Array.isArray(result) ? (result[0] ?? null) : (result?.rows?.[0] ?? result ?? null);
        };
      }
      if (property === 'all') {
        return async () => {
          const result = await target as any;
          return Array.isArray(result) ? result : (result?.rows ?? []);
        };
      }
      if (property === 'run') {
        return async () => {
          await target;
          return undefined;
        };
      }
      const value = Reflect.get(target, property, target);
      if (typeof value === 'function') {
        return (...args: unknown[]) => {
          const next = value.apply(target, args);
          return next && typeof next === 'object' ? wrapQuery(next) : next;
        };
      }
      return value;
    },
  });
}

export const db: any = new Proxy({}, {
  get(_target, property) {
    const realDb = getDatabase() as any;
    const value = Reflect.get(realDb, property, realDb);
    if (typeof value === 'function') {
      return (...args: unknown[]) => {
        const next = value.apply(realDb, args);
        return next && typeof next === 'object' ? wrapQuery(next) : next;
      };
    }
    return value;
  },
});

export { schema };
