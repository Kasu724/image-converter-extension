import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SETTINGS,
  clampQuality,
  normalizeHexColor,
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

test("drops invalid formats while preserving booleans", () => {
  const normalized = normalizeSettings({
    defaultFormat: "gif",
    askWhereToSave: false,
    skipRedundantConversion: true,
    preserveDimensions: false
  });

  assert.equal(normalized.defaultFormat, DEFAULT_SETTINGS.defaultFormat);
  assert.equal(normalized.askWhereToSave, true);
  assert.equal(normalized.skipRedundantConversion, true);
  assert.equal(normalized.preserveDimensions, false);
});
