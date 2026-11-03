import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run Tally migrations.');
  }

  const pool = new Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
  });

  try {
    await pool.query('SELECT 1');
    const database = drizzle(pool);
    await migrate(database, {
      migrationsFolder: './drizzle-pg',
      migrationsSchema: 'tally',
      migrationsTable: '__drizzle_migrations',
    });
    console.log('Tally PostgreSQL migrations completed.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Tally PostgreSQL migration failed:', error);
  process.exitCode = 1;
});
