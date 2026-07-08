#!/bin/bash
# Production readiness checks
# Runs in two contexts:
#   1. CI on PRs to v2-rebuild (GitHub Actions)
#   2. Pre-build hook before EAS builds (eas.json prebuild script)
# Catches dev-only changes that shouldn't ship to production builds

ERRORS=0

echo "=== Production Readiness Checks ==="
echo ""

# 1. Verify production API URL hasn't been changed
if grep -q "https://api\.thetrickbook\.com/api" src/constants/api.ts 2>/dev/null; then
  echo "PASS: Production API URL is correct"
else
  echo "FAIL: Production API URL (https://api.thetrickbook.com/api) not found in src/constants/api.ts"
  ERRORS=$((ERRORS + 1))
fi

# 2. Verify production socket URL
if grep -q "https://api\.thetrickbook\.com" src/constants/api.ts 2>/dev/null; then
  echo "PASS: Production socket URL is correct"
else
  echo "FAIL: Production socket URL not found in src/constants/api.ts"
  ERRORS=$((ERRORS + 1))
fi

# 3. Verify EAS store profiles have EXPO_NO_DOTENV
if grep -q "EXPO_NO_DOTENV" eas.json 2>/dev/null; then
  echo "PASS: EAS build profiles have EXPO_NO_DOTENV"
else
  echo "FAIL: eas.json missing EXPO_NO_DOTENV=1 in store build profiles"
  ERRORS=$((ERRORS + 1))
fi

# 4. Verify no hardcoded secrets in source files
SECRETS_FOUND=$(grep -rn "sk_live\|AKIA[A-Z0-9]\{16\}" \
  --include="*.ts" --include="*.tsx" --include="*.js" \
  --exclude-dir=node_modules --exclude-dir=.expo \
  . 2>/dev/null || true)
if [ -n "$SECRETS_FOUND" ]; then
  echo "FAIL: Potential secrets found in source files:"
  echo "$SECRETS_FOUND"
  ERRORS=$((ERRORS + 1))
else
  echo "PASS: No hardcoded secrets detected"
fi

# 5. Verify Google Sign-In uses conditional require (not static import)
if grep -q "from '@react-native-google-signin" app/\(auth\)/welcome.tsx 2>/dev/null; then
  echo "FAIL: welcome.tsx has static import of @react-native-google-signin (should use conditional require)"
  ERRORS=$((ERRORS + 1))
else
  echo "PASS: Google Sign-In uses conditional loading"
fi

# 6. Verify @react-native-google-signin is in dependencies (not accidentally removed)
if grep -q "@react-native-google-signin/google-signin" package.json 2>/dev/null; then
  echo "PASS: Google Sign-In native package is in dependencies"
else
  echo "FAIL: @react-native-google-signin/google-signin missing from package.json"
  ERRORS=$((ERRORS + 1))
fi

# 7. Verify app.config.js has the Google Sign-In plugin
if grep -q "@react-native-google-signin/google-signin" app.config.js 2>/dev/null; then
  echo "PASS: Google Sign-In config plugin is registered"
else
  echo "FAIL: @react-native-google-signin/google-signin plugin missing from app.config.js"
  ERRORS=$((ERRORS + 1))
fi

# 8. Verify service account key path exists for Play Store submissions
SERVICE_KEY_PATH=$(grep -o '"serviceAccountKeyPath"[[:space:]]*:[[:space:]]*"[^"]*"' eas.json 2>/dev/null | head -1 | sed 's/.*"\([^"]*\)"/\1/' || true)
if [ -n "$SERVICE_KEY_PATH" ] && [ -f "$SERVICE_KEY_PATH" ]; then
  echo "PASS: Google Play service account key exists at $SERVICE_KEY_PATH"
elif [ -n "$SERVICE_KEY_PATH" ]; then
  echo "WARN: Service account key path configured ($SERVICE_KEY_PATH) but file not found (OK in CI)"
else
  echo "WARN: No serviceAccountKeyPath in eas.json (needed for eas submit)"
fi

echo ""
if [ $ERRORS -gt 0 ]; then
  echo "FAILED: $ERRORS check(s) failed — fix before building for production"
  exit 1
else
  echo "All production readiness checks passed"
fi
