import { Loader, Notification } from '@theme';
import React from 'react';
import { useIntl } from 'react-intl';

import MyTiptoisProduct from '@app/FileFinder/MyTiptoisProduct.tsx';
import {
  STATE as TIPTOIS_STATE,
  useMyTiptois,
} from '@app/catalog/MyTiptoisContext.tsx';
import { useCatalog } from '@app/catalog/CatalogContext.tsx';
import AvailableSpace from '@app/storage/components/AvailableSpace.tsx';

import cn from '@utils/classnames.ts';

import styles from './MyTiptois.module.css';

const MyTiptois: React.FC<{ className?: '' }> = ({ className = '' }) => {
  const { state, products } = useMyTiptois();
  const { productByGmeFileName } = useCatalog();
  const { formatMessage } = useIntl();

  return (
    <div className={cn(className, styles.root)}>
      {state === TIPTOIS_STATE.LOADING || state === TIPTOIS_STATE.IDLE ? (
        <Loader />
      ) : state === TIPTOIS_STATE.ERROR ? (
        <Notification type="error">
          {formatMessage({ id: '_error' })}
        </Notification>
      ) : (
        <div className={styles.list}>
          {products.map((savedProduct) => {
            const mergedEntry = savedProduct.audioFile?.fileName
              ? productByGmeFileName[savedProduct.audioFile.fileName]?.[0]
              : undefined;

            return (
              <MyTiptoisProduct
                product={savedProduct}
                merged={mergedEntry}
                key={savedProduct.name}
              />
            );
          })}
        </div>
      )}
      <AvailableSpace className={styles.space} />
    </div>
  );
};

export default MyTiptois;
