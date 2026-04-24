import {
  DEFAULT_SETTINGS,
  DOWNLOAD_MODES,
  normalizeHexColor,
  normalizeSettings,
  readSettings,
  resetSettings,
  writeSettings
} from "../shared/settings.js";

const form = document.querySelector("#settings-form");
const defaultFormat = document.querySelector("#default-format");
const jpgQuality = document.querySelector("#jpg-quality");
const jpgQualityInput = document.querySelector("#jpg-quality-input");
const webpQuality = document.querySelector("#webp-quality");
const webpQualityInput = document.querySelector("#webp-quality-input");
const jpgBackgroundColor = document.querySelector("#jpg-background-color");
const jpgBackgroundText = document.querySelector("#jpg-background-text");
const downloadModePrompt = document.querySelector("#download-mode-prompt");
const downloadModeAuto = document.querySelector("#download-mode-auto");
const skipRedundantConversion = document.querySelector("#skip-redundant-conversion");
const preserveDimensions = document.querySelector("#preserve-dimensions");
const resetButton = document.querySelector("#reset-button");
const status = document.querySelector("#status");

void initialize();

async function initialize() {
  try {
    renderSettings(await readSettings());
    bindEvents();
  } catch (error) {
    setStatus(`Could not load settings: ${error.message}`, "error");
  }
}

function bindEvents() {
  bindQualityControl(jpgQuality, jpgQualityInput);
  bindQualityControl(webpQuality, webpQualityInput);

  jpgBackgroundColor.addEventListener("input", () => {
    jpgBackgroundText.value = jpgBackgroundColor.value.toUpperCase();
  });

  jpgBackgroundText.addEventListener("input", () => {
    const normalized = normalizeHexColor(jpgBackgroundText.value, "");
    if (normalized) {
      jpgBackgroundColor.value = normalized;
    }
  });

  downloadModePrompt.addEventListener("change", updateDownloadModeState);
  downloadModeAuto.addEventListener("change", updateDownloadModeState);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const saved = await writeSettings(collectSettings());
      renderSettings(saved);
      setStatus("Settings saved.");
    } catch (error) {
      setStatus(`Could not save settings: ${error.message}`, "error");
    }
  });

  resetButton.addEventListener("click", async () => {
    try {
      const defaults = await resetSettings();
      renderSettings(defaults);
      setStatus("Settings reset to defaults.");
    } catch (error) {
      setStatus(`Could not reset settings: ${error.message}`, "error");
    }
  });
}

function collectSettings() {
  return normalizeSettings({
    defaultFormat: defaultFormat.value,
    jpgQuality: jpgQuality.value,
    webpQuality: webpQuality.value,
    jpgBackgroundColor: jpgBackgroundText.value || jpgBackgroundColor.value,
    downloadMode: downloadModeAuto.checked ? DOWNLOAD_MODES.AUTO : DOWNLOAD_MODES.PROMPT,
    skipRedundantConversion: skipRedundantConversion.checked,
    preserveDimensions: preserveDimensions.checked
  });
}

function renderSettings(settings = DEFAULT_SETTINGS) {
  const normalized = normalizeSettings(settings);
  defaultFormat.value = normalized.defaultFormat;
  setQualityValue(jpgQuality, jpgQualityInput, normalized.jpgQuality);
  setQualityValue(webpQuality, webpQualityInput, normalized.webpQuality);
  jpgBackgroundColor.value = normalized.jpgBackgroundColor;
  jpgBackgroundText.value = normalized.jpgBackgroundColor;
  downloadModePrompt.checked = normalized.downloadMode === DOWNLOAD_MODES.PROMPT;
  downloadModeAuto.checked = normalized.downloadMode === DOWNLOAD_MODES.AUTO;
  skipRedundantConversion.checked = normalized.skipRedundantConversion;
  preserveDimensions.checked = normalized.preserveDimensions;
  updateDownloadModeState();
}

function bindQualityControl(rangeInput, numberInput) {
  rangeInput.addEventListener("input", () => {
    setQualityValue(rangeInput, numberInput, rangeInput.value);
  });

  numberInput.addEventListener("input", () => {
    if (numberInput.value === "") {
      return;
    }

    setQualityValue(rangeInput, numberInput, numberInput.value);
  });

  numberInput.addEventListener("blur", () => {
    setQualityValue(rangeInput, numberInput, numberInput.value || rangeInput.value);
  });
}

function setQualityValue(rangeInput, numberInput, value) {
  const normalized = Math.min(1, Math.max(0.1, Number(Number(value).toFixed(2))));
  if (!Number.isFinite(normalized)) {
    return;
  }

  rangeInput.value = String(normalized);
  numberInput.value = normalized.toFixed(2);
  updateSliderFill(rangeInput);
}

function updateSliderFill(rangeInput) {
  const min = Number(rangeInput.min || 0);
  const max = Number(rangeInput.max || 1);
  const value = Number(rangeInput.value);
  const percent = ((value - min) / (max - min)) * 100;
  rangeInput.closest(".slider-shell")?.style.setProperty("--fill", `${percent}%`);
}

function updateDownloadModeState() {
  downloadModePrompt.closest(".mode-card")?.classList.toggle("is-selected", downloadModePrompt.checked);
  downloadModeAuto.closest(".mode-card")?.classList.toggle("is-selected", downloadModeAuto.checked);
}

function setStatus(message, kind = "success") {
  status.textContent = message;
  status.dataset.kind = kind;
}
