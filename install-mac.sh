set -e

LABEL="com.myspace.desktop"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

if [[ "$1" == "--remove" ]]; then
  if launchctl list "$LABEL" &>/dev/null 2>&1; then
    launchctl unload "$PLIST" 2>/dev/null || true
  fi
  rm -f "$PLIST"
  echo "My Space removed from login items."
  exit 0
fi

APP_PATH="${1:-/Applications/My Space.app}"
if [[ ! -d "$APP_PATH" ]]; then
  echo "My Space.app not found at: $APP_PATH"
  echo "Usage: ./install-mac.sh [/path/to/My Space.app]"
  echo "Build the app first with: npm run build:mac"
  exit 1
fi

EXEC="$APP_PATH/Contents/MacOS/My Space"
if [[ ! -f "$EXEC" ]]; then
  # Try to find the actual binary name inside Contents/MacOS
  EXEC=$(find "$APP_PATH/Contents/MacOS" -type f -maxdepth 1 | head -1)
fi
if [[ -z "$EXEC" || ! -f "$EXEC" ]]; then
  echo "Could not find executable inside $APP_PATH"
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${EXEC}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>/tmp/myspace-startup.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/myspace-startup.log</string>
</dict>
</plist>
PLIST_EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "Registered: $EXEC"
echo "My Space will launch automatically at next login."
echo "To remove: ./install-mac.sh --remove"