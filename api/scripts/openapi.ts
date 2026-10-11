// Writes docs/openapi.json from the zod schemas in packages/shared. The iOS app reads it as its typed reference.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildOpenApi } from '@prana/shared';

const target = resolve(import.meta.dirname, '../../docs/openapi.json');
writeFileSync(target, `${JSON.stringify(buildOpenApi(), null, 2)}\n`);
console.log(`Wrote ${target}`);
