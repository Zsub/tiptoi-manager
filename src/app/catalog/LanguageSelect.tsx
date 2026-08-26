import { Badge, FieldCheckbox, Loader } from '@theme';
import React from 'react';

import { STATE, useCatalog } from '@app/catalog/CatalogContext.tsx';
import { LANGUAGES, Locale } from '@app/catalog/languages.ts';

import cn from '@utils/classnames';

import styles from './LanguageSelect.module.css';

const labelFor = (code: Locale): string =>
  LANGUAGES.find((language) => language.code === code)?.label || code;

/** In-progress pointer reorder of the selected-languages list. */
interface DragState {
  /** Locale being dragged. */
  code: Locale;
  /** `PointerEvent.pointerId` that owns this drag - ignore all others. */
  pointerId: number;
  /** Live working order, seeded from `selectedLanguages` at drag start. */
  order: Array<Locale>;
  /** Vertical offset (px) between the pointer and the row's top edge. */
  grabOffset: number;
  /** Current `translateY` (px) applied to the dragged row. */
  transform: number;
}

/**
 * Lets the user pick which catalog languages to download and in which order.
 * The app UI itself stays English - this only controls the catalog data:
 * index 0 of `selectedLanguages` is the primary language, used elsewhere to
 * decide which title and image are shown for each product.
 */
