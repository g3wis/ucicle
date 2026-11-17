import React, {
  ReactNode, useEffect, useId, useRef,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Icon from './Icon';
import { useApp } from '../app/context';
import {
  DURATION, EASE_IN, EASE_OUT,
} from '../motion/tokens';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select', 'textarea', '[tabindex]:not([tabindex="-1"])',
].join(', ');

type Props = {
  open: boolean,
  title: string,
  onClose: () => void,
  children: ReactNode,
  /** Extra class on the panel surface, for the panel's own styles. */
  className?: string,
};

/**
 * A bottom sheet on phones, a right-hand panel from 768 px: role dialog, focus kept inside,
 * Escape and the close button close it, focus goes back to what opened it.
 */
export default function Panel({
  open, title, onClose, children, className,
}: Props) {
  const { content } = useApp();
  const reduce = useReducedMotion();
  const titleId = useId();
  const surface = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    opener.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      surface.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !surface.current) return;
      const items = Array.from(surface.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [open, onClose]);

  const offset = reduce ? 0 : 16;
  // A side panel slides in from the right, a bottom sheet from below.
  const wide = window.matchMedia('(min-width: 768px)').matches;
  const from = wide ? { x: offset, y: 0 } : { x: 0, y: offset };
  const to = wide ? { x: offset / 2, y: 0 } : { x: 0, y: offset / 2 };
  const inDuration = reduce ? DURATION.reduced : DURATION.panel;
  const outDuration = reduce ? DURATION.reduced : DURATION.panelOut;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="panel"
          className="panel-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: inDuration } }}
          exit={{ opacity: 0, transition: { duration: outDuration } }}
        >
          <button
            type="button"
            className="panel-backdrop"
            tabIndex={-1}
            aria-hidden="true"
            onClick={onClose}
          />
          <motion.div
            ref={surface}
            className={className ? `panel ${className}` : 'panel'}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, ...from }}
            animate={{
              opacity: 1, x: 0, y: 0, transition: { duration: inDuration, ease: EASE_OUT },
            }}
            exit={{ opacity: 0, ...to, transition: { duration: outDuration, ease: EASE_IN } }}
          >
            <div className="panel-head">
              <h2 className="panel-title" id={titleId}>{title}</h2>
              <button type="button" className="icon-button" onClick={onClose} data-autofocus>
                <Icon name="close" />
                <span className="sr-only">{content.panel.close}</span>
              </button>
            </div>
            <div className="panel-body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
