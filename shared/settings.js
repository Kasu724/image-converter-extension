import { FORMATS, isOutputFormat, normalizeFormat } from "./constants.js";

export const SETTINGS_STORAGE_KEY = "imageConverterSettings";
export const DOWNLOAD_MODES = Object.freeze({
  PROMPT: "prompt",
  AUTO: "auto"
});

export const MAX_RESIZE_DIMENSION = 32768;

export const DEFAULT_SETTINGS = Object.freeze({
  defaultFormat: FORMATS.PNG,
  jpgQuality: 0.9,
  webpQuality: 0.9,
  jpgBackgroundColor: "#FFFFFF",
  askWhereToSave: true,
  downloadMode: DOWNLOAD_MODES.PROMPT,
  skipRedundantConversion: false,
  preserveDimensions: true,
  resizeWidth: null,
  resizeHeight: null
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

export function normalizeResizeDimension(value) {
  if (value === "" || value === null || typeof value === "undefined") {
    return null;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }

  const rounded = Math.round(number);
  if (rounded <= 0) {
    return null;
  }

  return Math.min(MAX_RESIZE_DIMENSION, rounded);
}

export function normalizeSettings(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const defaultFormat = normalizeFormat(source.defaultFormat);
  const downloadMode =
    source.downloadMode === DOWNLOAD_MODES.AUTO || source.downloadMode === DOWNLOAD_MODES.PROMPT
      ? source.downloadMode
      : source.askWhereToSave === false
        ? DOWNLOAD_MODES.AUTO
        : DOWNLOAD_MODES.PROMPT;

  return {
    defaultFormat: isOutputFormat(defaultFormat) ? defaultFormat : DEFAULT_SETTINGS.defaultFormat,
    jpgQuality: clampQuality(source.jpgQuality, DEFAULT_SETTINGS.jpgQuality),
    webpQuality: clampQuality(source.webpQuality, DEFAULT_SETTINGS.webpQuality),
    jpgBackgroundColor: normalizeHexColor(source.jpgBackgroundColor),
    askWhereToSave: downloadMode === DOWNLOAD_MODES.PROMPT,
    downloadMode,
    skipRedundantConversion: Boolean(source.skipRedundantConversion),
    preserveDimensions:
      typeof source.preserveDimensions === "boolean"
        ? source.preserveDimensions
        : DEFAULT_SETTINGS.preserveDimensions,
    resizeWidth: normalizeResizeDimension(source.resizeWidth),
    resizeHeight: normalizeResizeDimension(source.resizeHeight)
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
