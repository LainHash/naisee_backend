import dataSource from '../data-source.js';
import { runSeed } from './seed.js';

async function main() {
  const reset = process.argv.includes('--reset');

  await dataSource.initialize();
  try {
    await dataSource.synchronize();
    const result = await runSeed(dataSource, { reset });
    console.log(
      reset ? 'SEED_RESET_RESULT:' : 'SEED_RESULT:',
      JSON.stringify(result),
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

