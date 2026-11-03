import { Pool } from 'pg';

const REQUIRED_TABLES = [
  'users',
  'health_profiles',
  'nutrient_targets',
  'foods',
  'food_tags',
  'foods_food_tags',
  'food_servings',
  'diary_entries',
  'food_entries',
  'exercises',
  'measurements',
  'meals',
  'meal_items',
  'meals_food_tags',
  'journal_entries',
] as const;

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for Nutrients PostgreSQL storage.');
  }

  const pool = new Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
  });

  try {
    await pool.query('SELECT 1');

    const tableResult = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'tally'
         AND table_type = 'BASE TABLE'
         AND table_name = ANY($1::text[])`,
      [REQUIRED_TABLES],
    );

    const existingTables = new Set(tableResult.rows.map((row) => row.table_name));
    const missingTables = REQUIRED_TABLES.filter((name) => !existingTables.has(name));

    if (missingTables.length > 0) {
      throw new Error(
        `Nutrients database schema is incomplete (the internal PostgreSQL schema is named tally). Missing tables: ${missingTables.join(', ')}. ` +
        'Run the versioned database migration before starting the web server.',
      );
    }

    const accessResult = await pool.query<{ has_access: boolean }>(
      `SELECT bool_and(
         has_table_privilege(current_user, format('%I.%I', 'tally', table_name), 'SELECT')
         AND has_table_privilege(current_user, format('%I.%I', 'tally', table_name), 'INSERT')
         AND has_table_privilege(current_user, format('%I.%I', 'tally', table_name), 'UPDATE')
         AND has_table_privilege(current_user, format('%I.%I', 'tally', table_name), 'DELETE')
       ) AS has_access
       FROM information_schema.tables
       WHERE table_schema = 'tally'
         AND table_type = 'BASE TABLE'
         AND table_name = ANY($1::text[])`,
      [REQUIRED_TABLES],
    );

    if (!accessResult.rows[0]?.has_access) {
      throw new Error(
        'The DATABASE_URL role must have SELECT, INSERT, UPDATE, and DELETE access to all application tables.',
      );
    }

    const identity = await pool.query<{ database: string; role: string }>(
      'SELECT current_database() AS database, current_user AS role',
    );
    console.log(
      `Nutrients PostgreSQL schema verified: ${REQUIRED_TABLES.length} tables in ${identity.rows[0].database} ` +
      `using role ${identity.rows[0].role}.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Nutrients PostgreSQL schema verification failed:', error);
  process.exitCode = 1;
});
