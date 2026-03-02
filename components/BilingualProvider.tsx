"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

type Locale = "en" | "es";

interface BilingualContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  translations: Record<string, Record<string, string>>;
  t: (category: string, key: string) => string;
  isLoading: boolean;
}

const BilingualContext = createContext<BilingualContextType | undefined>(undefined);

export function BilingualProvider({ 
  children, 
  userId 
}: { 
  children: ReactNode;
  userId?: string;
}) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [translations, setTranslations] = useState<Record<string, Record<string, string>>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Get translations from server
  const serverTranslations = useQuery(
    api.i18n.getAllTranslations,
    locale ? { locale } : "skip"
  );

  // Set user locale mutation
  const setUserLocale = useMutation(api.i18n.setUserLocale);

  // Load user preference on mount
  useEffect(() => {
    if (userId) {
      // In production, fetch user preference from server
      try {
        const savedLocale = localStorage.getItem("taxwise_locale") as Locale;
        if (savedLocale && ["en", "es"].includes(savedLocale)) {
          setLocaleState(savedLocale);
        }
      } catch {
        // localStorage can throw in private browsing or when quota exceeded
        // Fall back to default locale
      }
    }
  }, [userId]);

  // Update translations when locale changes
  useEffect(() => {
    if (serverTranslations) {
      setTranslations(serverTranslations);
      setIsLoading(false);
    }
  }, [serverTranslations]);

  // Translation function
  const t = (category: string, key: string): string => {
    return translations[category]?.[key] || key;
  };

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem("taxwise_locale", newLocale);
    } catch {
      // localStorage can throw in private browsing or when quota exceeded
      // Continue anyway - locale state is still in memory
    }
    if (userId) {
      // Cast userId to the expected type for Convex
      setUserLocale({ userId: userId as any, locale: newLocale });
    }
  };

  return (
    <BilingualContext.Provider value={{ locale, setLocale, translations, t, isLoading }}>
      {children}
    </BilingualContext.Provider>
  );
}

export function useBilingual() {
  const context = useContext(BilingualContext);
  if (context === undefined) {
    throw new Error("useBilingual must be used within a BilingualProvider");
  }
  return context;
}

// Language Toggle Component
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useBilingual();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={() => setLocale("en")}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          locale === "en"
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLocale("es")}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          locale === "es"
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
      >
        ES
      </button>
    </div>
  );
}
