"use client";

import { useState, useEffect, useCallback } from "react";
import { AppSettings, IngredientType } from "@/types";
import { getDefaultSettings } from "@/lib/calculator";

const STORAGE_KEY = "mfc-batch-settings";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(getDefaultSettings());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings(JSON.parse(raw));
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  const saveSettings = useCallback((next: AppSettings) => {
    setSettings(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const updateBottleSize = useCallback(
    (ingredientName: string, size: number) => {
      saveSettings({
        ...settings,
        ingredientOverrides: {
          ...settings.ingredientOverrides,
          [ingredientName]: {
            ...settings.ingredientOverrides[ingredientName],
            bottleSize: size,
          },
        },
      });
    },
    [settings, saveSettings]
  );

  const updateIngredientType = useCallback(
    (ingredientName: string, type: IngredientType) => {
      saveSettings({
        ...settings,
        ingredientOverrides: {
          ...settings.ingredientOverrides,
          [ingredientName]: {
            ...settings.ingredientOverrides[ingredientName],
            type,
          },
        },
      });
    },
    [settings, saveSettings]
  );

  return { settings, loaded, updateBottleSize, updateIngredientType, saveSettings };
}
