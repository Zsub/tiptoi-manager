import Cookies from 'cookies-ts';
import React from 'react';
import { IntlProvider } from 'react-intl';

import { COOKIE_NAME, MESSAGES } from './constants.ts';
import { Language } from './types.ts';

const cookies = new Cookies();

const IntlContext = React.createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
  languages: Array<Language>;
}>({
  language: Object.keys(MESSAGES)[0],
  setLanguage: () => {},
  languages: Object.keys(MESSAGES),
});

export const IntlContextProvider: React.FC<{
  children: React.ReactElement;
}> = ({ children }) => {
  // Read the persisted language in the initialiser rather than an effect, so
  // the first paint is already in the right language instead of rendering the
  // default and immediately re-rendering over it.
  const [language, setLanguage] = React.useState<string>(
    () => cookies.get(COOKIE_NAME) || Object.keys(MESSAGES)[0]
  );

  const messages = React.useMemo<Record<string, string>>(
    () => MESSAGES[language],
    [language]
  );

  return (
    <IntlContext.Provider
      value={{
        language,
        setLanguage: (language) => {
          cookies.set(COOKIE_NAME, language);
          setLanguage(language);
        },
        languages: Object.keys(MESSAGES),
      }}
    >
      <IntlProvider locale={language} messages={messages}>
        {children}
      </IntlProvider>
    </IntlContext.Provider>
  );
};

export const useIntlContext = () => React.useContext(IntlContext);
