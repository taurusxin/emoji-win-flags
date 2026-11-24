// Shared font registry and constants used by content script, popup, and background.
(function (globalScope) {
  const FLAG_FONT_FAMILY = "EmojiWinFlags";

  // Regional Indicator Symbols (U+1F1E6-1F1FF) + Black Flag & Tag sequences (subdivision flags like England/Scotland/Wales)
  const FLAG_UNICODE_RANGE = "U+1F1E6-1F1FF, U+1F3F4, U+E0020-E007F";

  const BUILTIN_FONTS = [
    {
      id: "twemoji",
      name: "Twemoji",
      subtitleKey: "fontTwemojiSubtitle",
      subtitle: "Twitter / X clean flat style",
      file: "fonts/twemoji-flags.woff2",
      sizeLabel: "78 KB",
      license: "CC-BY 4.0"
    },
    {
      id: "noto",
      name: "Noto Color Emoji",
      subtitleKey: "fontNotoSubtitle",
      subtitle: "Google waving flag style",
      file: "fonts/noto-flags.woff2",
      sizeLabel: "822 KB",
      license: "OFL-1.1"
    },
    {
      id: "openmoji",
      name: "OpenMoji",
      subtitleKey: "fontOpenmojiSubtitle",
      subtitle: "Open-source outlined style",
      file: "fonts/openmoji-flags.woff2",
      sizeLabel: "953 KB",
      license: "CC BY-SA 4.0"
    }
  ];

  const SUPPORTED_LANGUAGES = [
    { code: "auto", labelKey: "langAuto", nativeLabel: "Auto" },
    { code: "zh_CN", nativeLabel: "简体中文" },
    { code: "zh_TW", nativeLabel: "繁體中文" },
    { code: "en", nativeLabel: "English" },
    { code: "ja", nativeLabel: "日本語" }
  ];

  const DEFAULT_SETTINGS = {
    enabled: true,
    selectedFontId: "twemoji",
    language: "auto",
    disabledHosts: [],
    customFonts: [] // [{ id: "custom-...", name: "My Font", sizeLabel: "120 KB" }]
  };

  globalScope.EmojiWinFlagsConfig = {
    FLAG_FONT_FAMILY,
    FLAG_UNICODE_RANGE,
    BUILTIN_FONTS,
    SUPPORTED_LANGUAGES,
    DEFAULT_SETTINGS
  };
})(typeof self !== "undefined" ? self : window);
