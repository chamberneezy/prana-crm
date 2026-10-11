// Prints seed SQL for `wrangler d1 execute --file`.
//   tsx scripts/seed.ts --dev
//   tsx scripts/seed.ts --prod --owner-email you@example.com [--owner-name "Mario"]
import { devSeed, prodSeed, toSql } from '../src/seed';

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const now = new Date().toISOString();

function fail(message: string): never {
  throw new Error(message);
}

function build(): string[] {
  if (args.includes('--dev')) return toSql(devSeed({ now }), 'refresh');
  if (args.includes('--prod')) {
    const ownerEmail = option('--owner-email') ?? fail('The production seed needs --owner-email: the address the owner signs in with.');
    return toSql(prodSeed({ now, ownerEmail, ownerName: option('--owner-name') }), 'keep');
  }
  return fail('Pass --dev or --prod.');
}

process.stdout.write(`${build().join(';\n')};\n`);
