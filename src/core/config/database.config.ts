import { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

export interface DatabaseEnvConfig {
  url: string;
  synchronize: boolean;
  logging: boolean;
  ssl: boolean | { rejectUnauthorized: boolean };
  manualInitialization: boolean;
}

/**
 * Resolves TypeORM PostgreSQL settings from environment variables.
 */
export function resolveDatabaseConfig(
  configService: ConfigService,
): DatabaseEnvConfig {
  const url =
    configService.get<string>('DbConnectionString') ??
    configService.get<string>('DATABASE_URL') ??
    '';

  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const isProd = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  const synchronizeRaw = configService.get<string>('DB_SYNCHRONIZE');
  const synchronize =
    synchronizeRaw !== undefined ? synchronizeRaw === 'true' : !isProd;

  const logging = configService.get<string>('DB_LOGGING', 'false') === 'true';

  const useSsl =
    configService.get<string>('DB_SSL') === 'true' ||
    url.includes('sslmode=require');

  const autoInitInTest =
    configService.get<string>('DB_AUTO_INIT', 'false') === 'true';

  return {
    url,
    synchronize,
    logging,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    manualInitialization: (isTest && !autoInitInTest) || !url,
  };
}

/**
 * Builds NestJS TypeORM module options for PostgreSQL Code-First setup.
 */
export function createTypeOrmOptions(
  configService: ConfigService,
): TypeOrmModuleOptions {
  const db = resolveDatabaseConfig(configService);

  return {
    type: 'postgres',
    url: db.url || undefined,
    ssl: db.ssl,
    autoLoadEntities: true,
    synchronize: db.synchronize,
    logging: db.logging,
    manualInitialization: db.manualInitialization,
  };
}

