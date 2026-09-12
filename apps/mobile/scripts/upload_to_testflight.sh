#!/usr/bin/env bash
set -e

# ==============================================================================
# At-Tayyibun iOS TestFlight Build & Upload Script
# ==============================================================================
# Usage:
#   ./scripts/upload_to_testflight.sh [--skip-build] [ISSUER_ID]
#
# Environment overrides:
#   APPLE_ISSUER_ID   App Store Connect Issuer ID (default below)
#   ASC_API_KEY_ID    App Store Connect API Key ID (default: T479RMTYDJ)
#   ASC_API_KEY_PATH  Path to that key's .p8 (default: <repo>/AuthKey_<id>.p8)
# ==============================================================================

KEY_ID="${ASC_API_KEY_ID:-T479RMTYDJ}"
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
KEY_FILE="${ASC_API_KEY_PATH:-$REPO_ROOT/AuthKey_${KEY_ID}.p8}"
ARCHIVE="$PROJECT_ROOT/build/ios/archive/Runner.xcarchive"
EXPORT_DIR="$PROJECT_ROOT/build/ios/ipa-export"

# Ensure the API key is in Apple's expected location
mkdir -p ~/.appstoreconnect/private_keys ~/.private_keys
if [ -f "$KEY_FILE" ]; then
  cp "$KEY_FILE" ~/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8
  cp "$KEY_FILE" ~/.private_keys/AuthKey_${KEY_ID}.p8
  KEY_PATH="$KEY_FILE"
  echo "✅ Using App Store Connect API Key (Key ID: $KEY_ID)"
elif [ -f ~/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8 ]; then
  KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8"
  echo "✅ Using cached App Store Connect API Key (Key ID: $KEY_ID)"
else
  echo "❌ Error: no .p8 found for Key ID $KEY_ID."
  echo "   Set ASC_API_KEY_PATH to the downloaded AuthKey_$KEY_ID.p8."
  exit 1
fi

cd "$PROJECT_ROOT"

if [ "$SKIP_BUILD" = false ]; then
  echo "📱 Step 1: Archiving iOS release build..."

  # Delete any previous archive first. The archive action is development-signed
  # and the real distribution signing happens at export below, so without this
  # a failed build silently reuses whatever stale archive is already on disk.
  rm -rf "$ARCHIVE"

  flutter build ipa --release \
    --dart-define=GOOGLE_SERVER_CLIENT_ID=659173631996-bi5c9d3i4qk6pksee92abkn3t4vheeo9.apps.googleusercontent.com || true

  if [ ! -d "$ARCHIVE" ]; then
    echo "❌ Error: the build produced no archive — see the flutter build output above."
    echo "   Most common cause: no valid code-signing identity in the keychain."
    exit 1
  fi
else
  echo "⏩ Skipping build (reusing $ARCHIVE)"
  if [ ! -d "$ARCHIVE" ]; then
    echo "❌ Error: no archive at $ARCHIVE"
    exit 1
  fi
fi

# Export an App Store-signed IPA. This is where Xcode re-signs with an Apple
# Distribution certificate — packaging the archive by hand would ship a
# development-signed IPA, which App Store Connect rejects with error 90161.
# -allowProvisioningUpdates lets Xcode create the App Store provisioning
# profile from the API key; `set -e` aborts on failure rather than uploading
# an unsigned build.
echo "📦 Step 2: Exporting App Store-signed IPA..."
rm -rf "$EXPORT_DIR"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$REPO_ROOT/ExportOptions.plist" \
  -exportPath "$EXPORT_DIR" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$KEY_PATH" \
  -authenticationKeyID "$KEY_ID" \
  -authenticationKeyIssuerID "$ISSUER_ID"

IPA_PATH="$(find "$EXPORT_DIR" -name "*.ipa" | head -n 1)"
if [ -z "$IPA_PATH" ] || [ ! -f "$IPA_PATH" ]; then
  echo "❌ Error: export produced no .ipa in $EXPORT_DIR"
  exit 1
fi
echo "📦 Found IPA: $IPA_PATH"

echo "🔍 Step 3: Validating IPA with App Store Connect..."
xcrun altool --validate-app \
  -f "$IPA_PATH" \
  -t ios \
  --apiKey "$KEY_ID" \
  --apiIssuer "$ISSUER_ID"

echo "🚀 Step 4: Uploading IPA to TestFlight..."
xcrun altool --upload-app \
  -f "$IPA_PATH" \
  -t ios \
  --apiKey "$KEY_ID" \
  --apiIssuer "$ISSUER_ID"

echo "🎉 Successfully uploaded build to TestFlight!"
echo "Apple will process the build (usually 5-15 minutes)."
echo "Once processing completes, internal testers will be notified automatically on their iPhones."
