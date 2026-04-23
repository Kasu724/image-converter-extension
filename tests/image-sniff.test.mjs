import assert from "node:assert/strict";
import test from "node:test";

import { detectSourceFormat, sniffImageFormat } from "../offscreen/image-converter.js";

test("sniffs WEBP bytes even when the URL looks like JPG", async () => {
  const webpHeader = new Uint8Array([
    0x52, 0x49, 0x46, 0x46,
    0x1a, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x20
  ]);
  const blob = new Blob([webpHeader], { type: "image/jpeg" });

  assert.equal(await sniffImageFormat(blob), "webp");
  assert.equal(
    await detectSourceFormat({
      blob,
      mimeType: "image/jpeg",
      sourceUrl: "https://example.com/photo.jpg"
    }),
    "webp"
  );
});

test("sniffs JPG and PNG signatures", async () => {
  assert.equal(
    await sniffImageFormat(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])])),
    "jpg"
  );
  assert.equal(
    await sniffImageFormat(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])])),
    "png"
  );
});

test("sniffs AVIF bytes even when the URL looks like JPG", async () => {
  const avifHeader = new Uint8Array([
    0x00, 0x00, 0x00, 0x20,
    0x66, 0x74, 0x79, 0x70,
    0x61, 0x76, 0x69, 0x66,
    0x00, 0x00, 0x00, 0x00,
    0x6d, 0x69, 0x66, 0x31,
    0x61, 0x76, 0x69, 0x66
  ]);
  const blob = new Blob([avifHeader], { type: "image/jpeg" });

  assert.equal(await sniffImageFormat(blob), "avif");
  assert.equal(
    await detectSourceFormat({
      blob,
      mimeType: "image/jpeg",
      sourceUrl: "https://example.com/photo.jpg"
    }),
    "avif"
  );
});
