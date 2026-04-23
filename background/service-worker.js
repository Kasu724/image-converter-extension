import { FORMATS, formatLabel, isOutputFormat } from "../shared/constants.js";
import { errorFromPayload, ConversionError, serializeError } from "../shared/errors.js";
import { readSettings } from "../shared/settings.js";
import { ERROR_PAGE_PATH, MENU_IDS, MESSAGE_TYPES, OFFSCREEN_DOCUMENT_PATH } from "../shared/messages.js";
import {
  isBlobUrl,
  isDataUrl,
  isHttpUrl,
  truncateForDisplay
} from "../shared/urls.js";

const MENU_TARGET_FORMATS = new Map([
  [MENU_IDS.DOWNLOAD_PNG, FORMATS.PNG],
  [MENU_IDS.DOWNLOAD_JPG, FORMATS.JPG],
  [MENU_IDS.DOWNLOAD_WEBP, FORMATS.WEBP]
]);

const MENU_DEFINITIONS = [
  {
    id: MENU_IDS.DOWNLOAD_PNG,
    title: "Download as PNG"
  },
  {
    id: MENU_IDS.DOWNLOAD_JPG,
    title: "Download as JPG"
  },
  {
    id: MENU_IDS.DOWNLOAD_WEBP,
    title: "Download as WEBP"
  },
  {
    id: MENU_IDS.QUICK_DEFAULT,
    title: "Quick Convert Using Default Format"
  }
];

let menuSetupPromise;
let offscreenSetupPromise;

void setupContextMenus();

chrome.runtime.onInstalled.addListener(() => {
  void setupContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  void setupContextMenus();
});

chrome.action.onClicked.addListener(() => {
  void chrome.runtime.openOptionsPage();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const targetLabel = getTargetLabelForError(info?.menuItemId);

  void handleContextMenuClick(info, tab).catch((error) => {
    console.error("Image conversion failed", error);
    void openErrorPage(error, {
      sourceUrl: info?.srcUrl || "",
      targetLabel
    });
  });
});

async function setupContextMenus() {
  if (menuSetupPromise) {
    return menuSetupPromise;
  }

  menuSetupPromise = (async () => {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
      id: MENU_IDS.PARENT,
      title: "Convert and Download",
      contexts: ["image"]
    });

    for (const item of MENU_DEFINITIONS) {
      chrome.contextMenus.create({
        id: item.id,
        parentId: MENU_IDS.PARENT,
        title: item.title,
        contexts: ["image"]
      });
    }
  })().finally(() => {
    menuSetupPromise = undefined;
  });

  return menuSetupPromise;
}

async function handleContextMenuClick(info, tab) {
  if (!info?.srcUrl) {
    throw new ConversionError(
      "missing_image_url",
      "This image does not expose a usable URL to the extension."
    );
  }

  const settings = await readSettings();
  const targetFormat = getTargetFormat(info.menuItemId, settings.defaultFormat);
  const sourcePayload = await buildSourcePayload(info, tab);

  await ensureOffscreenDocument();

  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.CONVERT_IMAGE,
    payload: {
      ...sourcePayload,
      pageUrl: info.pageUrl || tab?.url || "",
      frameUrl: info.frameUrl || "",
      targetFormat,
      settings
    }
  });

  if (!response?.ok) {
    throw errorFromPayload(response?.error);
  }

  const downloadId = await chrome.downloads.download({
    url: response.dataUrl,
    filename: response.filename,
    saveAs: true,
    conflictAction: "uniquify"
  });

  if (!downloadId && downloadId !== 0) {
    throw new ConversionError(
      "download_failed",
      "Chrome did not start the download. Check your downloads settings and try again."
    );
  }
}

function getTargetLabelForError(menuItemId) {
  if (menuItemId === MENU_IDS.QUICK_DEFAULT) {
    return "Quick default format";
  }

  return formatLabel(MENU_TARGET_FORMATS.get(menuItemId) || "") || "Unknown";
}

