// Reads the feedback staff sent from the app (right-click on anything) and prints it as Markdown.
//
//   npm run feedback                      new entries, oldest first
//   npm run feedback -- --all             every entry, with its status
//   npm run feedback -- --mark-seen       new entries, then marks them "seen" (reported)
//   npm run feedback -- --set <id> <status>   e.g. done, planned, wontfix, seen, new
//   npm run feedback -- --emulator        the local Firestore emulator instead of the real project
//
// Reads the real project as you, through your own gcloud login (`gcloud auth login` once);
// administrators are not bound by firestore.rules, which let the app only add entries.
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const emulator = flag('--emulator');
const project = option('--project') ?? (emulator ? 'prana-crm' : 'prana-studio-crm');
const base = emulator ? 'http://127.0.0.1:8080/v1' : 'https://firestore.googleapis.com/v1';
const root = `${base}/projects/${project}/databases/(default)/documents`;

function token() {
  if (emulator) return 'owner';
  try {
    return execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
  } catch {
    console.error('Could not get a Google access token. Run `gcloud auth login` once, then try again.');
    process.exit(1);
  }
}

const headers = { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' };
if (!emulator) headers['x-goog-user-project'] = project;

async function call(method, url, body) {
  const res = await fetch(url, { method, headers, body: body && JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${url.replace(root, '…')}: ${res.status} ${json?.error?.message ?? ''}`);
  return json;
}

/** Firestore's typed JSON → plain values. */
function plain(value) {
  if (!value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(plain);
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields ?? {}).map(([k, v]) => [k, plain(v)]));
  return null;
}

async function listAll() {
  const entries = [];
  let pageToken;
  do {
    const page = await call('GET', `${root}/feedback?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`);
    for (const doc of page.documents ?? []) entries.push({ id: doc.name.split('/').pop(), ...plain({ mapValue: { fields: doc.fields } }) });
    pageToken = page.nextPageToken;
  } while (pageToken);
  return entries.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

async function setStatus(id, status) {
  await call('PATCH', `${root}/feedback/${id}?updateMask.fieldPaths=status&currentDocument.exists=true`, { fields: { status: { stringValue: status } } });
}

const KIND = { bug: 'Something is wrong', idea: 'Suggestion', question: 'Question' };

function render(entries, showStatus) {
  if (!entries.length) return showStatus ? 'No feedback yet.' : 'No new feedback.';
  const zagreb = new Intl.DateTimeFormat('hr-HR', { timeZone: 'Europe/Zagreb', dateStyle: 'short', timeStyle: 'short' });
  return entries
    .map((e, i) => {
      const when = e.created_at ? zagreb.format(new Date(e.created_at)) : '?';
      const lines = [
        `### ${i + 1}. ${KIND[e.kind] ?? e.kind} · ${e.page?.title ?? ''} (${e.page?.path ?? ''})${showStatus ? ` · [${e.status}]` : ''}`,
        `- **About:** ${(e.target?.path ?? []).join(' › ') || e.target?.label}`,
        `- **From:** ${e.author?.name} <${e.author?.email}> · ${when} · ${e.context?.lang} · ${e.context?.viewport} · build ${e.context?.build}`,
        `- **Element:** \`${e.target?.selector}\``,
        `- **Id:** \`${e.id}\``,
        '',
        ...String(e.comment ?? '').split('\n').map((l) => `> ${l}`),
      ];
      return lines.join('\n');
    })
    .join('\n\n');
}

const set = option('--set');
if (set) {
  const status = args[args.indexOf('--set') + 2];
  if (!status) throw new Error('Usage: --set <id> <status>');
  await setStatus(set, status);
  console.log(`${set} → ${status}`);
} else {
  const all = await listAll();
  const showAll = flag('--all');
  const shown = showAll ? all : all.filter((e) => e.status === 'new');
  console.log(`# Feedback (${project}): ${shown.length} ${showAll ? 'in total' : 'new'}\n`);
  console.log(render(shown, showAll));
  if (flag('--mark-seen')) {
    const fresh = shown.filter((e) => e.status === 'new');
    for (const e of fresh) await setStatus(e.id, 'seen');
    console.log(`\nMarked ${fresh.length} as seen.`);
  }
}
