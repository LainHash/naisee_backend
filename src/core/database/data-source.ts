import { DataSource } from 'typeorm';

try {
  process.loadEnvFile('.env');
} catch {
  // Ignore when .env is absent and env vars are injected by the runtime.
}

const url =
  process.env.DbConnectionString ?? process.env.DATABASE_URL ?? '';
const useSsl =
  process.env.DB_SSL === 'true' || url.includes('sslmode=require');

/**
 * Standalone TypeORM DataSource for CLI migrations (run against compiled dist/).
 */
export default new DataSource({
  type: 'postgres',
  url,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  entities: ['dist/features/**/*.entity.js'],
  migrations: ['dist/core/database/migrations/*.js'],
});
