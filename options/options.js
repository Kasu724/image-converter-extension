import { DEFAULT_SETTINGS, normalizeHexColor, normalizeSettings, readSettings, resetSettings, writeSettings } from "../shared/settings.js";

const form = document.querySelector("#settings-form");
const defaultFormat = document.querySelector("#default-format");
const jpgQuality = document.querySelector("#jpg-quality");
const jpgQualityValue = document.querySelector("#jpg-quality-value");
const webpQuality = document.querySelector("#webp-quality");
const webpQualityValue = document.querySelector("#webp-quality-value");
const jpgBackgroundColor = document.querySelector("#jpg-background-color");
const jpgBackgroundText = document.querySelector("#jpg-background-text");
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
  jpgQuality.addEventListener("input", updateQualityOutputs);
  webpQuality.addEventListener("input", updateQualityOutputs);

  jpgBackgroundColor.addEventListener("input", () => {
    jpgBackgroundText.value = jpgBackgroundColor.value.toUpperCase();
  });

  jpgBackgroundText.addEventListener("input", () => {
    const normalized = normalizeHexColor(jpgBackgroundText.value, "");
    if (normalized) {
      jpgBackgroundColor.value = normalized;
    }
  });

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
    askWhereToSave: true,
    skipRedundantConversion: skipRedundantConversion.checked,
    preserveDimensions: preserveDimensions.checked
  });
}

function renderSettings(settings = DEFAULT_SETTINGS) {
  const normalized = normalizeSettings(settings);
  defaultFormat.value = normalized.defaultFormat;
  jpgQuality.value = String(normalized.jpgQuality);
  webpQuality.value = String(normalized.webpQuality);
  jpgBackgroundColor.value = normalized.jpgBackgroundColor;
  jpgBackgroundText.value = normalized.jpgBackgroundColor;
  skipRedundantConversion.checked = normalized.skipRedundantConversion;
  preserveDimensions.checked = normalized.preserveDimensions;
  updateQualityOutputs();
}

function updateQualityOutputs() {
  jpgQualityValue.value = Number(jpgQuality.value).toFixed(2);
  webpQualityValue.value = Number(webpQuality.value).toFixed(2);
}

function setStatus(message, kind = "success") {
  status.textContent = message;
  status.dataset.kind = kind;
}
