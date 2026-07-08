#!/bin/bash
# EAS Build lifecycle hook — runs before npm install on EAS Build servers
# Only run production checks for store distribution profiles
# https://docs.expo.dev/build-reference/npm-hooks/

if [ "$EAS_BUILD_PROFILE" = "playstore" ] || [ "$EAS_BUILD_PROFILE" = "testflight" ] || [ "$EAS_BUILD_PROFILE" = "production" ]; then
  echo "Store build detected (profile: $EAS_BUILD_PROFILE) — running production readiness checks..."
  bash scripts/check-prod-ready.sh
else
  echo "Non-store build (profile: $EAS_BUILD_PROFILE) — skipping production checks"
fi
