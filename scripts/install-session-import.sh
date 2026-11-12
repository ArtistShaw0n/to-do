#!/usr/bin/env bash
# Run the Claude Code session importer every hour, at five past, with launchd.
#
#   bash scripts/install-session-import.sh            # install (or reinstall) and start
#   bash scripts/install-session-import.sh --uninstall
#
# A Mac that is asleep on the hour runs it when it wakes; one that is off runs
# it at the next hour, and that run picks up everything since the last.
set -euo pipefail

LABEL="com.shawon.vault.session-import"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node)"
LOGDIR="$HOME/Library/Logs/Vault"

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Removed. Nothing will run on the hour any more."
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents" "$LOGDIR"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$REPO/scripts/sessions-to-tasks.mjs</string>
    <string>--apply</string>
    <string>--quiet</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>StartCalendarInterval</key><dict><key>Minute</key><integer>5</integer></dict>
  <key>StandardOutPath</key><string>$LOGDIR/session-import.log</string>
  <key>StandardErrorPath</key><string>$LOGDIR/session-import.log</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$(dirname "$NODE"):/usr/bin:/bin</string></dict>
</dict>
</plist>
PL

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed: runs every hour at :05. Log: $LOGDIR/session-import.log"
