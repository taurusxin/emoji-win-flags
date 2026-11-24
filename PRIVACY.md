# Privacy Policy — Emoji Win Flags

*Last updated: November 24, 2026*

## Summary

**Emoji Win Flags does not collect, store, share, or transmit any user data.**

All functionality runs 100% locally inside your browser.

---

## Information We Collect

None. Emoji Win Flags does not collect:
- Personally identifiable information (name, email, address, etc.)
- Browsing history or visited URLs
- Webpage content or text
- Analytics, telemetry, or usage statistics
- Network requests to external servers

## Local Storage

The extension uses Chrome's local storage (`chrome.storage.local`) solely on your device to save:
- Your selected flag emoji font style
- Global enable/disable state
- Per-site disabled hostnames you explicitly toggle off
- Your preferred popup UI language
- Any local font files you manually import

This data never leaves your browser and is not synced or sent to any third party.

## Permissions Explanation

- **`storage`**: Saves your extension settings and locally imported fonts on your device.
- **`activeTab`**: Reads the current tab's hostname only when you open the popup, so you can toggle the extension on or off for that website.
- **Host permissions (`<all_urls>`)**: Allows the content script to detect country flag emoji characters in web pages locally and apply the selected flag font via CSS `FontFace` (`unicode-range` restricted to flag codepoints). No page content is read for tracking, stored, or transmitted.

## Contact

If you have any questions about this Privacy Policy, please open an issue at:
https://github.com/taurusxin/emoji-win-flags/issues

---

# 隐私政策 — Emoji Win Flags

*最后更新：2026 年 11 月 24 日*

## 概要

**Emoji Win Flags 不收集、不存储、不共享、也不传输任何用户数据。**

本扩展的全部功能均在您的浏览器本地离线运行。

## 我们收集的信息

无。本扩展不会收集任何个人身份信息、浏览记录、网页内容或使用统计数据，也不会向任何外部服务器发起网络请求。

## 本地存储

本扩展仅在您的设备本地使用 `chrome.storage.local` 保存以下偏好设置：
- 当前选择的国旗 Emoji 字体
- 全局启用/暂停开关状态
- 您手动关闭的特定网站域名列表
- 弹窗界面语言设置
- 您手动导入的本地字体文件

以上数据仅保存在您的本地浏览器中，不会上传或同步至任何第三方。

## 权限说明

- **`storage`**：在本地保存插件偏好设置和用户手动导入的字体。
- **`activeTab`**：仅在您打开插件弹窗时读取当前标签页域名，用于提供“在当前网站启用/禁用”开关。
- **主机权限（`<all_urls>`）**：用于在网页本地检测国旗 Emoji 并通过 `FontFace` 注入所选国旗字体（通过 `unicode-range` 严格限定在国旗字符区间），不会收集、保存或传输任何网页内容。

## 联系方式

如对本隐私政策有任何疑问，请在 GitHub 仓库提交 Issue：
https://github.com/taurusxin/emoji-win-flags/issues
