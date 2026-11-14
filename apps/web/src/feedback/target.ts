/**
 * Works out what a right-click landed on: the element itself, the named sections around it
 * and the page, so feedback can be about any of them. Reads only what is on screen.
 */

export type TargetKind =
  | 'button'
  | 'link'
  | 'field'
  | 'tab'
  | 'option'
  | 'checkbox'
  | 'row'
  | 'heading'
  | 'image'
  | 'text'
  | 'section'
  | 'dialog'
  | 'menu'
  | 'table'
  | 'form'
  | 'page';

export interface Target {
  el: Element;
  kind: TargetKind;
  /** What the element says, as a person would name it. Empty when it has no words. */
  name: string;
}

const MAX_NAME = 80;

/** Elements someone would point at on their own. */
const ELEMENT = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="radio"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="option"]',
  '[role="menuitem"]',
  '[role="row"]',
  'tr',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'img',
].join(',');

/** Areas that group things on a page. Cards are found by their (CSS module) class name. */
const SECTION =
  'section, aside, nav, form, fieldset, table, dialog, [role="dialog"], [role="region"], [role="navigation"], [role="tabpanel"], [role="tablist"], [role="radiogroup"], [class*="card" i], [class*="panel" i]';

const HEADING = 'h1, h2, h3, h4, legend, caption, [class*="title" i], [class*="overline" i]';

function clean(text: string | null | undefined): string {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > MAX_NAME ? `${flat.slice(0, MAX_NAME - 1)}…` : flat;
}

function labelledBy(el: Element): string {
  const ids = el.getAttribute('aria-labelledby');
  if (!ids) return '';
  return clean(ids.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' '));
}

function visibleText(el: Element): string {
  return clean(el instanceof HTMLElement ? el.innerText : el.textContent);
}

function nameOf(el: Element): string {
  const aria = clean(el.getAttribute('aria-label')) || labelledBy(el);
  if (aria) return aria;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    const label = el.labels?.[0];
    return clean(label?.textContent) || clean(el.getAttribute('placeholder')) || clean(el.name);
  }
  if (el instanceof HTMLImageElement) return clean(el.alt);
  // A table row is named by its first cell (the class, the member…), not all its cells run together.
  const firstCell = el.matches('tr, [role="row"]') ? el.querySelector('th, td, [role="cell"], [role="gridcell"]') : null;
  if (firstCell) return nameOf(firstCell);
  // A row reads "AH / Ana Horvat / 2× tjedno · …": its first real line (not initials or an icon) names it.
  const lines = (el instanceof HTMLElement ? el.innerText : (el.textContent ?? '')).split('\n').map((l) => l.trim());
  return clean(lines.find((l) => l.length > 2) ?? lines.find(Boolean)) || clean(el.getAttribute('title'));
}

function kindOf(el: Element): TargetKind {
  const role = el.getAttribute('role');
  const tag = el.tagName.toLowerCase();
  if (role === 'tab') return 'tab';
  if (role === 'radio' || role === 'option' || role === 'menuitem') return 'option';
  if (role === 'checkbox' || role === 'switch') return 'checkbox';
  if (role === 'row' || tag === 'tr' || tag === 'li') return 'row';
  if (role === 'link' || tag === 'a') return 'link';
  if (role === 'button' || tag === 'button' || tag === 'summary') return 'button';
  if (tag === 'input' && ['checkbox', 'radio'].includes((el as HTMLInputElement).type)) return 'checkbox';
  if (['input', 'select', 'textarea', 'label'].includes(tag)) return 'field';
  if (/^h[1-6]$/.test(tag)) return 'heading';
  if (tag === 'img' || tag === 'svg') return 'image';
  return 'text';
}

function sectionKind(el: Element): TargetKind {
  const role = el.getAttribute('role');
  const tag = el.tagName.toLowerCase();
  if (tag === 'dialog' || role === 'dialog') return 'dialog';
  if (tag === 'nav' || role === 'navigation') return 'menu';
  if (tag === 'table') return 'table';
  if (tag === 'form' || tag === 'fieldset') return 'form';
  return 'section';
}

/** A section's own name: its label, or the first heading inside it. Unnamed sections are skipped. */
function sectionName(el: Element): string {
  const aria = clean(el.getAttribute('aria-label')) || labelledBy(el);
  if (aria) return aria;
  const heading = el.querySelector(HEADING);
  return heading ? visibleText(heading) : '';
}

/** The element itself: the nearest thing someone would point at, or the clicked node. */
function pickElement(start: Element, root: Element): Element {
  // Icons inside a button belong to the button.
  const found = start.closest(ELEMENT);
  if (found && root.contains(found)) return found;
  const svg = start.closest('svg');
  return svg ?? start;
}

/** The page's own title (the h1 in the main area), or null outside a page. */
function pageTarget(root: Element): Target | null {
  const h1 = root.querySelector('main h1');
  return h1 ? { el: root.querySelector('main') ?? h1, kind: 'page', name: visibleText(h1) } : null;
}

/** From the most specific to the whole page: the element, each named section around it, the page. */
export function targetsAt(start: Element, root: Element = document.body): Target[] {
  const el = pickElement(start, root);
  const list: Target[] = [{ el, kind: kindOf(el), name: nameOf(el) }];

  for (let node = el.parentElement; node && node !== root; node = node.parentElement) {
    if (node.tagName === 'MAIN') break;
    if (!node.matches(SECTION)) continue;
    const name = sectionName(node);
    // The same name twice in a row is one section drawn in two boxes.
    if (!name || list.some((t) => t.name === name)) continue;
    list.push({ el: node, kind: sectionKind(node), name });
  }

  const page = el.closest('main') ? pageTarget(root) : null;
  if (page && !list.some((t) => t.el === page.el)) list.push(page);
  return list;
}

/** The title of the page on screen (its h1), wherever the click was. */
export function pageTitle(root: Element = document.body): string {
  const h1 = root.querySelector('main h1');
  return h1 ? visibleText(h1) : '';
}

/** A short CSS path to the element, for finding it again in the code. */
export function selectorOf(el: Element): string {
  const parts: string[] = [];
  for (let node: Element | null = el; node && node !== document.body && parts.length < 5; node = node.parentElement) {
    const tag = node.tagName.toLowerCase();
    if (node.id) {
      parts.unshift(`${tag}#${node.id}`);
      break;
    }
    // CSS module class names look like `_card_1a2b3`; the readable part is enough.
    const cls = [...node.classList].map((c) => c.replace(/^_?([A-Za-z][\w-]*?)_[\w-]{5}$/, '$1')).slice(0, 2);
    const role = node.getAttribute('role');
    parts.unshift(`${tag}${role ? `[role=${role}]` : ''}${cls.map((c) => `.${c}`).join('')}`);
  }
  return parts.join(' > ').slice(0, 400);
}
