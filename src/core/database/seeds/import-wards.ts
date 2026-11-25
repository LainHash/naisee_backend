import dataSource from '../data-source.js';
import { upsertWardsAndBackfill } from './ward-seed.helper.js';

function getArgValue(prefix: string): string | undefined {
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

async function main() {
  const filePath = getArgValue('--file=');
  const activateCommunes = process.argv.includes('--all-communes');

  await dataSource.initialize();
  try {
    await dataSource.synchronize();
    const result = await dataSource.transaction((manager) =>
      upsertWardsAndBackfill(manager, { filePath, activateCommunes }),
    );
    console.log('IMPORT_WARDS_RESULT:', JSON.stringify(result));
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err: unknown) => {
  console.error('Import wards failed:', err);
  process.exit(1);
});

