set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Installing dependencies..."
npm install

echo ""
echo "Building macOS app..."
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run build:mac53

echo ""
echo "Done! Output is in the dist/ folder:"
ls dist/*.dmg dist/*.zip 2>/dev/null || ls dist/