const LanguageSelect: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  const { selectedLanguages, setSelectedLanguages, stateByLang } =
    useCatalog();

  const [drag, setDrag] = React.useState<DragState | null>(null);
  const [announcement, setAnnouncement] = React.useState('');

  // Mirrors of state read from event handlers / effects that must not close
  // over a stale render (pointer and keyboard listeners, cleanup on unmount).
  const dragRef = React.useRef<DragState | null>(null);
  dragRef.current = drag;
  const rowRefs = React.useRef<Map<Locale, HTMLLIElement>>(new Map());
  const handleElRef = React.useRef<HTMLSpanElement | null>(null);
  const appliedTransformRef = React.useRef(0);
  const originalOrderRef = React.useRef<Array<Locale> | null>(null);

  const addLanguage = (code: Locale) => {
    if (selectedLanguages.includes(code)) return;
    setSelectedLanguages([...selectedLanguages, code]);
  };

  const removeLanguage = (code: Locale) => {
    // The selection must never become empty - block removing the last one.
    if (selectedLanguages.length <= 1) return;
    setSelectedLanguages(selectedLanguages.filter((lang) => lang !== code));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= selectedLanguages.length) return;
    const next = [...selectedLanguages];
    [next[index], next[target]] = [next[target], next[index]];
    setSelectedLanguages(next);
  };

  // Ends the current drag without persisting anything - used for
  // pointercancel, Escape, and forced clean-up (unmount, selection changed
  // out from under the drag). Reads only refs, so it is safe from effects
  // and stays referentially stable.
  const cancelDrag = React.useCallback(() => {
    const current = dragRef.current;
    if (!current) return;
    try {
      handleElRef.current?.releasePointerCapture(current.pointerId);
    } catch {
      // Capture may already be released, or the element may be gone.
    }
    originalOrderRef.current = null;
    handleElRef.current = null;
    setDrag(null);
  }, []);

  // Escape cancels an in-progress drag. The handle itself is non-focusable
  // (see the `aria-hidden` span below), so this has to live on `window`
  // rather than on a keydown handler on the handle.
  const isDragging = drag !== null;
  React.useEffect(() => {
    if (!isDragging) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelDrag();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDragging, cancelDrag]);

  // If the selection changes out from under an active drag - a language
  // removed/added via the checkboxes - the in-progress reorder no longer
  // corresponds to a real state, so drop it rather than let it commit a
  // stale/corrupt order. Our own commit (setSelectedLanguages + setDrag(null)
  // in the same handler) always clears `drag` in the same update, so this
  // only fires for genuinely external changes.
  React.useEffect(() => {
    const current = dragRef.current;
    if (!current) return;
    const sameSet =
      current.order.length === selectedLanguages.length &&
      current.order.every((code) => selectedLanguages.includes(code));
    if (!sameSet) cancelDrag();
  }, [selectedLanguages, cancelDrag]);

  // Clean up on unmount so a lingering pointer capture / listener never
  // outlives the component.
  React.useEffect(() => cancelDrag, [cancelDrag]);

  const handlePointerDown = (
    e: React.PointerEvent<HTMLSpanElement>,
    code: Locale
  ) => {
    // Only the primary pointer, and only the left mouse button - ignore
    // right-click, middle-click, and secondary touch points.
    if (!e.isPrimary || e.button !== 0) return;
    if (selectedLanguages.length < 2) return; // nothing to reorder
    if (dragRef.current) return; // a drag is already in progress

    const rowEl = rowRefs.current.get(code);
    if (!rowEl) return;

    const rect = rowEl.getBoundingClientRect();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    handleElRef.current = target;
    appliedTransformRef.current = 0;
    originalOrderRef.current = selectedLanguages;

    setDrag({
      code,
      pointerId: e.pointerId,
      order: [...selectedLanguages],
      grabOffset: e.clientY - rect.top,
      transform: 0,
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const clientY = e.clientY;

    setDrag((prev) => {
      if (!prev || prev.pointerId !== e.pointerId) return prev;

      const rowEl = rowRefs.current.get(prev.code);
      if (!rowEl) return prev;

      // Re-derive the row's untransformed ("natural") top from its current
      // rect and the transform we last applied, then compute exactly the
      // transform needed to keep it pinned under the pointer. Recomputing
      // this way (rather than accumulating a raw pointer delta) keeps the
      // row glued to the pointer even when the natural slot itself just
      // jumped because `order` changed.
      const rect = rowEl.getBoundingClientRect();
      const naturalTop = rect.top - appliedTransformRef.current;
      const nextTransform = clientY - prev.grabOffset - naturalTop;
      appliedTransformRef.current = nextTransform;

      // Where should the dragged row land among the others? Compare the
      // pointer position against each other row's vertical midpoint - the
      // classic "insert before the first row whose midpoint is below the
      // pointer" scan. Clamps naturally to the ends via the loop bounds.
      const others = prev.order.filter((code) => code !== prev.code);
      let targetPos = others.length;
      for (let i = 0; i < others.length; i += 1) {
        const el = rowRefs.current.get(others[i]);
        if (!el) continue;
        const otherRect = el.getBoundingClientRect();
        if (clientY < otherRect.top + otherRect.height / 2) {
          targetPos = i;
          break;
        }
      }

      const nextOrder = [
        ...others.slice(0, targetPos),
        prev.code,
        ...others.slice(targetPos),
      ];
      const orderChanged = nextOrder.some((code, i) => code !== prev.order[i]);

      return {
        ...prev,
        transform: nextTransform,
        order: orderChanged ? nextOrder : prev.order,
      };
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Capture may already be released.
    }

    const original = originalOrderRef.current;
    const changed =
      !!original &&
      (drag.order.length !== original.length ||
        drag.order.some((code, i) => code !== original[i]));

    if (changed) {
      setSelectedLanguages(drag.order);
      const newIndex = drag.order.indexOf(drag.code);
      setAnnouncement(
        `${labelFor(drag.code)} moved to position ${newIndex + 1} of ${
          drag.order.length
        }.`
      );
    }

    originalOrderRef.current = null;
    handleElRef.current = null;
    setDrag(null);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Capture may already be released.
    }
    originalOrderRef.current = null;
    handleElRef.current = null;
    setDrag(null);
  };

  const displayOrder = drag ? drag.order : selectedLanguages;

  return (
    <div className={cn(className, styles.root)}>
      <p className={styles.hint}>
        The first language in the order below is the primary language: it
        supplies the title and image shown for each product.
      </p>

      <span className={styles.visuallyHidden} aria-live="polite">
        {announcement}
      </span>

      <ol className={styles.selected}>
        {displayOrder.map((code, index) => {
          const state = stateByLang[code];
          const label = labelFor(code);
          const isDragged = drag?.code === code;
          const selectedIndex = selectedLanguages.indexOf(code);

          return (
            <li
              className={cn(styles.selectedItem, isDragged && styles.dragging)}
              key={code}
              ref={(el) => {
                if (el) rowRefs.current.set(code, el);
                else rowRefs.current.delete(code);
              }}
              style={
                isDragged
                  ? { transform: `translateY(${drag.transform}px)` }
                  : undefined
              }
            >
              {selectedLanguages.length > 1 && (
                <span
                  className={styles.handle}
                  aria-hidden="true"
                  title="Drag to reorder"
                  onPointerDown={(e) => handlePointerDown(e, code)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerCancel}
                >
                  ⠿
                </span>
              )}
              <span className={styles.selectedLabel}>{label}</span>
              {index === 0 && (
                <Badge className={styles.badge} text="Primary" type="success" />
              )}
              {state === STATE.LOADING && (
                <span className={styles.stateLoader}>
                  <Loader />
                </span>
              )}
              {state === STATE.ERROR && (
                <Badge className={styles.badge} text="Error" type="error" />
              )}
              <span className={styles.order}>
                <button
                  type="button"
                  className={styles.orderButton}
                  onClick={() => move(selectedIndex, -1)}
                  disabled={selectedIndex <= 0}
                  aria-label={`Move ${label} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={styles.orderButton}
                  onClick={() => move(selectedIndex, 1)}
                  disabled={selectedIndex === selectedLanguages.length - 1}
                  aria-label={`Move ${label} down`}
                >
                  ↓
                </button>
              </span>
            </li>
          );
        })}
      </ol>

      <ul className={styles.available}>
        {LANGUAGES.map(({ code, label, available }) => {
          const checked = selectedLanguages.includes(code);
          // Disabled either because the catalog does not exist (en_GB), or
          // because unchecking it would leave the selection empty.
          const disabled =
            !available || (checked && selectedLanguages.length <= 1);
          return (
            <li className={styles.availableItem} key={code}>
              <FieldCheckbox
                className={styles.checkbox}
                id={`catalog-language-${code}`}
                name={`catalog-language-${code}`}
                value={code}
                checked={checked}
                disabled={disabled}
                onChange={() =>
                  checked ? removeLanguage(code) : addLanguage(code)
                }
                label={available ? label : `${label} (unavailable)`}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default LanguageSelect;
