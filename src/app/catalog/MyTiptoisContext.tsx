import React from 'react';

import { useGmeFileStore } from '@app/storage/StorageContext.tsx';
import { SavedProduct } from '@app/storage/gmeFilesDB.ts';

export enum STATE {
  IDLE = 'idle',
  LOADING = 'loading',
  ERROR = 'error',
  SUCCESS = 'success',
}

const MyTiptoisContext = React.createContext<{
  state: STATE;
  products: Array<SavedProduct>;
}>({
  state: STATE.IDLE,
  products: [],
});

export const MyTiptoisContextProvider: React.FC<{
  children: React.ReactElement;
}> = ({ children }) => {
  const [state, setState] = React.useState<STATE>(STATE.IDLE);
  const { fileKeys, getFile } = useGmeFileStore();
  const [products, setProducts] = React.useState<Array<SavedProduct>>([]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- flags the load as in-flight when the effect re-runs on fileKeys change, which an initial value cannot cover
    setState(STATE.LOADING);
    Promise.all(fileKeys.map((key) => getFile(key)))
      .then((products) => {
        // A key can disappear between listing and reading it back.
        setProducts(products.filter((p): p is SavedProduct => Boolean(p)));
        setState(STATE.SUCCESS);
      })
      .catch(() => setState(STATE.ERROR));
  }, [fileKeys, getFile]);

  return (
    <MyTiptoisContext.Provider value={{ state, products }}>
      {children}
    </MyTiptoisContext.Provider>
  );
};

export const useMyTiptois = () => React.useContext(MyTiptoisContext);
