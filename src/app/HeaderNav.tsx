import { Button, PortalBox } from '@theme';
import React from 'react';

import { useCatalog } from '@app/catalog/CatalogContext.tsx';
import {
  DEFAULT_LOCALE,
  LANGUAGES,
  isAvailableLocale,
} from '@app/catalog/languages.ts';

import cn from '@utils/classnames';
import { appTitle } from '@utils/constants';

import styles from './HeaderNav.module.css';

type Menu = 'credits' | 'legal';

const NAVIGATION: Record<Menu, string> = {
  legal: 'legal',
  credits: 'credits',
};

const HeaderNav = ({ className = '' }: { className?: string }) => {
  const { selectedLanguages, setSelectedLanguages } = useCatalog();
  const [activeBox, setActiveBox] = React.useState<Menu>(null);

  return (
    <React.Fragment>
      <nav className={cn(className, styles.root)}>
        {Object.entries(NAVIGATION).map(([key, title]) => (
          <Button
            className={cn(styles.element)}
            onClick={() => setActiveBox(key as Menu)}
            color="black"
            layout="ghost"
            key={key}
          >
            {title}
          </Button>
        ))}
        <label className={styles.catalogLanguage}>
          <span className={styles.label}>Catalog Language</span>
          <select
            value={selectedLanguages[0] || DEFAULT_LOCALE}
            onChange={(e) => {
              const value = e.target.value;
              isAvailableLocale(value) && setSelectedLanguages([value]);
            }}
            className={styles.select}
          >
            {/* Unavailable locales stay visible but disabled: hiding them
                invites someone to "fix" it later by re-adding a broken
                option. `en_GB` returns an empty catalog upstream. */}
            {LANGUAGES.map(({ code, label, available }) => (
              <option value={code} key={code} disabled={!available}>
                {available ? label : `${label} (unavailable)`}
              </option>
            ))}
          </select>
        </label>
        {activeBox === 'credits' && (
          <PortalBox close={() => setActiveBox(null)} title="Credits">
            <div className={styles.content}>
              <p>
                <b>{appTitle}</b> is a project by Nico Martin:{' '}
                <a
                  href="https://nico.dev"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  https://nico.dev
                </a>
              </p>
              <h2>Fonts</h2>
              <ul>
                <li>
                  App:{' '}
                  <a
                    rel="noreferrer noopener"
                    href="https://fonts.google.com/specimen/Roboto"
                    target="_blank"
                  >
                    Roboto
                  </a>{' '}
                  by{' '}
                  <a
                    href="https://fonts.google.com/?query=Christian+Robertson"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Christian Robertson (Google Fonts)
                  </a>
                </li>
              </ul>

              <h2>Dependencies</h2>

              <p>
                <a href="https://github.com/nico-martin/tiptoi-manager/blob/main/package.json">
                  https://github.com/nico-martin/tiptoi-manager/blob/main/package.json
                </a>
              </p>

              <h2>Open Source</h2>
              <p>
                The directory is publicly available on GitHub and is{' '}
                <a
                  href="https://github.com/nico-martin/tiptoi-manager/blob/main/LICENSE"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  licensed under an open source license
                </a>
                . Just like most of my projects.
              </p>
              <p>
                <a href="https://github.com/nico-martin/tiptoi-manager/">
                  https://github.com/nico-martin/tiptoi-manager/
                </a>
              </p>
            </div>
          </PortalBox>
        )}
        {activeBox === 'legal' && (
          <PortalBox close={() => setActiveBox(null)} title="Legal">
            <div className={styles.content}>
              <h2>Privacy</h2>
              <p>
                This website does not collect any personal data besides what is
                technically required.
              </p>
              <h2>Contact</h2>
              <p>
                <strong>Nico Martin</strong>
                <br />
                Say Hello GmbH
                <br />
                Thunstrasse 4<br />
                CH-3700 Spiez
                <br />
                Switzerland
              </p>
              <p>
                <a href="mailto:nico@sayhello.ch">nico@sayhello.ch</a>
              </p>
            </div>
          </PortalBox>
        )}
      </nav>
    </React.Fragment>
  );
};

export default HeaderNav;
