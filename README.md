# Emoji Win Flags

Fix country flag emojis rendering as two-letter country codes (e.g., `CN`, `US`) in Chrome / Edge on Windows by cleanly replacing flag glyphs at the font level.

修复 Windows 下 Chrome / Edge 浏览器中 Emoji 国旗显示为两位国家代码字母（如 `CN`、`US`）的问题，通过字体层无感替换并支持自由切换多种风格。

## Features / 功能特性

- **Flag-only `unicode-range` targeting**: Scoped strictly to Regional Indicator Symbols (`U+1F1E6-1F1FF`) and subdivision flag tag sequences (`U+1F3F4, U+E0020-E007F`). Does not affect normal text, other emojis, or icon fonts.
- **3 bundled offline open-source flag fonts**:
  - **Twemoji** (78 KB) — Twitter / X clean flat style
  - **Noto Color Emoji** (822 KB) — Google waving flag style
  - **OpenMoji** (953 KB) — Open-source outlined style
- **Custom local font import**: Import your own `.woff2` / `.woff` / `.ttf` / `.otf` flag font directly from the popup.
- **Instant live switching**: Switch styles or toggle on/off without refreshing open tabs.
- **CSP-safe & DOM-safe**: Loads fonts via `FontFace` binary buffers (works on strict CSP sites like GitHub / X) and preserves original DOM text nodes (supports dynamic content, `<input>`, `<textarea>`, and Shadow DOM).
- **Multi-language UI**: Supports English, 简体中文, 繁體中文, and 日本語 via `_locales/` config files with an in-popup language switcher.
- **100% offline & privacy-friendly**: Zero network requests, zero data collection. See [PRIVACY.md](./PRIVACY.md).

## Installation (Load Unpacked) / 本地安装

1. Clone or download this repository.
2. Open `chrome://extensions/` (or `edge://extensions/`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select this repository folder.

## Packaging for Chrome Web Store / 打包发布

Run the PowerShell script in the project root:

```powershell
.\pack.ps1
```

This generates `emoji-win-flags-v<version>.zip` containing only the extension runtime files (with `manifest.json` at the archive root).

## Adding a New Language / 扩充语言

1. Copy `_locales/en/messages.json` to `_locales/<code>/messages.json` (e.g., `ko`, `de`, `fr`).
2. Translate the `"message"` fields.
3. Add an entry to `SUPPORTED_LANGUAGES` in `fonts.js`.

## Third-Party Font Licenses / 开源字体协议

- **Twemoji Country Flags** (`fonts/twemoji-flags.woff2`) — Derived from [Twemoji](https://github.com/twitter/twemoji) via [country-flag-emoji-polyfill](https://github.com/talkjs/country-flag-emoji-polyfill), licensed under [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Noto Color Emoji Flags** (`fonts/noto-flags.woff2`) — Derived from [Noto Emoji](https://github.com/googlefonts/noto-emoji) via [noto-color-emoji-flags](https://www.npmjs.com/package/noto-color-emoji-flags), licensed under [SIL OFL 1.1](https://scripts.sil.org/OFL).
- **OpenMoji** (`fonts/openmoji-flags.woff2`) — From [OpenMoji](https://github.com/hfg-gmuend/openmoji), licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

## License

Extension source code is licensed under the [MIT License](./LICENSE).
