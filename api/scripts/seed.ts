// Prints seed SQL for `wrangler d1 execute --file`.
//   tsx scripts/seed.ts --dev
//   tsx scripts/seed.ts --prod --owner "Mario <mario@example.com>" --owner "Matija <matija@example.com>"
// Each --owner is someone who may sign in as owner of the studio. Addresses are passed here, not kept in the repository.
import { devSeed, prodSeed, toSql } from '../src/seed';

const args = process.argv.slice(2);
/** Every value given for a repeatable option. */
const options = (name: string) => args.flatMap((arg, i) => (arg === name && args[i + 1] ? [args[i + 1]!] : []));

function parseOwner(text: string) {
  const match = /^\s*(.+?)\s*<([^<>\s]+@[^<>\s]+)>\s*$/.exec(text);
  if (!match) return fail(`Write each owner as "Name <address>", not: ${text}`);
  return { name: match[1]!, email: match[2]! };
}

const now = new Date().toISOString();

function fail(message: string): never {
  throw new Error(message);
}

function build(): string[] {
  if (args.includes('--dev')) return toSql(devSeed({ now }), 'refresh');
  if (args.includes('--prod')) {
    const owners = options('--owner').map(parseOwner);
    if (!owners.length) return fail('The production seed needs at least one --owner "Name <address>": the people who sign in as owner.');
    return toSql(prodSeed({ now, owners }), 'keep');
  }
  return fail('Pass --dev or --prod.');
}

process.stdout.write(`${build().join(';\n')};\n`);
