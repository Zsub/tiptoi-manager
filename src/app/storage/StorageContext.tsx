import React from 'react';

import {
  SavedProduct,
  get as getGme,
  getKeys as getGmeKeys,
  set as setGme,
} from '@app/storage/gmeFilesDB.ts';

interface Space {
  totalSpace: number;
  usedSpace: number;
  persisted: boolean;
  persist: () => Promise<void>;
}

interface Files {
  fileKeys: Array<string>;
  getFile: (key: string) => Promise<SavedProduct | undefined>;
  setFile: (key: string, file: SavedProduct) => Promise<void>;
}

interface LocalStorage {
  setLocalItem: (key: string, value: string) => Promise<void>;
  getLocalItem: (key: string) => string | null;
}

interface Context extends Files, LocalStorage, Space {}

const StorageContext = React.createContext<Context>({
  totalSpace: 0,
  usedSpace: 0,
  persisted: false,
  persist: () => new Promise((resolve) => resolve()),
  setLocalItem: () => new Promise((resolve) => resolve()),
  getLocalItem: () => null,
  fileKeys: [],
  getFile: () => new Promise((resolve) => resolve(undefined)),
  setFile: () => new Promise((resolve) => resolve()),
});

export const StorageContextProvider: React.FC<{
  children: React.ReactElement;
}> = ({ children }) => {
  const [persisted, setPersisted] = React.useState<boolean>(false);
  const [totalSpace, setTotalSpace] = React.useState<number>(0);
  const [usedSpace, setUsedSpace] = React.useState<number>(0);
  const [fileKeys, setFileKeys] = React.useState<Array<string>>([]);

  const persist: () => Promise<void> = () =>
    navigator.storage
      .persist()
      .then(() =>
        navigator.storage
          .persisted()
          .then((persisted) => setPersisted(persisted))
      );

  const checkSpace: () => Promise<void> = () =>
    navigator.storage.estimate().then((estimate) => {
      setTotalSpace(estimate.quota ?? 0);
      setUsedSpace(estimate.usage ?? 0);
    });

  // Declared after checkSpace/persist rather than at the top of the component:
  // reaching backwards to a `const` defined further down works only because
  // effects run after render, and would break the moment this needs to run
  // any earlier.
  React.useEffect(() => {
    void checkSpace();
    getGmeKeys().then((keys) => setFileKeys(keys));
    navigator.storage.persisted().then((persisted) => setPersisted(persisted));
  }, []);

  const setLocalItem = async (key: string, value: string) => {
    !persisted && (await persist());
    window.localStorage.setItem(key, value);
    await checkSpace();
  };

  const getLocalItem = (key: string): string | null =>
    window.localStorage.getItem(key);

  const getFile = React.useCallback((key: string) => getGme(key), []);

  const setFile = async (key: string, value: SavedProduct) => {
    !persisted && (await persist());
    await setGme(key, value);
    await checkSpace();
    getGmeKeys().then((keys) => setFileKeys(keys));
  };

  return (
    <StorageContext.Provider
      value={{
        totalSpace,
        usedSpace,
        persisted,
        persist,
        setLocalItem,
        getLocalItem,
        fileKeys,
        getFile,
        setFile,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
};

export const useGmeFileStore = (): Files => {
  const { fileKeys, getFile, setFile } = React.useContext(StorageContext);
  return { fileKeys, getFile, setFile };
};

export const usePersistedSpace = (): Space => {
  const { usedSpace, totalSpace, persisted, persist } =
    React.useContext(StorageContext);

  return { usedSpace, totalSpace, persisted, persist };
};

export const useLocalStorage = (): LocalStorage => {
  const { setLocalItem, getLocalItem } = React.useContext(StorageContext);
  return { setLocalItem, getLocalItem };
};
