import assert from "node:assert/strict";
import test from "node:test";

import {
  formatFromExtension,
  formatFromMimeType,
  formatMatches,
  isOutputFormat,
  targetExtensionForFormat,
  targetMimeForFormat
} from "../shared/constants.js";

test("maps output formats to MIME types and extensions", () => {
  assert.equal(targetMimeForFormat("png"), "image/png");
  assert.equal(targetMimeForFormat("jpg"), "image/jpeg");
  assert.equal(targetMimeForFormat("webp"), "image/webp");
  assert.equal(targetExtensionForFormat("jpeg"), "jpg");
});

test("detects common input formats from MIME types and extensions", () => {
  assert.equal(formatFromMimeType("image/jpeg; charset=binary"), "jpg");
  assert.equal(formatFromMimeType("image/svg+xml"), "svg");
  assert.equal(formatFromMimeType("image/apng"), "apng");
  assert.equal(formatFromMimeType("image/avif"), "avif");
  assert.equal(formatFromExtension(".jpeg"), "jpg");
  assert.equal(formatFromExtension("svgz"), "svg");
  assert.equal(formatFromExtension("apng"), "apng");
  assert.equal(formatFromExtension("avif"), "avif");
});

test("validates output formats", () => {
  assert.equal(isOutputFormat("png"), true);
  assert.equal(isOutputFormat("gif"), false);
  assert.equal(formatMatches("jpeg", "jpg"), true);
});
