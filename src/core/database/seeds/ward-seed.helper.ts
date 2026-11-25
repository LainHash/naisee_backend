import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EntityManager } from 'typeorm';
import { User } from '../../../features/auth/entities/user.entity.js';
import { Issue } from '../../../features/issues/entities/issue.entity.js';
import { Ward } from '../../../features/master-data/entities/ward.entity.js';
import {
  FALLBACK_TRAN_BIEN_WARD,
  parseWardsFromGeoJson,
  type ParsedWardSeed,
} from '../../../features/master-data/ward-geojson.utils.js';

export const DEFAULT_WARDS_GEOJSON_PATH = resolve(
  import.meta.dirname,
  'data/dong-nai-wards.geojson',
);

const SRC_FALLBACK_GEOJSON_PATH = resolve(
  process.cwd(),
  'src/core/database/seeds/data/dong-nai-wards.geojson',
);

function resolveGeoJsonPath(explicitPath?: string): string | null {
  if (explicitPath) {
    const resolved = resolve(explicitPath);
    return existsSync(resolved) ? resolved : null;
  }
  if (existsSync(DEFAULT_WARDS_GEOJSON_PATH)) {
    return DEFAULT_WARDS_GEOJSON_PATH;
  }
  if (existsSync(SRC_FALLBACK_GEOJSON_PATH)) {
    return SRC_FALLBACK_GEOJSON_PATH;
  }
  return null;
}

export interface WardImportResult {
  source: 'geojson' | 'fallback';
  filePath: string | null;
  imported: number;
  activeWards: number;
  backfilledUsers: number;
  backfilledIssues: number;
}

/**
 * Reads ward definitions from GeoJSON if available, or returns the baseline fallback ward.
 */
export function loadWardSeeds(options: {
  filePath?: string;
  activateCommunes?: boolean;
}): {
  source: 'geojson' | 'fallback';
  filePath: string | null;
  records: ParsedWardSeed[];
} {
  const targetPath = resolveGeoJsonPath(options.filePath);

  if (!targetPath) {
    return {
      source: 'fallback',
      filePath: null,
      records: [FALLBACK_TRAN_BIEN_WARD],
    };
  }

  const rawText = readFileSync(targetPath, 'utf8');
  const parsedJson: unknown = JSON.parse(rawText);
  const records = parseWardsFromGeoJson(parsedJson, {
    activateCommunes: options.activateCommunes,
  });

  if (records.length === 0) {
    throw new Error(
      `File GeoJSON ${targetPath} không chứa feature Polygon/MultiPolygon hợp lệ nào.`,
    );
  }

  return {
    source: 'geojson',
    filePath: targetPath,
    records,
  };
}

/**
 * Idempotently upserts wards by code and backfills missing wardId references on users/issues.
 */
export async function upsertWardsAndBackfill(
  manager: EntityManager,
  options: { filePath?: string; activateCommunes?: boolean } = {},
): Promise<WardImportResult> {
  const wardRepo = manager.getRepository(Ward);
  const loaded = loadWardSeeds(options);

  // Ensure baseline Ward exists even if a custom GeoJSON omits or renames it differently.
  const hasTranBien = loaded.records.some(
    (item) => item.name.toLowerCase() === FALLBACK_TRAN_BIEN_WARD.name.toLowerCase(),
  );
  const recordsToUpsert = hasTranBien
    ? loaded.records
    : [FALLBACK_TRAN_BIEN_WARD, ...loaded.records];

  for (const spec of recordsToUpsert) {
    const existing =
      (await wardRepo.findOne({ where: { code: spec.code } })) ??
      (await wardRepo.findOne({ where: { name: spec.name } }));

    if (existing) {
      existing.code = spec.code;
      existing.name = spec.name;
      existing.unitType = spec.unitType;
      existing.provinceName = spec.provinceName;
      existing.centerLat = spec.centerLat;
      existing.centerLng = spec.centerLng;
      existing.defaultZoom = spec.defaultZoom;
      existing.minLat = spec.minLat;
      existing.maxLat = spec.maxLat;
      existing.minLng = spec.minLng;
      existing.maxLng = spec.maxLng;
      existing.boundaryGeoJson = spec.boundaryGeoJson;
      existing.isActive = spec.isActive;
      await wardRepo.save(existing);
    } else {
      await wardRepo.save(wardRepo.create(spec));
    }
  }

  const allWards = await wardRepo.find();
  const wardIdByName = new Map(
    allWards.map((w) => [w.name.trim().toLowerCase(), w.id]),
  );

  const userRepo = manager.getRepository(User);
  const usersWithoutWardId = await userRepo
    .createQueryBuilder('u')
    .where('u.wardId IS NULL')
    .getMany();
  let backfilledUsers = 0;
  for (const user of usersWithoutWardId) {
    const matchedId = wardIdByName.get(user.ward.trim().toLowerCase());
    if (matchedId) {
      await userRepo.update({ id: user.id }, { wardId: matchedId });
      backfilledUsers += 1;
    }
  }

  const issueRepo = manager.getRepository(Issue);
  const issuesWithoutWardId = await issueRepo
    .createQueryBuilder('i')
    .where('i.wardId IS NULL')
    .getMany();
  let backfilledIssues = 0;
  for (const issue of issuesWithoutWardId) {
    const matchedId = wardIdByName.get(issue.ward.trim().toLowerCase());
    if (matchedId) {
      await issueRepo.update({ id: issue.id }, { wardId: matchedId });
      backfilledIssues += 1;
    }
  }

  const activeWards = allWards.filter((w) => w.isActive).length;

  return {
    source: loaded.source,
    filePath: loaded.filePath,
    imported: recordsToUpsert.length,
    activeWards,
    backfilledUsers,
    backfilledIssues,
  };
}

