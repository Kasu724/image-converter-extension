import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SETTINGS,
  DOWNLOAD_MODES,
  clampQuality,
  MAX_RESIZE_DIMENSION,
  normalizeHexColor,
  normalizeResizeDimension,
  normalizeSettings
} from "../shared/settings.js";

test("normalizes settings with defaults", () => {
  assert.deepEqual(normalizeSettings({}), DEFAULT_SETTINGS);
});

test("clamps quality values", () => {
  assert.equal(clampQuality(2, 0.9), 1);
  assert.equal(clampQuality(0.01, 0.9), 0.1);
  assert.equal(clampQuality("0.456", 0.9), 0.46);
  assert.equal(clampQuality("bad", 0.9), 0.9);
});

test("normalizes colors", () => {
  assert.equal(normalizeHexColor("#fff"), "#FFFFFF");
  assert.equal(normalizeHexColor("0d6b57"), "#0D6B57");
  assert.equal(normalizeHexColor("not-a-color"), "#FFFFFF");
});

test("normalizes resize dimensions", () => {
  assert.equal(normalizeResizeDimension(""), null);
  assert.equal(normalizeResizeDimension("bad"), null);
  assert.equal(normalizeResizeDimension("1200.4"), 1200);
  assert.equal(normalizeResizeDimension(-1), null);
  assert.equal(normalizeResizeDimension(MAX_RESIZE_DIMENSION + 1000), MAX_RESIZE_DIMENSION);
});

test("drops invalid formats while preserving booleans", () => {
  const normalized = normalizeSettings({
    defaultFormat: "gif",
    askWhereToSave: false,
    skipRedundantConversion: true,
    preserveDimensions: false,
    resizeWidth: "1440",
    resizeHeight: "810"
  });

  assert.equal(normalized.defaultFormat, DEFAULT_SETTINGS.defaultFormat);
  assert.equal(normalized.askWhereToSave, false);
  assert.equal(normalized.downloadMode, DOWNLOAD_MODES.AUTO);
  assert.equal(normalized.skipRedundantConversion, true);
  assert.equal(normalized.preserveDimensions, false);
  assert.equal(normalized.resizeWidth, 1440);
  assert.equal(normalized.resizeHeight, 810);
});
