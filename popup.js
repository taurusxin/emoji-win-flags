(function () {
  const {
    FLAG_UNICODE_RANGE,
    BUILTIN_FONTS,
    SUPPORTED_LANGUAGES,
    DEFAULT_SETTINGS
  } = window.EmojiWinFlagsConfig;

  const MAX_CUSTOM_FONT_BYTES = 5 * 1024 * 1024; // 5 MB

  const langPicker = document.getElementById("langPicker");
  const langBtn = document.getElementById("langBtn");
  const langMenu = document.getElementById("langMenu");
  const globalToggle = document.getElementById("globalToggle");
  const previewCard = document.getElementById("previewCard");
  const activeFontName = document.getElementById("activeFontName");
  const previewFlags = document.getElementById("previewFlags");
  const previewSentence = document.getElementById("previewSentence");
  const fontList = document.getElementById("fontList");
  const uploadBtn = document.getElementById("uploadBtn");
  const fontFileInput = document.getElementById("fontFileInput");
  const statusMsg = document.getElementById("statusMsg");
  const siteBar = document.getElementById("siteBar");
  const siteHostEl = document.getElementById("siteHost");
  const siteToggle = document.getElementById("siteToggle");

  let settings = { ...DEFAULT_SETTINGS };
  let activeHost = "";
  let activeMessages = {};
  let activeLocale = "en";
  const localeCache = new Map();
  const loadedPreviewFamilies = new Set();

  function resolveLocale(preferred) {
    const validCodes = new Set(
      SUPPORTED_LANGUAGES.filter((l) => l.code !== "auto").map((l) => l.code)
    );
    if (preferred && preferred !== "auto" && validCodes.has(preferred)) {
      return preferred;
    }

    const raw = (
      (chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) ||
      navigator.language ||
      "en"
    ).toLowerCase();

    if (
      raw.startsWith("zh-tw") ||
      raw.startsWith("zh-hk") ||
      raw.startsWith("zh-mo") ||
      raw.includes("hant")
    ) {
      return "zh_TW";
    }
    if (raw.startsWith("zh")) {
      return "zh_CN";
    }
    if (raw.startsWith("ja")) {
      return "ja";
    }
    return "en";
  }

  async function loadLocaleMessages(locale) {
    if (localeCache.has(locale)) {
      return localeCache.get(locale);
    }
    try {
      const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        localeCache.set(locale, data);
        return data;
      }
    } catch (err) {
      console.warn("[EmojiWinFlags popup] Failed to load locale:", locale, err);
    }
    if (locale !== "en") {
      return loadLocaleMessages("en");
    }
    return {};
  }

  function formatMessageEntry(entry, substitutions) {
    if (!entry || typeof entry.message !== "string") return "";
    let text = entry.message;
    const subs = Array.isArray(substitutions)
      ? substitutions
      : substitutions !== undefined
        ? [substitutions]
        : [];

    if (entry.placeholders && subs.length > 0) {
      for (const [name, def] of Object.entries(entry.placeholders)) {
        const match = typeof def.content === "string" && def.content.match(/^\$(\d+)$/);
        if (match) {
          const idx = Number(match[1]) - 1;
          const replacement = subs[idx] !== undefined ? String(subs[idx]) : "";
          text = text.replace(new RegExp(`\\$${name}\\$`, "gi"), replacement);
        }
      }
    }
    return text;
  }

  function t(key, substitutions) {
    const entry = activeMessages[key];
    if (entry) {
      const formatted = formatMessageEntry(entry, substitutions);
      if (formatted) return formatted;
    }
    try {
      const msg = chrome.i18n && chrome.i18n.getMessage(key, substitutions);
      if (msg) return msg;
    } catch {
      // Fallback when opened outside extension runtime
    }
    return key;
  }

  function closeLangMenu() {
    langMenu.hidden = true;
    langBtn.setAttribute("aria-expanded", "false");
  }

  function toggleLangMenu() {
    const nextOpen = langMenu.hidden;
    langMenu.hidden = !nextOpen;
    langBtn.setAttribute("aria-expanded", nextOpen ? "true" : "false");
  }

  function renderLangMenu() {
    const current = settings.language || "auto";
    langMenu.innerHTML = "";
    for (const lang of SUPPORTED_LANGUAGES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.role = "menuitemradio";
      btn.className = `lang-option${lang.code === current ? " is-active" : ""}`;
      btn.setAttribute("aria-checked", lang.code === current ? "true" : "false");

      const label = document.createElement("span");
      label.textContent = lang.labelKey ? t(lang.labelKey) : lang.nativeLabel;

      const check = document.createElement("span");
      check.className = "lang-check";
      check.textContent = "✓";

      btn.appendChild(label);
      btn.appendChild(check);

      btn.addEventListener("click", async () => {
        closeLangMenu();
        if (settings.language === lang.code) return;
        settings.language = lang.code;
        await chrome.storage.local.set({ language: settings.language });
        await setLanguage(settings.language);
        await renderFontList();
        await updatePreview();
      });

      langMenu.appendChild(btn);
    }
  }

  function applyI18n() {
    document.documentElement.lang = activeLocale.replace("_", "-");
    for (const el of document.querySelectorAll("[data-i18n]")) {
      const msg = t(el.dataset.i18n);
      if (msg && msg !== el.dataset.i18n) {
        el.textContent = msg;
      }
    }
    for (const el of document.querySelectorAll("[data-i18n-title]")) {
      const msg = t(el.dataset.i18nTitle);
      if (msg && msg !== el.dataset.i18nTitle) {
        el.title = msg;
      }
    }
    renderLangMenu();
  }

  async function setLanguage(preferred) {
    activeLocale = resolveLocale(preferred);
    activeMessages = await loadLocaleMessages(activeLocale);
    applyI18n();
  }

  function showStatus(text, isError = false) {
    statusMsg.textContent = text;
    statusMsg.classList.toggle("is-error", isError);
    statusMsg.hidden = false;
    clearTimeout(showStatus._timer);
    showStatus._timer = setTimeout(() => {
      statusMsg.hidden = true;
    }, 3500);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function previewFamilyName(fontId) {
    return `EWFPreview_${fontId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  }

  async function ensurePreviewFontLoaded(font) {
    const family = previewFamilyName(font.id);
    if (loadedPreviewFamilies.has(family)) return family;

    try {
      let source;
      if (font.file) {
        const res = await fetch(chrome.runtime.getURL(font.file));
        source = await res.arrayBuffer();
      } else {
        const key = `customFontData:${font.id}`;
        const stored = await chrome.storage.local.get(key);
        if (!stored[key]) return null;
        source = base64ToUint8Array(stored[key]).buffer;
      }

      const face = new FontFace(family, source, {
        unicodeRange: FLAG_UNICODE_RANGE
      });
      await face.load();
      document.fonts.add(face);
      loadedPreviewFamilies.add(family);
      return family;
    } catch (err) {
      console.warn("[EmojiWinFlags popup] Failed to load preview font:", font.id, err);
      return null;
    }
  }

  function getAllFonts() {
    const customs = Array.isArray(settings.customFonts) ? settings.customFonts : [];
    return [...BUILTIN_FONTS, ...customs];
  }

  async function updatePreview() {
    const allFonts = getAllFonts();
    const selected = allFonts.find((f) => f.id === settings.selectedFontId) || BUILTIN_FONTS[0];
    const isSiteDisabled = activeHost && settings.disabledHosts.includes(activeHost);
    const effectiveEnabled = settings.enabled && !isSiteDisabled;

    previewCard.classList.toggle("is-disabled", !effectiveEnabled);
    activeFontName.textContent = effectiveEnabled
      ? selected.name
      : t("previewPaused", [selected.name]);

    if (effectiveEnabled) {
      const family = await ensurePreviewFontLoaded(selected);
      const stack = family
        ? `"${family}", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
        : "";
      previewFlags.style.fontFamily = stack;
      previewSentence.style.fontFamily = stack;
    } else {
      previewFlags.style.fontFamily = "";
      previewSentence.style.fontFamily = "";
    }
  }

  async function renderFontList() {
    const allFonts = getAllFonts();
    fontList.innerHTML = "";

    for (const font of allFonts) {
      const isSelected = font.id === settings.selectedFontId;
      const isCustom = !font.file;

      const item = document.createElement("div");
      item.className = `font-item${isSelected ? " is-selected" : ""}`;
      item.dataset.fontId = font.id;

      const left = document.createElement("div");
      left.className = "font-item-left";

      const nameRow = document.createElement("div");
      nameRow.className = "font-item-name-row";

      const nameEl = document.createElement("span");
      nameEl.className = "font-item-name";
      nameEl.textContent = font.name;

      const tagEl = document.createElement("span");
      tagEl.className = "font-item-tag";
      tagEl.textContent = font.sizeLabel || (isCustom ? t("customFontTag") : "");

      nameRow.appendChild(nameEl);
      if (tagEl.textContent) nameRow.appendChild(tagEl);

      const subEl = document.createElement("div");
      subEl.className = "font-item-sub";
      if (font.subtitleKey) {
        subEl.textContent = t(font.subtitleKey);
      } else if (font.ext) {
        subEl.textContent = t("customFontSubtitle", [font.ext]);
      } else {
        subEl.textContent = font.subtitle || t("customFontFallbackSubtitle");
      }

      left.appendChild(nameRow);
      left.appendChild(subEl);

      const right = document.createElement("div");
      right.className = "font-item-right";

      const sample = document.createElement("span");
      sample.className = "font-item-sample";
      sample.textContent = "🇨🇳🇺🇸🇯🇵";
      right.appendChild(sample);

      // Load each font's own preview independently
      ensurePreviewFontLoaded(font).then((family) => {
        if (family) {
          sample.style.fontFamily = `"${family}", sans-serif`;
        }
      });

      if (isCustom) {
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "delete-btn";
        delBtn.title = t("deleteCustomFontTitle");
        delBtn.textContent = "×";
        delBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          await deleteCustomFont(font.id);
        });
        right.appendChild(delBtn);
      }

      item.appendChild(left);
      item.appendChild(right);

      item.addEventListener("click", async () => {
        if (settings.selectedFontId === font.id) return;
        settings.selectedFontId = font.id;
        await chrome.storage.local.set({ selectedFontId: font.id });
        renderFontList();
        updatePreview();
      });

      fontList.appendChild(item);
    }
  }

  async function deleteCustomFont(fontId) {
    const nextCustomFonts = (settings.customFonts || []).filter((f) => f.id !== fontId);
    const updates = { customFonts: nextCustomFonts };
    if (settings.selectedFontId === fontId) {
      updates.selectedFontId = DEFAULT_SETTINGS.selectedFontId;
      settings.selectedFontId = updates.selectedFontId;
    }
    settings.customFonts = nextCustomFonts;
    await chrome.storage.local.remove(`customFontData:${fontId}`);
    await chrome.storage.local.set(updates);
    renderFontList();
    updatePreview();
    showStatus(t("statusDeleted"));
  }

  async function handleFileUpload(file) {
    if (!file) return;
    if (file.size > MAX_CUSTOM_FONT_BYTES) {
      showStatus(t("statusFileTooLarge"), true);
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      // Validate that Chrome can actually parse this font
      const testFamily = `EWFTest_${Date.now()}`;
      const testFace = new FontFace(testFamily, buffer);
      await testFace.load();

      const id = `custom-${Date.now()}`;
      const cleanName = file.name.replace(/\.(woff2|woff|ttf|otf)$/i, "");
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const meta = {
        id,
        name: cleanName,
        ext,
        sizeLabel: formatSize(file.size)
      };

      const base64 = arrayBufferToBase64(buffer);
      const nextCustomFonts = [...(settings.customFonts || []), meta];

      await chrome.storage.local.set({
        [`customFontData:${id}`]: base64,
        customFonts: nextCustomFonts,
        selectedFontId: id
      });

      settings.customFonts = nextCustomFonts;
      settings.selectedFontId = id;

      await renderFontList();
      await updatePreview();
      showStatus(t("statusImported", [cleanName]));
    } catch (err) {
      console.error(err);
      showStatus(t("statusInvalidFont"), true);
    }
  }

  async function initActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) return;
      const url = new URL(tab.url);
      if (url.protocol === "http:" || url.protocol === "https:") {
        activeHost = url.hostname;
        siteHostEl.textContent = activeHost;
        siteToggle.checked = !settings.disabledHosts.includes(activeHost);
        siteBar.hidden = false;
      }
    } catch {
      // Ignore chrome:// or restricted tabs
    }
  }

  async function init() {
    settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
    if (!Array.isArray(settings.disabledHosts)) settings.disabledHosts = [];
    if (!Array.isArray(settings.customFonts)) settings.customFonts = [];
    if (!settings.language) settings.language = "auto";

    await setLanguage(settings.language);
    globalToggle.checked = settings.enabled !== false;

    await initActiveTab();
    await renderFontList();
    await updatePreview();

    langBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleLangMenu();
    });

    document.addEventListener("click", (e) => {
      if (!langMenu.hidden && !langPicker.contains(e.target)) {
        closeLangMenu();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !langMenu.hidden) {
        closeLangMenu();
      }
    });

    globalToggle.addEventListener("change", async () => {
      settings.enabled = globalToggle.checked;
      await chrome.storage.local.set({ enabled: settings.enabled });
      updatePreview();
    });

    siteToggle.addEventListener("change", async () => {
      if (!activeHost) return;
      const set = new Set(settings.disabledHosts);
      if (siteToggle.checked) {
        set.delete(activeHost);
      } else {
        set.add(activeHost);
      }
      settings.disabledHosts = Array.from(set);
      await chrome.storage.local.set({ disabledHosts: settings.disabledHosts });
      updatePreview();
    });

    uploadBtn.addEventListener("click", () => {
      fontFileInput.value = "";
      fontFileInput.click();
    });

    fontFileInput.addEventListener("change", () => {
      const file = fontFileInput.files && fontFileInput.files[0];
      if (file) {
        handleFileUpload(file);
      }
    });
  }

  init();
})();
