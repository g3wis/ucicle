import React, {
  KeyboardEvent, useEffect, useId, useMemo, useRef, useState,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Rider } from '../types/CyclingTypes';
import { matchRiders, RiderMatch, shortName } from '../data/riders';
import { countryCode } from '../data/countries';
import { useApp } from '../app/context';
import { isPhone } from '../app/media';
import { DURATION } from '../motion/tokens';

/** Room kept above the lifted slot, under the header and the facts band (--sp-2). */
const LIFT_GAP = 8;

/**
 * On a phone, the tapped slot rises under the sticky header and under the facts band (which shows
 * as soon as the mystery bib leaves the view), so the list opens above the keyboard and nothing
 * covers the field.
 */
function liftUnderHeader(target: Element, behavior: ScrollBehavior) {
  const header = document.querySelector('.site-header')?.getBoundingClientRect().height ?? 0;
  const band = document.querySelector('.facts-band')?.getBoundingClientRect().height ?? 0;
  const top = target.getBoundingClientRect().top + window.scrollY - header - band - LIFT_GAP;
  window.scrollTo({ top: Math.max(0, top), behavior });
}

type Props = {
  riders: Rider[],
  /** Names already played today: shown, but cannot be chosen again. */
  played: string[],
  label: string,
  onSubmit: (rider: Rider) => void,
  /**
   * Focus the field when it mounts (after a try, not on the first load of a phone). Below 1024 px
   * the focus does not scroll: the page brings the slot into reach once the new bib has landed.
   */
  focusOnMount: boolean,
};

function Highlight({ match }: { match: RiderMatch }) {
  const { name } = match.rider;
  return (
    <>
      {name.slice(0, match.start)}
      <b>{name.slice(match.start, match.start + match.length)}</b>
      {name.slice(match.start + match.length)}
    </>
  );
}

/**
 * The rider field (WAI-ARIA APG combobox with a listbox popup), then a separate validation:
 * choosing a rider never spends a try; "Valider <rider>" does.
 */
export default function RiderCombobox({
  riders, played, label, onSubmit, focusOnMount,
}: Props) {
  const { content, announce } = useApp();
  const g = content.game;
  const reduce = useReducedMotion();
  const inputId = useId();
  const listId = useId();
  const hintId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Rider | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typed = useRef('');

  const matches = useMemo(() => (selected ? [] : matchRiders(riders, query)), [riders, query, selected]);
  const isPlayed = (r: Rider) => played.includes(r.name);
  const showList = open && query.trim().length >= 2;

  useEffect(() => {
    if (focusOnMount) input.current?.focus({ preventScroll: isPhone() });
  }, [focusOnMount]);

  // The field remounts after each try: never leave the keyboard room behind.
  useEffect(() => () => document.documentElement.classList.remove('is-picking'), []);

  // The count is announced once typing pauses, not on every key.
  useEffect(() => {
    if (!showList) return undefined;
    const timer = window.setTimeout(() => {
      announce(matches.length ? g.combobox.results(matches.length) : g.combobox.none);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [showList, matches.length, announce, g.combobox]);

  const choose = (match: RiderMatch) => {
    if (isPlayed(match.rider)) return;
    setSelected(match.rider);
    setQuery(match.rider.name);
    setOpen(false);
    setActive(-1);
  };

  const submit = () => {
    if (!selected) return;
    onSubmit(selected);
    setSelected(null);
    setQuery('');
    typed.current = '';
  };

  const move = (step: number) => {
    if (!matches.length) return;
    setOpen(true);
    let next = active;
    for (let i = 0; i < matches.length; i += 1) {
      next = (next + step + matches.length) % matches.length;
      if (!isPlayed(matches[next].rider)) break;
    }
    setActive(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Enter':
        event.preventDefault();
        if (showList && active >= 0) choose(matches[active]);
        else if (showList) {
          // A phone has no arrow keys: its search key picks the first playable rider.
          const first = matches.find((m) => !isPlayed(m.rider));
          if (first) choose(first);
        } else if (selected) submit();
        break;
      case 'Escape':
        if (showList) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          setActive(-1);
          setQuery(typed.current);
        } else if (query) {
          event.preventDefault();
          setQuery('');
          setSelected(null);
          typed.current = '';
        }
        break;
      default:
        break;
    }
  };

  const buttonLabel = selected ? g.validateRider(shortName(selected.name, riders)) : g.validate;
  const activeId = showList && active >= 0 ? `${listId}-${active}` : undefined;

  return (
    <div className="rider-picker">
      <label className="try-label" htmlFor={inputId}>{label}</label>
      <div className="rider-field">
        <div className="rider-input">
          <input
            ref={input}
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            aria-describedby={hintId}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            enterKeyHint={selected ? 'go' : 'search'}
            placeholder={g.placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              typed.current = e.target.value;
              setSelected(null);
              setOpen(true);
              setActive(-1);
            }}
            onKeyDown={onKeyDown}
            onFocus={() => {
              // On a phone, room under the page while the keyboard is up, so the slot can rise.
              if (window.matchMedia('(pointer: coarse)').matches) {
                document.documentElement.classList.add('is-picking');
              }
            }}
            onPointerDown={() => {
              // On a phone, a tap lifts the whole active slot under the header and the facts band,
              // so the list fits above the keyboard. Focus given by code does not move the page.
              if (!window.matchMedia('(pointer: coarse)').matches) return;
              const behavior = reduce ? 'auto' : 'smooth';
              window.setTimeout(() => {
                const target = input.current?.closest('.bib-slot') ?? input.current?.closest('.rider-picker');
                if (target) liftUnderHeader(target, behavior);
              }, 250);
            }}
            onBlur={() => {
              setOpen(false);
              document.documentElement.classList.remove('is-picking');
            }}
          />
          <ul id={listId} role="listbox" aria-label={label} className="rider-options" hidden={!showList}>
            {showList && matches.length === 0 && (
              <li className="rider-option-none" role="presentation">{g.combobox.none}</li>
            )}
            {showList && matches.map((m, i) => {
              const done = isPlayed(m.rider);
              return (
                <li
                  key={m.rider.name}
                  id={`${listId}-${i}`}
                  role="option"
                  tabIndex={-1}
                  className="rider-option"
                  aria-selected={i === active}
                  aria-disabled={done}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(m)}
                  onKeyDown={() => undefined}
                >
                  <span className="rider-option-name"><Highlight match={m} /></span>
                  <span className="rider-option-meta">
                    <span className="rider-option-country">{countryCode(m.rider.country)}</span>
                    <span className="rider-option-team">
                      {done ? g.combobox.alreadyPlayed : (m.rider.team ?? g.noTeam)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <button
          type="button"
          className="button button-primary validate"
          disabled={!selected}
          aria-label={buttonLabel}
          onClick={submit}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={buttonLabel}
              className="validate-label"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? DURATION.reduced : DURATION.fast }}
            >
              {buttonLabel}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
      <p id={hintId} className="sr-only">{g.combobox.instructions}</p>
    </div>
  );
}
