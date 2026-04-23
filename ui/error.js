const params = new URLSearchParams(location.search);

document.querySelector("#message").textContent =
  params.get("message") || "The image could not be converted.";
document.querySelector("#code").textContent = params.get("code") || "unknown_error";
document.querySelector("#target").textContent = params.get("target") || "Unknown";
document.querySelector("#source-format").textContent = params.get("sourceFormat") || "Unknown";
document.querySelector("#source-url").textContent = params.get("sourceUrl") || "Not available";

document.querySelector("#open-options").addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});

document.querySelector("#close-page").addEventListener("click", () => {
  window.close();
});
