import {
  formatFromExtension,
  formatFromMimeType,
  formatMatches,
  isOutputFormat,
  MIME_BY_FORMAT,
  normalizeFormat,
  normalizeMimeType,
  targetExtensionForFormat,
  targetMimeForFormat
} from "../shared/constants.js";
import { ConversionError } from "../shared/errors.js";
import {
  deriveDownloadFilename,
  getFileExtension,
  sourceFormatFromUrl
} from "../shared/filenames.js";
import { normalizeSettings } from "../shared/settings.js";
import { isDataUrl } from "../shared/urls.js";

const MAX_INPUT_BYTES = 150 * 1024 * 1024;
const MAX_CANVAS_PIXELS = 100_000_000;
const DEFAULT_SVG_SIZE = 512;
const FETCH_TIMEOUT_MS = 45_000;

export async function convertImageRequest(payload = {}) {
  const settings = normalizeSettings(payload.settings);
  const targetFormat = normalizeFormat(payload.targetFormat);

  if (!isOutputFormat(targetFormat)) {
    throw new ConversionError("unsupported_output", "Choose PNG, JPG, or WEBP as the output format.");
  }

  const source = await loadSourceBlob(payload);
  const sourceFormat = await detectSourceFormat({
    blob: source.blob,
    mimeType: source.mimeType,
    sourceUrl: payload.sourceUrl
  });
  const targetExtension = targetExtensionForFormat(targetFormat);
  const filename = deriveDownloadFilename({
    sourceUrl: payload.sourceUrl,
    contentDisposition: source.contentDisposition,
    targetExtension
  });

  try {
    if (settings.skipRedundantConversion && formatMatches(sourceFormat, targetFormat)) {
      return {
        dataUrl: await blobToDataUrl(source.blob),
        filename,
        mimeType: source.mimeType || MIME_BY_FORMAT[targetFormat],
        byteLength: source.blob.size,
        width: null,
        height: null,
        sourceFormat,
        skippedRedundant: true
      };
    }

    const converted = await convertBlobToFormat(source.blob, {
      sourceFormat,
      targetFormat,
      settings
    });

    return {
      dataUrl: await blobToDataUrl(converted.blob),
      filename,
      mimeType: converted.blob.type || targetMimeForFormat(targetFormat),
      byteLength: converted.blob.size,
      width: converted.width,
      height: converted.height,
      sourceFormat,
      skippedRedundant: false
    };
  } catch (error) {
    attachSourceFormat(error, sourceFormat);
    throw error;
  }
}

