import { FORMATS, isOutputFormat, normalizeFormat } from "./constants.js";

export const SETTINGS_STORAGE_KEY = "imageConverterSettings";

export const DEFAULT_SETTINGS = Object.freeze({
  defaultFormat: FORMATS.PNG,
  jpgQuality: 0.92,
  webpQuality: 0.9,
  jpgBackgroundColor: "#FFFFFF",
  askWhereToSave: true,
  skipRedundantConversion: false,
  preserveDimensions: true
});

const MIN_QUALITY = 0.1;
const MAX_QUALITY = 1;

export function clampQuality(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(MAX_QUALITY, Math.max(MIN_QUALITY, Number(number.toFixed(2))));
}

export function normalizeHexColor(value, fallback = DEFAULT_SETTINGS.jpgBackgroundColor) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  const shortMatch = trimmed.match(/^#?([0-9a-fA-F]{3})$/);
  if (shortMatch) {
    const expanded = shortMatch[1]
      .split("")
      .map((character) => character + character)
      .join("");
    return `#${expanded.toUpperCase()}`;
  }

  const fullMatch = trimmed.match(/^#?([0-9a-fA-F]{6})$/);
  if (fullMatch) {
    return `#${fullMatch[1].toUpperCase()}`;
  }

  return fallback;
}

export function normalizeSettings(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const defaultFormat = normalizeFormat(source.defaultFormat);

  return {
    defaultFormat: isOutputFormat(defaultFormat) ? defaultFormat : DEFAULT_SETTINGS.defaultFormat,
    jpgQuality: clampQuality(source.jpgQuality, DEFAULT_SETTINGS.jpgQuality),
    webpQuality: clampQuality(source.webpQuality, DEFAULT_SETTINGS.webpQuality),
    jpgBackgroundColor: normalizeHexColor(source.jpgBackgroundColor),
    askWhereToSave: true,
    skipRedundantConversion: Boolean(source.skipRedundantConversion),
    preserveDimensions:
      typeof source.preserveDimensions === "boolean"
        ? source.preserveDimensions
        : DEFAULT_SETTINGS.preserveDimensions
  };
}

export async function readSettings(storageArea = chrome.storage.sync) {
  const stored = await storageArea.get(SETTINGS_STORAGE_KEY);
  return normalizeSettings(stored[SETTINGS_STORAGE_KEY]);
}

export async function writeSettings(settings, storageArea = chrome.storage.sync) {
  const normalized = normalizeSettings(settings);
  await storageArea.set({ [SETTINGS_STORAGE_KEY]: normalized });
  return normalized;
}

export async function resetSettings(storageArea = chrome.storage.sync) {
  await storageArea.set({ [SETTINGS_STORAGE_KEY]: { ...DEFAULT_SETTINGS } });
  return { ...DEFAULT_SETTINGS };
}
