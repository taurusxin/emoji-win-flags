importScripts("fonts.js");

const { BUILTIN_FONTS, DEFAULT_SETTINGS } = self.EmojiWinFlagsConfig;

// In-memory cache of base64 font data for CSP fallback requests
const fontBase64Cache = new Map();

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const toSet = {};
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (existing[key] === undefined) {
      toSet[key] = value;
    }
  }
  if (Object.keys(toSet).length > 0) {
    await chrome.storage.local.set(toSet);
  }
});

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function getFontBase64(fontId) {
  if (fontBase64Cache.has(fontId)) {
    return fontBase64Cache.get(fontId);
  }

  const builtin = BUILTIN_FONTS.find((f) => f.id === fontId);
  if (builtin) {
    const res = await fetch(chrome.runtime.getURL(builtin.file));
    if (!res.ok) {
      throw new Error(`Failed to fetch bundled font: ${builtin.file}`);
    }
    const buf = await res.arrayBuffer();
    const b64 = arrayBufferToBase64(buf);
    fontBase64Cache.set(fontId, b64);
    return b64;
  }

  // Custom font stored in chrome.storage.local under `customFontData:<id>`
  const storageKey = `customFontData:${fontId}`;
  const stored = await chrome.storage.local.get(storageKey);
  if (stored[storageKey]) {
    return stored[storageKey];
  }

  throw new Error(`Font not found: ${fontId}`);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === "GET_FONT_BASE64") {
    getFontBase64(message.fontId)
      .then((base64) => sendResponse({ ok: true, base64 }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // keep channel open for async response
  }
});
