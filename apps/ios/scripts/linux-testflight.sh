#!/usr/bin/env bash
# Build the iOS app on Linux and upload it to TestFlight — no Mac.
# Uses ~/Projects/tools/omarchy-apple-dev/ship.sh: xtool build, Linux actool for the icon, signing with the
# team's Apple Distribution certificate, 41 offline App Store checks, upload through the App Store Connect API.
# The team's API key comes from ~/.appstoreconnect/tradejournal.env (outside the repo; it works for every app).
#
#   bash scripts/linux-testflight.sh           build + sign + validate + upload
#   bash scripts/linux-testflight.sh --check   build + sign + validate only
set -euo pipefail
cd "$(dirname "$0")/.."
SHIP="${SHIP:-$HOME/Projects/tools/omarchy-apple-dev/ship.sh}"
[[ -f "$SHIP" ]] || { echo "✗ ship.sh not found at $SHIP" >&2; exit 1; }

set -a
. <(sed "s#\$HOME#$HOME#g" "${ASC_ENV:-$HOME/.appstoreconnect/tradejournal.env}" | grep -E '^ASC_(KEY_ID|ISSUER_ID|KEY_PATH)=')
set +a
# The Darwin SDK installed here is the iOS 27.2 SDK from Xcode 27.2 (build 27B52).
export XCODE_VERSION="${XCODE_VERSION:-27.2}" XCODE_BUILD="${XCODE_BUILD:-27B52}"

rm -rf xtool
if [[ "${1:-}" == "--check" ]]; then echo | bash "$SHIP"; else echo | bash "$SHIP" --upload; fi
