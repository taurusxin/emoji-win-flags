(function () {
  const config = window.EmojiWinFlagsConfig;
  if (!config) return;

  const {
    FLAG_FONT_FAMILY,
    FLAG_UNICODE_RANGE,
    BUILTIN_FONTS,
    DEFAULT_SETTINGS
  } = config;

  // Matches Regional Indicator pairs (e.g. 🇨🇳) or Tag-sequence subdivision flags (e.g. 🏴󠁧󠁢󠁥󠁮󠁧󠁿)
  const FLAG_REGEX = /[\u{1F1E6}-\u{1F1FF}]{2}|\u{1F3F4}[\u{E0020}-\u{E007F}]+/u;

  const SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEMPLATE",
    "IFRAME",
    "OBJECT",
    "EMBED",
    "SVG",
    "CANVAS",
    "HEAD",
    "META",
    "LINK",
    "TITLE"
  ]);

  const PATCHED_ATTR = "data-ewf-patched";
  const ORIG_FONT_ATTR = "data-ewf-orig-font";
  const ORIG_PRIORITY_ATTR = "data-ewf-orig-priority";

  let currentFontFace = null;
  let currentFontId = null;
  let isActive = false;
  let observer = null;
  let pendingRoots = new Set();
  let scanScheduled = false;
  let domReadyHooked = false;
  const trackedShadowRoots = new Set();

  const currentHost = (() => {
    try {
      return window.location.hostname || "";
    } catch {
      return "";
    }
  })();

  function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function loadFontBuffer(fontId) {
    const builtin = BUILTIN_FONTS.find((f) => f.id === fontId);
    if (builtin) {
      try {
        const res = await fetch(chrome.runtime.getURL(builtin.file));
        if (res.ok) {
          return await res.arrayBuffer();
        }
      } catch {
        // Fallback to background service worker if page environment blocks fetch
      }
    }

    const response = await chrome.runtime.sendMessage({
      type: "GET_FONT_BASE64",
      fontId
    });
    if (!response || !response.ok || !response.base64) {
      throw new Error(response?.error || `Unable to load font ${fontId}`);
    }
    return base64ToUint8Array(response.base64).buffer;
  }

  async function applyFontFace(fontId) {
    if (currentFontFace && currentFontId === fontId) {
      return;
    }

    let buffer;
    try {
      buffer = await loadFontBuffer(fontId);
    } catch (err) {
      // Fallback to default twemoji if a deleted custom font was selected
      if (fontId !== "twemoji") {
        buffer = await loadFontBuffer("twemoji");
        fontId = "twemoji";
      } else {
        console.warn("[EmojiWinFlags]", err);
        return;
      }
    }

    const newFace = new FontFace(FLAG_FONT_FAMILY, buffer, {
      unicodeRange: FLAG_UNICODE_RANGE,
      display: "swap"
    });

    await newFace.load();

    // Add new face before removing old one to prevent flash of fallback letters
    document.fonts.add(newFace);
    if (currentFontFace) {
      document.fonts.delete(currentFontFace);
    }
    currentFontFace = newFace;
    currentFontId = fontId;
  }

  function removeFontFace() {
    if (currentFontFace) {
      document.fonts.delete(currentFontFace);
      currentFontFace = null;
      currentFontId = null;
    }
  }

  function patchElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    if (SKIP_TAGS.has(el.tagName)) return;
    if (el.hasAttribute(PATCHED_ATTR)) return;

    const computedFont = window.getComputedStyle(el).fontFamily || "sans-serif";
    if (computedFont.includes(FLAG_FONT_FAMILY)) {
      return;
    }

    // Save original inline style so we can restore cleanly on disable
    const origInline = el.style.getPropertyValue("font-family");
    const origPriority = el.style.getPropertyPriority("font-family");
    el.setAttribute(ORIG_FONT_ATTR, origInline);
    el.setAttribute(ORIG_PRIORITY_ATTR, origPriority);
    el.setAttribute(PATCHED_ATTR, "1");

    el.style.setProperty(
      "font-family",
      `"${FLAG_FONT_FAMILY}", ${computedFont}`,
      "important"
    );
  }

  function unpatchAll(root) {
    if (!root) return;
    const patched = root.querySelectorAll(`[${PATCHED_ATTR}]`);
    for (const el of patched) {
      const origInline = el.getAttribute(ORIG_FONT_ATTR) || "";
      const origPriority = el.getAttribute(ORIG_PRIORITY_ATTR) || "";
      if (origInline) {
        el.style.setProperty("font-family", origInline, origPriority);
      } else {
        el.style.removeProperty("font-family");
      }
      el.removeAttribute(PATCHED_ATTR);
      el.removeAttribute(ORIG_FONT_ATTR);
      el.removeAttribute(ORIG_PRIORITY_ATTR);
    }
  }

  function scanRoot(root) {
    if (!root || !isActive) return;

    if (root.nodeType === Node.TEXT_NODE) {
      if (root.nodeValue && FLAG_REGEX.test(root.nodeValue) && root.parentElement) {
        patchElement(root.parentElement);
      }
      return;
    }

    if (root.nodeType === Node.ELEMENT_NODE) {
      if (SKIP_TAGS.has(root.tagName)) return;

      if (
        (root.tagName === "INPUT" || root.tagName === "TEXTAREA") &&
        typeof root.value === "string" &&
        FLAG_REGEX.test(root.value)
      ) {
        patchElement(root);
      }

      if (root.shadowRoot) {
        observeRoot(root.shadowRoot);
        scanRoot(root.shadowRoot);
      }
    }

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (SKIP_TAGS.has(node.tagName)) {
              return NodeFilter.FILTER_REJECT;
            }
            if (
              node.tagName === "INPUT" ||
              node.tagName === "TEXTAREA" ||
              node.shadowRoot
            ) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_SKIP;
          }
          if (node.nodeValue && FLAG_REGEX.test(node.nodeValue)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    let current;
    while ((current = walker.nextNode())) {
      if (current.nodeType === Node.TEXT_NODE) {
        if (current.parentElement) {
          patchElement(current.parentElement);
        }
      } else if (current.nodeType === Node.ELEMENT_NODE) {
        if (
          (current.tagName === "INPUT" || current.tagName === "TEXTAREA") &&
          typeof current.value === "string" &&
          FLAG_REGEX.test(current.value)
        ) {
          patchElement(current);
        }
        if (current.shadowRoot) {
          observeRoot(current.shadowRoot);
          scanRoot(current.shadowRoot);
        }
      }
    }
  }

  function scheduleScan(node) {
    if (!isActive || !node) return;
    pendingRoots.add(node);
    if (!scanScheduled) {
      scanScheduled = true;
      requestAnimationFrame(() => {
        scanScheduled = false;
        const roots = Array.from(pendingRoots);
        pendingRoots.clear();
        for (const r of roots) {
          if (r.isConnected !== false) {
            scanRoot(r);
          }
        }
      });
    }
  }

  function observeRoot(target) {
    if (!observer || !target) return;
    if (target instanceof ShadowRoot) {
      if (trackedShadowRoots.has(target)) return;
      trackedShadowRoots.add(target);
    }
    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function handleInputEvent(event) {
    if (!isActive) return;
    const target = event.target;
    if (
      target &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA") &&
      typeof target.value === "string" &&
      FLAG_REGEX.test(target.value)
    ) {
      patchElement(target);
    }
  }

  function startObserving() {
    if (!observer) {
      observer = new MutationObserver((mutations) => {
        if (!isActive) return;
        for (const m of mutations) {
          if (m.type === "characterData") {
            scheduleScan(m.target);
          } else if (m.type === "childList") {
            for (const added of m.addedNodes) {
              scheduleScan(added);
            }
          }
        }
      });
    }

    if (document.documentElement) {
      observeRoot(document.documentElement);
    }
    document.addEventListener("input", handleInputEvent, true);
  }

  function stopObserving() {
    if (observer) {
      observer.disconnect();
    }
    document.removeEventListener("input", handleInputEvent, true);
    pendingRoots.clear();
    scanScheduled = false;
  }

  async function applySettings(settings) {
    const enabled = settings.enabled !== false;
    const disabledHosts = Array.isArray(settings.disabledHosts)
      ? settings.disabledHosts
      : [];
    const hostDisabled = currentHost && disabledHosts.includes(currentHost);
    const shouldRun = enabled && !hostDisabled;

    if (!shouldRun) {
      isActive = false;
      stopObserving();
      removeFontFace();
      unpatchAll(document);
      for (const sr of trackedShadowRoots) {
        if (sr.host && sr.host.isConnected) {
          unpatchAll(sr);
        }
      }
      trackedShadowRoots.clear();
      return;
    }

    const fontId = settings.selectedFontId || DEFAULT_SETTINGS.selectedFontId;
    isActive = true;
    await applyFontFace(fontId);

    if (document.readyState === "loading") {
      if (!domReadyHooked) {
        domReadyHooked = true;
        document.addEventListener(
          "DOMContentLoaded",
          () => {
            domReadyHooked = false;
            if (!isActive) return;
            startObserving();
            scanRoot(document.body || document.documentElement);
          },
          { once: true }
        );
      }
    } else {
      startObserving();
      scanRoot(document.body || document.documentElement);
    }
  }

  // Initial load
  chrome.storage.local.get(DEFAULT_SETTINGS).then(applySettings);

  // React to live settings updates from popup across all open tabs
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (
      changes.enabled ||
      changes.selectedFontId ||
      changes.disabledHosts ||
      changes.customFonts
    ) {
      chrome.storage.local.get(DEFAULT_SETTINGS).then(applySettings);
    }
  });
})();
