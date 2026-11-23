import { foldSearch, formatIndex } from '../../i18n/format';
import { riderPath } from '../../app/nav';
import type { Lang } from '../../i18n/language';

/** One rider of /api/recherche. */
type Hit = {
  slug: string,
  name: string,
  team: string | null,
  index: number | null,
  rank: number | null,
  status: 'classified' | 'provisional' | 'inactive' | null,
};

/** The field's copy, serialised by RiderSearch.astro from src/content (no string lives here). */
type Copy = {
  instructions: string,
  /** counts[n]: the sentence for n riders listed (0 to 8). */
  counts: string[],
  none: string,
  failed: string,
  status: Record<'classified' | 'provisional' | 'inactive', string>,
  noIndex: string,
  rank: string,
  index: string,
};

const MIN_LETTERS = 2;
const DEBOUNCE_MS = 120;
/** The count is said once typing pauses, not on every key (as in RiderCombobox). */
const ANNOUNCE_MS = 500;
/** Room kept above the lifted field, under the sticky header. */
const LIFT_GAP = 8;

const APOSTROPHES = /['’ʼ`]/;
const MARK = /\p{M}/u;

/**
 * Where the folded query sits in the displayed name, mapped back to the name's own characters:
 * the start of the name or of a word first, else anywhere. Null when the query is not in it as
 * one piece ("pogacar tadej").
 */
function matchRange(name: string, query: string): [number, number] | null {
  if (!query) return null;
  let folded = '';
  // For each character of `folded`: where its source character starts and ends in `name`.
  const origin: [number, number][] = [];
  let offset = 0;
  Array.from(name).forEach((char) => {
    let piece = foldSearch(char);
    if (!piece && !APOSTROPHES.test(char) && !MARK.test(char)) piece = ' ';
    if (piece === ' ' && (folded === '' || folded.endsWith(' '))) piece = '';
    for (let i = 0; i < piece.length; i += 1) origin.push([offset, offset + char.length]);
    folded += piece;
    offset += char.length;
  });
  let at = ` ${folded}`.indexOf(` ${query}`);
  if (at < 0) at = folded.indexOf(query);
  if (at < 0) return null;
  return [origin[at][0], origin[at + query.length - 1][1]];
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function srOnly(text: string): HTMLSpanElement {
  return el('span', 'sr-only', text);
}

/** Turns one `form[data-rider-search]` into the combobox. */
export function enhanceRiderSearch(form: HTMLFormElement): void {
  if (form.hasAttribute('data-enhanced')) return;
  const input = form.querySelector<HTMLInputElement>('input[name="q"]');
  const list = form.querySelector<HTMLUListElement>('[role="listbox"]');
  const hint = form.querySelector<HTMLElement>('[data-hint]');
  const live = form.querySelector<HTMLElement>('[data-live]');
  // No match, no answer: a sentence under the field. A listbox is never opened without an option
  // (an expanded list holding only a sentence is announced as an empty list).
  const message = form.querySelector<HTMLElement>('[data-message]');
  if (!input || !list || !hint || !live || !message) return;
  form.setAttribute('data-enhanced', 'true');
  const lang = (form.dataset.lang === 'en' ? 'en' : 'fr') as Lang;
  const copy = JSON.parse(form.dataset.copy ?? '{}') as Copy;

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', list.id);
  input.setAttribute('aria-autocomplete', 'list');
  hint.textContent = copy.instructions;
  input.setAttribute('aria-describedby', hint.id);

  let hits: Hit[] = [];
  let hitsFor = '';
  let active = -1;
  let typed = input.value;
  let fetchTimer = 0;
  let announceTimer = 0;
  let controller: AbortController | null = null;

  const optionId = (i: number) => `${list.id}-${i}`;
  const isOpen = () => input.getAttribute('aria-expanded') === 'true';

  const announce = (text: string) => {
    window.clearTimeout(announceTimer);
    announceTimer = window.setTimeout(() => { live.textContent = text; }, ANNOUNCE_MS);
  };

  const close = () => {
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    list.hidden = true;
    active = -1;
  };

  const open = () => {
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  /** Prints the sentence under the field (the live region says it too). */
  const say = (text: string) => {
    message.textContent = text;
    message.hidden = false;
  };

  const unsay = () => {
    message.hidden = true;
    message.textContent = '';
  };

  const setActive = (next: number) => {
    const options = list.querySelectorAll<HTMLElement>('[role="option"]');
    options.forEach((o, i) => o.setAttribute('aria-selected', String(i === next)));
    active = next;
    if (next >= 0 && options[next]) {
      input.setAttribute('aria-activedescendant', optionId(next));
      options[next].scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  };

  const go = (hit: Hit) => {
    close();
    window.location.assign(riderPath(lang, hit.slug));
  };

  const option = (hit: Hit, i: number, query: string): HTMLLIElement => {
    const li = el('li', 'search-option');
    li.id = optionId(i);
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', 'false');

    if (hit.rank !== null) {
      const rank = el('span', 'search-option-rank');
      rank.dataset.digits = String(String(hit.rank).length);
      rank.append(srOnly(`${copy.rank} `), String(hit.rank));
      li.append(rank);
    } else {
      // A bib with no number: never a fake rank.
      const blank = el('span', 'search-option-rank search-option-rank-none');
      blank.setAttribute('aria-hidden', 'true');
      li.append(blank);
    }

    const who = el('span', 'search-option-who');
    const name = el('span', 'search-option-name');
    const range = matchRange(hit.name, query);
    if (range) {
      const [start, end] = range;
      name.append(hit.name.slice(0, start), el('b', undefined, hit.name.slice(start, end)), hit.name.slice(end));
    } else {
      name.textContent = hit.name;
    }
    who.append(name);
    if (hit.team) who.append(el('span', 'search-option-team', hit.team));
    li.append(who);

    const value = el('span', 'search-option-value');
    if (hit.rank !== null && hit.index !== null) {
      value.append(srOnly(`${copy.index} `), formatIndex(hit.index, lang));
    } else {
      value.classList.add('search-option-status');
      value.textContent = hit.status ? copy.status[hit.status] : copy.noIndex;
    }
    li.append(value);

    li.addEventListener('click', () => go(hit));
    return li;
  };

  const render = (query: string) => {
    list.replaceChildren(...hits.map((h, i) => option(h, i, query)));
    if (hits.length) {
      unsay();
      active = -1;
      input.removeAttribute('aria-activedescendant');
      open();
    } else {
      close();
      say(copy.none);
    }
    announce(copy.counts[Math.min(hits.length, copy.counts.length - 1)] ?? '');
  };

  const fail = () => {
    hits = [];
    hitsFor = '';
    list.replaceChildren();
    close();
    say(copy.failed);
    announce(copy.failed);
  };

  const ask = async (value: string) => {
    const folded = foldSearch(value);
    controller?.abort();
    if (folded.replace(/ /g, '').length < MIN_LETTERS) {
      hits = [];
      hitsFor = '';
      close();
      unsay();
      return;
    }
    if (folded === hitsFor) {
      render(folded);
      return;
    }
    controller = new AbortController();
    try {
      const response = await fetch(`/api/recherche/?q=${encodeURIComponent(value)}&lang=${lang}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json() as Hit[];
      if (foldSearch(input.value) !== folded) return;
      hits = Array.isArray(data) ? data : [];
      hitsFor = folded;
      if (document.activeElement === input) render(folded);
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      if (document.activeElement === input) fail();
    }
  };

  input.addEventListener('input', () => {
    typed = input.value;
    window.clearTimeout(fetchTimer);
    fetchTimer = window.setTimeout(() => { ask(typed); }, DEBOUNCE_MS);
  });

  input.addEventListener('keydown', (event) => {
    const count = hits.length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (!count) return;
        event.preventDefault();
        if (!isOpen()) render(hitsFor);
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const from = active < 0 && step < 0 ? 0 : active;
        setActive((from + step + count) % count);
        break;
      }
      case 'Enter':
        if (isOpen() && active >= 0 && hits[active]) {
          event.preventDefault();
          go(hits[active]);
        }
        // Otherwise the form is sent: the search page lists every match.
        break;
      case 'Escape':
        if (isOpen()) {
          event.preventDefault();
          event.stopPropagation();
          close();
          input.value = typed;
        } else if (input.value) {
          event.preventDefault();
          input.value = '';
          typed = '';
          hits = [];
          hitsFor = '';
          unsay();
        }
        break;
      case 'Tab':
        close();
        break;
      default:
        break;
    }
  });

  input.addEventListener('focus', () => {
    // Back on the field with the same text: the list it had comes back.
    if (hitsFor && foldSearch(input.value) === hitsFor) render(hitsFor);
    // On a phone the keyboard covers the lower half: the field rises under the header so its
    // list opens in view. Focus given by code never moves the page.
    if (window.matchMedia('(pointer: coarse)').matches) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.setTimeout(() => {
        const header = document.querySelector('.site-header')?.getBoundingClientRect().height ?? 0;
        const top = form.getBoundingClientRect().top + window.scrollY - header - LIFT_GAP;
        if (Math.abs(form.getBoundingClientRect().top - header - LIFT_GAP) > 4) {
          window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
        }
      }, 250);
    }
  });

  input.addEventListener('blur', () => close());

  // A press on the list keeps the focus in the field (the option's click then opens the page).
  list.addEventListener('mousedown', (event) => event.preventDefault());
}
