set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Installing dependencies..."
npm install

echo "Building Linux AppImage..."
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run build:linux

echo "Done. Output is in dist/"
ls dist/*.AppImage dist/*.zip 2>/dev/null || ls dist/