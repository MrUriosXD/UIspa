#!/bin/bash
# UIspa · genera el proyecto de Xcode de la versión de Safari.
# Requiere macOS con Xcode instalado (no basta con las Command Line Tools).
set -euo pipefail
cd "$(dirname "$0")"

if ! xcrun --find safari-web-extension-packager >/dev/null 2>&1 && \
   ! xcrun --find safari-web-extension-converter >/dev/null 2>&1; then
  echo "No encuentro la herramienta de Safari. Instala Xcode desde la App Store y ejecuta:"
  echo "  sudo xcode-select -s /Applications/Xcode.app"
  exit 1
fi

# La herramienta se llama "packager" en Xcode 26 y "converter" en versiones anteriores
TOOL=safari-web-extension-packager
xcrun --find "$TOOL" >/dev/null 2>&1 || TOOL=safari-web-extension-converter

rm -rf xcode
xcrun "$TOOL" safari \
  --project-location xcode \
  --app-name UIspa \
  --bundle-identifier com.ahhhv.UIspa \
  --macos-only --swift --copy-resources --no-open --force

echo
echo "Proyecto creado en: $(pwd)/xcode/UIspa"
echo "Ábrelo con:  open xcode/UIspa/UIspa.xcodeproj"
