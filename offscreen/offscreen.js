import { serializeError } from "../shared/errors.js";
import { MESSAGE_TYPES } from "../shared/messages.js";
import { convertImageRequest } from "./image-converter.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== MESSAGE_TYPES.CONVERT_IMAGE) {
    return false;
  }

  void convertImageRequest(message.payload)
    .then((result) => {
      sendResponse({ ok: true, ...result });
    })
    .catch((error) => {
      console.error("Offscreen image conversion failed", error);
      sendResponse({ ok: false, error: serializeError(error) });
    });

  return true;
});