function getTargetFormat(menuItemId, defaultFormat) {
  if (menuItemId === MENU_IDS.QUICK_DEFAULT) {
    return defaultFormat;
  }

  const targetFormat = MENU_TARGET_FORMATS.get(menuItemId);
  if (!isOutputFormat(targetFormat)) {
    throw new ConversionError("unknown_menu_action", "That conversion option is not recognized.");
  }

  return targetFormat;
}

async function buildSourcePayload(info, tab) {
  const sourceUrl = info.srcUrl;

  if (isDataUrl(sourceUrl)) {
    return { sourceUrl };
  }

  if (isBlobUrl(sourceUrl)) {
    const blobSource = await fetchBlobUrlFromPage(sourceUrl, info, tab);
    return {
      sourceUrl,
      sourceDataUrl: blobSource.dataUrl,
      sourceMimeType: blobSource.mimeType || "",
      sourceByteLength: blobSource.byteLength || 0
    };
  }

  if (isHttpUrl(sourceUrl)) {
    return { sourceUrl };
  }

  throw new ConversionError(
    "unsupported_url",
    "This image URL uses a scheme the extension cannot fetch locally.",
    { sourceUrl: truncateForDisplay(sourceUrl) }
  );
}

async function fetchBlobUrlFromPage(sourceUrl, info, tab) {
  if (!Number.isInteger(tab?.id)) {
    throw new ConversionError(
      "missing_tab",
      "Blob images can only be converted from an active browser tab."
    );
  }

  const target = { tabId: tab.id };
  if (Number.isInteger(info.frameId) && info.frameId >= 0) {
    target.frameIds = [info.frameId];
  }

  // Blob URLs belong to the page that created them. A one-shot script runs only
  // in the user-clicked tab/frame and returns a data URL to the extension; no
  // persistent content script is installed.
  const results = await chrome.scripting.executeScript({
    target,
    args: [sourceUrl],
    func: async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Could not read blob URL (${response.status}).`);
      }

      const blob = await response.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read the blob image."));
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });

      return {
        dataUrl,
        mimeType: blob.type || "",
        byteLength: blob.size || 0
      };
    }
  });

  const result = results?.[0]?.result;
  if (!result?.dataUrl) {
    throw new ConversionError(
      "blob_read_failed",
      "The page did not return readable blob image data."
    );
  }

  return result;
}

async function ensureOffscreenDocument() {
  if (offscreenSetupPromise) {
    return offscreenSetupPromise;
  }

  offscreenSetupPromise = (async () => {
    const hasDocument = await hasExistingOffscreenDocument();
    if (hasDocument) {
      return;
    }

    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ["BLOBS", "DOM_PARSER"],
      justification:
        "Decode, draw, and encode user-selected images locally with browser canvas APIs."
    });
  })().finally(() => {
    offscreenSetupPromise = undefined;
  });

  return offscreenSetupPromise;
}

async function hasExistingOffscreenDocument() {
  if (typeof chrome.offscreen.hasDocument === "function") {
    return chrome.offscreen.hasDocument();
  }

  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  const clients = await self.clients.matchAll({
    includeUncontrolled: true,
    type: "window"
  });

  return clients.some((client) => client.url === offscreenUrl);
}

async function openErrorPage(error, context = {}) {
  const serialized = serializeError(error);
  const params = new URLSearchParams({
    code: serialized.code,
    message: serialized.message,
    sourceUrl: truncateForDisplay(context.sourceUrl || "", 500),
    target: context.targetLabel || "Unknown",
    sourceFormat: serialized.details?.sourceFormat
      ? formatLabel(serialized.details.sourceFormat)
      : "Not detected"
  });

  try {
    await chrome.tabs.create({
      url: chrome.runtime.getURL(`${ERROR_PAGE_PATH}?${params.toString()}`),
      active: true
    });
  } catch (openError) {
    console.error("Could not open error page", openError, serialized);
  }
}
