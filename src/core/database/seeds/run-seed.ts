import dataSource from '../data-source.js';
import { runSeed } from './seed.js';

function getArgValue(prefix: string): string | undefined {
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

async function main() {
  const reset = process.argv.includes('--reset');
  const filePath = getArgValue('--file=');

  await dataSource.initialize();
  try {
    await dataSource.synchronize();
    const result = await runSeed(dataSource, { reset, filePath });
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
