import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveDownloadFilename,
  extractFilenameFromUrl,
  formatTimestamp,
  parseContentDispositionFilename,
  replaceExtension,
  sanitizeFilename
} from "../shared/filenames.js";

test("sanitizes filenames for common filesystems", () => {
  assert.equal(sanitizeFilename('bad:name*with?chars.png'), "bad-name-with-chars.png");
  assert.equal(sanitizeFilename("  .hidden.  "), "hidden");
  assert.equal(sanitizeFilename("CON"), "image");
});

test("replaces existing extensions", () => {
  assert.equal(replaceExtension("photo.large.jpeg", "png"), "photo.large.png");
  assert.equal(replaceExtension("download", ".webp"), "download.webp");
});

test("extracts filenames from URLs without query strings or fragments", () => {
  assert.equal(
    extractFilenameFromUrl("https://example.com/assets/cat%20photo.jpg?width=600#preview"),
    "cat photo.jpg"
  );
  assert.equal(extractFilenameFromUrl("data:image/png;base64,AAAA"), "");
  assert.equal(extractFilenameFromUrl("blob:https://example.com/uuid"), "");
});

test("parses content disposition filenames", () => {
  assert.equal(parseContentDispositionFilename('attachment; filename="poster.webp"'), "poster.webp");
  assert.equal(
    parseContentDispositionFilename("attachment; filename*=UTF-8''cat%20poster.png"),
    "cat poster.png"
  );
});

test("derives fallback filenames from host and timestamp", () => {
  const now = new Date(Date.UTC(2026, 3, 23, 5, 6, 7));
  assert.equal(formatTimestamp(now), "20260423-050607");
  assert.equal(
    deriveDownloadFilename({
      sourceUrl: "https://images.example.com/",
      targetExtension: "jpg",
      now
    }),
    "images.example.com-20260423-050607.jpg"
  );
});
