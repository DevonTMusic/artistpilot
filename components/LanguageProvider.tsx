"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Locale, translate } from "@/lib/i18n/messages";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("artistpilot-language");
      if (stored === "en" || stored === "es") setLocaleState(stored);
    } catch (error) {
      console.warn("Could not read language preference:", error);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      window.localStorage.setItem("artistpilot-language", locale);
      document.cookie = `artistpilot-language=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch (error) {
      console.warn("Could not save language preference:", error);
    }
  }, [locale]);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    try {
      document.cookie = `artistpilot-language=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
      window.localStorage.setItem("artistpilot-language", next);
    } catch (error) {
      console.warn("Could not save language preference:", error);
    }
    router.refresh();
  };
  return (
    <LanguageContext.Provider value={{ locale, setLocale, t: (key, values) => translate(locale, key, values) }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider.");
  return context;
}
