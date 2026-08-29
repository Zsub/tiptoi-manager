import { autoUpdate, flip, shift, useFloating } from '@floating-ui/react-dom';
import React, { MutableRefObject } from 'react';

import cn from '@utils/classnames.ts';

import styles from './Tooltip.module.css';

let i = 0;

const Tooltip: React.FC<{
  children: any;
  tooltipRef: MutableRefObject<HTMLElement>;
  triggerRef?: MutableRefObject<HTMLElement>;
  maxWidth?: number;
  placement?: 'bottom' | 'top' | 'left' | 'right';
}> = ({
  children,
  tooltipRef,
  triggerRef: customTriggerRef = null,
  maxWidth = null,
  placement = 'bottom',
}) => {
  const [show, setShow] = React.useState<boolean>(false);

  // `flip` and `shift` reproduce what Popper applied by default. There is
  // deliberately no `offset` middleware: the gap between trigger and bubble
  // comes from `.tooltipInner`'s margin-top, as it always has.
  const { refs, floatingStyles } = useFloating({
    placement,
    middleware: [flip(), shift()],
    whileElementsMounted: autoUpdate,
  });

  const id: string = React.useMemo(() => {
    i++;
    return `tooltip${i}`;
  }, []);

  // Runs after commit, so tooltipRef.current is already attached even on the
  // very first invocation - unlike useMemo (which runs during render and
  // would need an incidental extra re-render to observe a populated ref).
  React.useEffect(() => {
    tooltipRef?.current?.setAttribute('aria-describedby', id);
  }, [tooltipRef, id]);

  // Callers pass the trigger as a ref to an element rendered *after* this one,
  // so it is only populated once the tree has committed. Handing the element
  // over from an effect is both correct and what keeps refs out of render.
  React.useEffect(() => {
    refs.setReference(tooltipRef?.current ?? null);
  }, [refs, tooltipRef]);

  React.useEffect(() => {
    const element = customTriggerRef
      ? customTriggerRef?.current
      : tooltipRef?.current;
    if (!element) return;

    // These have to be the same function objects on the way out as on the way
    // in - the previous implementation built fresh arrows for removal, so the
    // listeners outlived every unmount.
    const onEnter = () => setShow(true);
    const onLeave = () => setShow(false);

    element.addEventListener('mouseover', onEnter);
    element.addEventListener('mouseleave', onLeave);
    return () => {
      element.removeEventListener('mouseover', onEnter);
      element.removeEventListener('mouseleave', onLeave);
    };
  }, [tooltipRef, customTriggerRef]);

  return (
    <div
      // eslint-disable-next-line react-hooks/refs -- false positive: refs.setFloating is Floating UI's ref-setter callback, not a ref read
      ref={refs.setFloating}
      className={cn(styles.tooltip, { [styles.tooltipShow]: show })}
      role="tooltip"
      id={id}
      aria-hidden={!show}
      style={{ ...floatingStyles, ...(maxWidth ? { maxWidth } : {}) }}
    >
      <div className={styles.tooltipInner}>
        {children}
        <div className={styles.arrow} />
      </div>
    </div>
  );
};

export default Tooltip;
