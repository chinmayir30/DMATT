import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';
const { Pool, Client } = pg;

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

const databaseName = process.env.DB_NAME || 'dmat_dev';

const MIGRATIONS_SOURCES = [
  {
    name: 'Core/Phase 1-3 Migrations',
    dir: path.join(rootDir, 'database', 'migrations'),
    files: [
      '001_create_core_tables.sql',
      '002_extend_landing_pages.sql',
      '003_refine_leads.sql'
    ]
  },
  {
    name: 'Enhancements/Phase 4 Migrations',
    dir: path.join(__dirname, 'migrations'),
    files: [
      '001_create_google_credentials_table.sql',
      '002_create_seo_tables.sql',
      '003_create_analytics_tables.sql',
      '004_create_linkedin_tables.sql',
      '005_create_social_tables.sql',
      '006_create_whatsapp_messages_table.sql',
      '007_add_whatsapp_from_number_column.sql',
      '008_create_scheduled_posts_table.sql',
      '009_create_social_accounts_table.sql',
      '010_add_social_post_metrics.sql'
    ]
  }
];

async function createDatabaseIfNotExists() {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = '${databaseName}'`);
    if (res.rowCount === 0) {
      console.log(`Database '${databaseName}' does not exist. Creating...`);
      await client.query(`CREATE DATABASE ${databaseName}`);
      console.log(`Database '${databaseName}' created successfully.`);
    } else {
      console.log(`Database '${databaseName}' already exists.`);
    }
  } catch (err) {
    console.error('Error ensuring database exists:', err);
    throw err;
  } finally {
    await client.end();
  }
}

async function runMigrations() {
  const pool = new Pool({
    ...dbConfig,
    database: databaseName
  });

  try {
    console.log(`Connecting to database '${databaseName}' on port ${dbConfig.port}...`);
    await pool.query('SELECT NOW()'); // test Connection
    console.log('Connected successfully. Starting migrations...');

    for (const source of MIGRATIONS_SOURCES) {
      console.log(`\n=== Running ${source.name} ===`);
      for (const fileName of source.files) {
        const filePath = path.join(source.dir, fileName);
        if (!fs.existsSync(filePath)) {
          console.warn(`[WARN] Migration file not found: ${filePath}. Skipping...`);
          continue;
        }

        const sql = fs.readFileSync(filePath, 'utf-8');
        console.log(`Applying: ${fileName}`);
        try {
          await pool.query(sql);
          console.log(`✓ successfully applied ${fileName}`);
        } catch (e) {
          console.error(`✗ Error applying ${fileName}:`, e.message);
          // depending on requirements, we might want to stop on first error
          console.log('Skipping to next due to error (might already exist)...');
        }
      }
    }
    console.log('\nAll attempted migrations finished.');
  } catch (err) {
    console.error('Migration connection error:', err);
  } finally {
    await pool.end();
  }
}

async function main() {
  try {
    await createDatabaseIfNotExists();
    await runMigrations();
  } catch (err) {
    console.error('Script failed:', err.message);
    process.exit(1);
  }
}

main();
