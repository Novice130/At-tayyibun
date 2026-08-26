#!/usr/bin/env bash
set -e

# ==============================================================================
# At-Tayyibun iOS TestFlight Build & Upload Script
# ==============================================================================
# Usage:
#   ./scripts/upload_to_testflight.sh <APPLE_ISSUER_ID>
# Or set APPLE_ISSUER_ID in your environment:
#   export APPLE_ISSUER_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
#   ./scripts/upload_to_testflight.sh
# ==============================================================================

KEY_ID="T479RMTYDJ"
DEFAULT_ISSUER_ID="07ba3ed9-33fb-4952-8cb5-aca4d1f5a7d6"
ISSUER_ID="${APPLE_ISSUER_ID:-$DEFAULT_ISSUER_ID}"
SKIP_BUILD=false

for arg in "$@"; do
  if [ "$arg" == "--skip-build" ] || [ "$arg" == "-s" ]; then
    SKIP_BUILD=true
  elif [[ "$arg" =~ ^[0-9a-fA-F-]{36}$ ]]; then
    ISSUER_ID="$arg"
  fi
done

if [ -z "$ISSUER_ID" ]; then
  echo "❌ Error: App Store Connect Issuer ID is required."
  exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$PROJECT_ROOT/../.." && pwd)"
KEY_FILE="$REPO_ROOT/AuthKey_${KEY_ID}.p8"

# Ensure API Key is in Apple's expected location
mkdir -p ~/.appstoreconnect/private_keys ~/.private_keys
if [ -f "$KEY_FILE" ]; then
  cp "$KEY_FILE" ~/.appstoreconnect/private_keys/
  cp "$KEY_FILE" ~/.private_keys/
  echo "✅ Verified App Store Connect API Key (Key ID: $KEY_ID)"
else
  echo "⚠️ Warning: $KEY_FILE not found in repository root, checking ~/.appstoreconnect/private_keys/..."
  if [ ! -f ~/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8 ]; then
    echo "❌ Error: AuthKey_${KEY_ID}.p8 not found."
    exit 1
  fi
fi


cd "$PROJECT_ROOT"

if [ "$SKIP_BUILD" = false ]; then
  echo "📱 Step 1: Building iOS Release IPA..."
  flutter build ipa --release \
    --dart-define=GOOGLE_SERVER_CLIENT_ID=659173631996-bi5c9d3i4qk6pksee92abkn3t4vheeo9.apps.googleusercontent.com
else
  echo "⏩ Skipping IPA build (using existing build artifact)..."
fi

IPA_PATH="$(find "$PROJECT_ROOT/build/ios/ipa" -name "*.ipa" | head -n 1)"

if [ -z "$IPA_PATH" ] || [ ! -f "$IPA_PATH" ]; then
  echo "❌ Error: No .ipa file found in $PROJECT_ROOT/build/ios/ipa/"
  exit 1
fi
echo "📦 Found IPA: $IPA_PATH"

echo "🔍 Step 2: Validating IPA with App Store Connect..."
xcrun altool --validate-app \
  -f "$IPA_PATH" \
  -t ios \
  --apiKey "$KEY_ID" \
  --apiIssuer "$ISSUER_ID"

echo "🚀 Step 3: Uploading IPA to TestFlight..."
xcrun altool --upload-app \
  -f "$IPA_PATH" \
  -t ios \
  --apiKey "$KEY_ID" \
  --apiIssuer "$ISSUER_ID"

echo "🎉 Successfully uploaded build to TestFlight!"
echo "Apple will process the build (usually 5-15 minutes)."
echo "Once processing completes, internal testers will be notified automatically on their iPhones."
