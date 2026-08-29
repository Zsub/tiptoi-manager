import React from 'react';
import ReactDOM from 'react-dom';

import { ShadowBox } from '../index';

const Portal = ({ children }: { children?: React.JSX.Element }) =>
  ReactDOM.createPortal(
    children,
    // index.html always ships this container; a missing one is a
    // build-integrity problem, not a runtime branch to handle.
    document.querySelector('#shadowbox')!
  );

export default ({
  children,
  close,
  size,
  ...props
}: {
  children?: React.JSX.Element | React.JSX.Element[] | string;
  close: () => void;
  size?: 'large' | 'small';
  [key: string]: any;
}) => (
  <Portal>
    <ShadowBox children={children} close={close} size={size} {...props} />
  </Portal>
);
