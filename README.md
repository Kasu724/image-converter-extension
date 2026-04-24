# Image Converter and Downloader

A Manifest V3 browser extension for Chromium-based browsers. Right-click an image on a web page, choose **Convert and Download**, and save it as PNG, JPG, or WEBP. All fetching, decoding, conversion, and downloading happens locally in your browser. There is no backend, cloud service, or external API.

## Features

- Image-only context menu grouped under **Convert and Download**.
- Menu actions for **Download as PNG**, **Download as JPG**, **Download as WEBP**, and **Quick Convert Using Default Format**.
- Detects the real source format from image bytes after the user chooses a conversion action, so CDN URLs such as `.jpg` that serve WEBP or AVIF are handled correctly.
- Client-side conversion through an MV3 offscreen document and canvas.
- Supports common web inputs: PNG, JPG/JPEG, WEBP, GIF, SVG, AVIF when the browser can decode it, and many browser-decodable image responses.
- Outputs PNG, JPG, and WEBP.
- Converts animated GIF, animated WEBP, and APNG from the first frame
- Flattens transparent images onto a configurable JPG background color.
- Preserves source dimensions by default.
- Preserves the original filename stem where possible, strips query strings/fragments, sanitizes filesystem-unsafe names, and falls back to hostname plus timestamp.
- Declared host access for HTTP/HTTPS images so Chromium does not interrupt each conversion with a runtime permission popup.
- Options page backed by `chrome.storage.sync`.
- Local error page with useful failure details.

## Architecture

- `manifest.json`: MV3 extension declaration with extension API permissions and HTTP/HTTPS host access for local image fetching.
- `background/service-worker.js`: Creates context menus, handles `blob:` fallback via a one-shot active-tab script, creates the offscreen document, and downloads either through the browser save dialog or directly into the browser's Downloads folder.
- `offscreen/offscreen.html` and `offscreen/offscreen.js`: Hidden extension document used only for DOM/canvas-capable image conversion.
- `offscreen/image-converter.js`: Fetches image bytes, detects source format, decodes raster/SVG sources, draws the first frame to canvas, flattens transparency for JPG, encodes output, and returns a data URL to the service worker.
- `shared/*.js`: Pure utilities for MIME/extension mappings, filename parsing/sanitization, settings validation, URL helpers, message constants, and error serialization.
- `options/*`: Accessible settings UI using `chrome.storage.sync`.
- `ui/error.*`: Local failure page opened when conversion or download fails.

## Permissions

Permanent permissions:

- `contextMenus`: Adds image-only right-click menu items.
- `downloads`: Saves the converted image locally.
- `storage`: Stores user preferences in `chrome.storage.sync`.
- `offscreen`: Creates the hidden document required for canvas decoding/encoding in MV3.
- `activeTab`: Grants temporary access after the user explicitly clicks the extension context menu.
- `scripting`: Used only for `blob:` image URLs, where the page that created the blob must read it. The extension injects a one-shot function into the clicked tab/frame and does not install persistent content scripts.

Host permissions:

- `http://*/*` and `https://*/*` allow the extension-origin fetch to read the user-selected image bytes for local conversion.
- This avoids Chromium's runtime "additional permissions" prompt during each conversion.
- The extension still fetches only the image URL selected from the context menu. It does not crawl pages or send image data anywhere.

Privacy model:

- No remote requests are made except fetching the image URL the user clicked.
- Image bytes are not uploaded, logged remotely, or shared with any service.
- Conversion happens locally with browser APIs: `fetch`, image decoding, canvas, `toBlob`, and `chrome.downloads`.

## Options

Open the extension options page from the toolbar icon or the browser extensions page. You can configure:

- Default output format for quick convert.
- JPG quality from `0.1` to `1.0`.
- WEBP quality from `0.1` to `1.0`.
- JPG background color for transparent images.
- Whether to show the browser save dialog or download automatically.
- Whether to skip re-encoding when the source already matches the target format.
- Whether to preserve original dimensions. v1 preserves dimensions; this setting is stored for future resize controls.
- Reset to defaults.

## Local Development

Prerequisites:

- Node.js 20 or newer for utility tests.
- PowerShell for the included icon generation and packaging scripts.
- Chrome, Edge, Brave, Opera GX, or another Chromium-based browser with Manifest V3 support.

Install or refresh generated icons:

```powershell
npm run generate:icons
```

Run tests:

```powershell
npm test
```

Package a zip for distribution:

```powershell
npm run package
```

The packaged extension is written to `dist/image-converter-extension.zip`.

## Load Unpacked In Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. Right-click an image on a web page and open **Convert and Download**.

After editing extension files, click **Reload** on the extension card in `chrome://extensions`.

## Testing In Other Chromium Browsers

- Edge: open `edge://extensions`, enable developer mode, and load the unpacked folder.
- Brave: open `brave://extensions`, enable developer mode, and load the unpacked folder.
- Opera GX: open `opera://extensions`, enable developer mode, and load the unpacked folder.

The extension uses Chromium extension APIs, so behavior should match Chrome closely. Browser download prompts and permission UI may look different.

## Manual Test Cases

- Right-click PNG, JPG, WEBP, GIF, and SVG images and verify all context menu children appear only on images.
- Convert PNG with transparency to JPG and verify transparent areas use the configured background color.
- Convert a GIF and verify only the first frame is saved.
- Convert an SVG with explicit dimensions and an SVG with only a `viewBox`.
- Convert an image URL with query strings and fragments and verify the saved filename is clean.
- Verify prompt mode opens the browser save dialog before downloading.
- Verify automatic mode saves directly into the browser's Downloads folder.
- Enable **Skip re-encoding when the source already matches the target format** and verify same-format downloads still save.
- Try a `data:` image and a `blob:` image.
- Verify WEBP or AVIF images served from `.jpg` CDN URLs still convert correctly instead of being treated as JPG.
- Try a very large image and verify the extension fails safely instead of hanging indefinitely.

## Automated Tests

The test suite covers pure utility behavior:

- MIME and extension mapping.
- Filename sanitization, extension replacement, URL filename extraction, content-disposition parsing, and fallback names.
- Settings defaults, validation, quality clamping, and color normalization.

Browser integration tests are intentionally not included in v1 because reliable context-menu, permission-prompt, offscreen-document, and downloads automation requires heavier browser-driver setup. The manual test list above covers those integration surfaces.

## Known Limitations

- Animated GIF, animated WEBP, and APNG output only the first frame in v1.
- Very large images are limited by browser memory and canvas size constraints.
- Some sites block image reuse or require request headers that extension fetches cannot reproduce.
- Chromium does not expose reliable image response bytes before a menu item is clicked, so the extension does not display a pre-click "current format" label. Exact byte-level detection happens after a conversion action is clicked.
- SVGs that reference external resources may fail canvas export because the browser can mark the canvas unsafe.
- Metadata such as EXIF, ICC profiles, and original compression parameters are not preserved.
- Data URLs and converted outputs are passed through extension messaging as data URLs, which is simple and reliable for normal images but not ideal for extremely large files.

## Roadmap

- Resize before download.
- Batch conversion from selected images.
- Custom filename templates.
- AVIF output when browser support and extension ergonomics are practical.
- Best-effort metadata preservation.
- Better animated image support.
- Progress UI for large images.

## Notes On Icons

Chromium manifest icons are PNG files in this project. The `scripts/generate-icons.ps1` script creates deterministic placeholder icons at 16, 32, 48, and 128 px.
