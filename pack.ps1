$ErrorActionPreference = "Stop"

$manifest = Get-Content -Path "manifest.json" -Raw | ConvertFrom-Json
$version = $manifest.version
$outZip = "emoji-win-flags-v$version.zip"

if (Test-Path $outZip) {
  Remove-Item -Force $outZip
}

$items = @(
  "manifest.json",
  "background.js",
  "content.js",
  "fonts.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "fonts",
  "icons",
  "_locales"
)

Compress-Archive -Path $items -DestinationPath $outZip -CompressionLevel Optimal -Force
$sizeKB = [Math]::Round((Get-Item $outZip).Length / 1KB, 1)
Write-Host "Packed $outZip ($sizeKB KB)"