async function loadSourceBlob(payload) {
  if (payload.sourceDataUrl) {
    const blob = await dataUrlToBlob(payload.sourceDataUrl, payload.sourceMimeType);
    assertInputSize(blob);
    return {
      blob,
      mimeType: normalizeMimeType(blob.type || payload.sourceMimeType),
      contentDisposition: ""
    };
  }

  if (!payload.sourceUrl || typeof payload.sourceUrl !== "string") {
    throw new ConversionError("missing_image_url", "The selected image does not have a usable URL.");
  }

  if (isDataUrl(payload.sourceUrl)) {
    const blob = await dataUrlToBlob(payload.sourceUrl);
    assertInputSize(blob);
    return {
      blob,
      mimeType: normalizeMimeType(blob.type),
      contentDisposition: ""
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(payload.sourceUrl, {
      cache: "no-store",
      credentials: "include",
      redirect: "follow",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new ConversionError(
        "fetch_failed",
        `The image request failed with HTTP ${response.status}.`,
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "";
    const contentDisposition = response.headers.get("content-disposition") || "";
    const responseBlob = await response.blob();
    const normalizedType = normalizeMimeType(responseBlob.type || contentType);
    const blob = responseBlob.type ? responseBlob : new Blob([responseBlob], { type: normalizedType });

    assertInputSize(blob);

    return {
      blob,
      mimeType: normalizedType,
      contentDisposition
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new ConversionError(
        "fetch_timeout",
        "Fetching the image took too long. The server may be blocking extension requests."
      );
    }

    if (error instanceof ConversionError) {
      throw error;
    }

    throw new ConversionError(
      "fetch_failed",
      "The extension could not fetch this image. It may require credentials, block downloads, or use an unsupported URL.",
      { message: error?.message || String(error) }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function dataUrlToBlob(dataUrl, fallbackMimeType = "") {
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    if (blob.type || !fallbackMimeType) {
      return blob;
    }

    return new Blob([blob], { type: normalizeMimeType(fallbackMimeType) });
  } catch (error) {
    throw new ConversionError(
      "data_url_decode_failed",
      "The embedded image data could not be decoded.",
      { message: error?.message || String(error) }
    );
  }
}

export async function detectSourceFormat({ blob, mimeType, sourceUrl }) {
  const sniffed = await sniffImageFormat(blob);

  if (sniffed) {
    return sniffed;
  }

  const byMime = formatFromMimeType(mimeType || blob.type);
  if (byMime) {
    return byMime;
  }

  const byUrl = sourceFormatFromUrl(sourceUrl);
  if (byUrl) {
    return byUrl;
  }

  const extension = getFileExtension(sourceUrl || "");
  const byExtension = formatFromExtension(extension);
  if (byExtension) {
    return byExtension;
  }

  return sniffed;
}

export async function sniffImageFormat(blob) {
  const header = new Uint8Array(await blob.slice(0, Math.min(blob.size, 1024 * 1024)).arrayBuffer());
  if (header.length >= 8 && bytesEqual(header, [0x89, 0x50, 0x4e, 0x47], 0)) {
    return pngHeaderHasAnimationControl(header) ? "apng" : "png";
  }

  if (header.length >= 3 && bytesEqual(header, [0xff, 0xd8, 0xff], 0)) {
    return "jpg";
  }

  if (header.length >= 6 && bytesEqual(header, [0x47, 0x49, 0x46], 0)) {
    return "gif";
  }

  if (
    header.length >= 12 &&
    bytesEqual(header, [0x52, 0x49, 0x46, 0x46], 0) &&
    bytesEqual(header, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "webp";
  }

  if (isoBmffHasBrand(header, ["avif", "avis"])) {
    return "avif";
  }

  const textHeader = new TextDecoder("utf-8", { fatal: false }).decode(header).trimStart();
  if (textHeader.startsWith("<svg") || textHeader.startsWith("<?xml")) {
    return "svg";
  }

  return "";
}

function isoBmffHasBrand(bytes, brands) {
  if (
    bytes.length < 16 ||
    !bytesEqual(bytes, [0x66, 0x74, 0x79, 0x70], 4)
  ) {
    return false;
  }

  const brandSet = new Set(brands);
  for (let offset = 8; offset + 4 <= bytes.length; offset += 4) {
    const brand = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );

    if (brandSet.has(brand)) {
      return true;
    }
  }

  return false;
}

function attachSourceFormat(error, sourceFormat) {
  if (!sourceFormat || !error || typeof error !== "object") {
    return;
  }

  error.details = {
    ...(error.details || {}),
    sourceFormat
  };
}

function pngHeaderHasAnimationControl(bytes) {
  let offset = 8;

  while (offset + 12 <= bytes.length) {
    const length =
      bytes[offset] * 0x1000000 +
      bytes[offset + 1] * 0x10000 +
      bytes[offset + 2] * 0x100 +
      bytes[offset + 3];
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );

    if (type === "acTL") {
      return true;
    }

    if (type === "IDAT" || type === "IEND") {
      return false;
    }

    offset += 12 + length;
  }

  return false;
}

function bytesEqual(bytes, expected, offset) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

async function convertBlobToFormat(blob, { sourceFormat, targetFormat, settings }) {
  const decoded =
    sourceFormat === "svg" || normalizeMimeType(blob.type) === "image/svg+xml"
      ? await decodeSvgToCanvas(blob)
      : await decodeRasterToCanvas(blob);

  const exportCanvas =
    targetFormat === "jpg"
      ? flattenCanvasToBackground(decoded.canvas, settings.jpgBackgroundColor)
      : decoded.canvas;

  const mimeType = targetMimeForFormat(targetFormat);
  const quality = targetFormat === "jpg" ? settings.jpgQuality : settings.webpQuality;
  const outputBlob = await canvasToBlob(exportCanvas, mimeType, quality);

  return {
    blob: outputBlob,
    width: decoded.width,
    height: decoded.height
  };
}

async function decodeRasterToCanvas(blob) {
  try {
    const bitmap = await createImageBitmap(blob);
    try {
      return drawImageSourceToCanvas(bitmap, bitmap.width, bitmap.height);
    } finally {
      if (typeof bitmap.close === "function") {
        bitmap.close();
      }
    }
  } catch (bitmapError) {
    try {
      const image = await loadImageElementFromBlob(blob);
      return drawImageSourceToCanvas(image, image.naturalWidth, image.naturalHeight);
    } catch (imageError) {
      throw new ConversionError(
        "decode_failed",
        "The browser could not decode this image. The file may be unsupported, damaged, or protected by the site.",
        {
          createImageBitmap: bitmapError?.message || String(bitmapError),
          imageElement: imageError?.message || String(imageError)
        }
      );
    }
  }
}

async function decodeSvgToCanvas(blob) {
  let svgText;
  try {
    svgText = await blob.text();
  } catch (error) {
    throw new ConversionError("svg_read_failed", "The SVG image could not be read as text.", {
      message: error?.message || String(error)
    });
  }

  const sizedSvg = buildSizedSvg(svgText);
  const svgBlob = new Blob([sizedSvg.text], { type: "image/svg+xml" });

  try {
    const image = await loadImageElementFromBlob(svgBlob);
    return drawImageSourceToCanvas(image, sizedSvg.width, sizedSvg.height);
  } catch (error) {
    throw new ConversionError(
      "svg_decode_failed",
      "The SVG could not be rendered. External resources or malformed SVG markup may be blocking conversion.",
      { message: error?.message || String(error) }
    );
  }
}

function buildSizedSvg(svgText) {
  const document = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const parserError = document.querySelector("parsererror");
  if (parserError) {
    throw new ConversionError("svg_parse_failed", "The SVG markup is malformed.");
  }

  const svg = document.documentElement;
  if (!svg || svg.localName.toLowerCase() !== "svg") {
    throw new ConversionError("svg_parse_failed", "The selected file is not an SVG image.");
  }

  const viewBox = parseViewBox(svg.getAttribute("viewBox"));
  let width = parseSvgLength(svg.getAttribute("width"));
  let height = parseSvgLength(svg.getAttribute("height"));

  if ((!width || !height) && viewBox) {
    width = width || viewBox.width;
    height = height || viewBox.height;
  }

  if (width && !height && viewBox) {
    height = width * (viewBox.height / viewBox.width);
  }

  if (height && !width && viewBox) {
    width = height * (viewBox.width / viewBox.height);
  }

  width = Math.round(width || DEFAULT_SVG_SIZE);
  height = Math.round(height || DEFAULT_SVG_SIZE);
  assertCanvasSize(width, height);

  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  if (!svg.getAttribute("xmlns")) {
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }

  return {
    text: new XMLSerializer().serializeToString(svg),
    width,
    height
  };
}

function parseSvgLength(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.endsWith("%")) {
    return null;
  }

  const match = trimmed.match(/^([+-]?(?:\d+|\d*\.\d+))(px|pt|pc|in|cm|mm)?$/i);
  if (!match) {
    return null;
  }

  const number = Number(match[1]);
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }

  const unit = (match[2] || "px").toLowerCase();
  const multipliers = {
    px: 1,
    in: 96,
    cm: 96 / 2.54,
    mm: 96 / 25.4,
    pt: 96 / 72,
    pc: 16
  };

  return number * (multipliers[unit] || 1);
}

function parseViewBox(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const parts = value
    .trim()
    .split(/[\s,]+/)
    .map(Number);

  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  const width = Math.abs(parts[2]);
  const height = Math.abs(parts[3]);
  if (!width || !height) {
    return null;
  }

  return { width, height };
}

async function loadImageElementFromBlob(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    const loadPromise = new Promise((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("The image element failed to load."));
    });
    image.src = url;
    return await loadPromise;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawImageSourceToCanvas(source, width, height) {
  const normalizedWidth = Math.round(width);
  const normalizedHeight = Math.round(height);
  assertCanvasSize(normalizedWidth, normalizedHeight);

  const canvas = createCanvas(normalizedWidth, normalizedHeight);
  const context = get2dContext(canvas);
  context.clearRect(0, 0, normalizedWidth, normalizedHeight);
  context.drawImage(source, 0, 0, normalizedWidth, normalizedHeight);

  return {
    canvas,
    width: normalizedWidth,
    height: normalizedHeight
  };
}

function flattenCanvasToBackground(sourceCanvas, backgroundColor) {
  const canvas = createCanvas(sourceCanvas.width, sourceCanvas.height);
  const context = get2dContext(canvas);
  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(sourceCanvas, 0, 0);
  return canvas;
}

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function get2dContext(canvas) {
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    throw new ConversionError("canvas_unavailable", "Canvas 2D rendering is not available.");
  }

  return context;
}

async function canvasToBlob(canvas, mimeType, quality) {
  try {
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, mimeType, quality);
    });

    if (!blob) {
      throw new ConversionError(
        "encoding_failed",
        `The browser could not encode the image as ${mimeType}.`
      );
    }

    return blob;
  } catch (error) {
    if (error instanceof ConversionError) {
      throw error;
    }

    throw new ConversionError(
      "encoding_failed",
      "The browser could not export the canvas. Cross-origin SVG resources can cause this.",
      { message: error?.message || String(error) }
    );
  }
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new ConversionError("blob_read_failed", "The converted image could not be read."));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function assertInputSize(blob) {
  if (blob.size > MAX_INPUT_BYTES) {
    throw new ConversionError(
      "image_too_large",
      "This image is too large to convert safely in the browser.",
      { maxBytes: MAX_INPUT_BYTES, actualBytes: blob.size }
    );
  }
}

function assertCanvasSize(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new ConversionError(
      "invalid_dimensions",
      "The image does not expose valid pixel dimensions."
    );
  }

  if (width * height > MAX_CANVAS_PIXELS) {
    throw new ConversionError(
      "image_too_large",
      "This image is too large to draw safely in a browser canvas.",
      { width, height, maxPixels: MAX_CANVAS_PIXELS }
    );
  }
}
