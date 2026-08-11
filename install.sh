#!/usr/bin/env sh
# Crow installer (POSIX sh — Linux, macOS, and Git Bash).
#
#   curl -fsSL https://raw.githubusercontent.com/Hydr46605/Crow/main/install.sh | sh
#
# Clones the repo, builds it, links the `crow` command into a bin directory on
# your PATH, then starts the setup wizard. Pass --no-setup to skip the wizard.
set -eu

REPO_URL="https://github.com/Hydr46605/Crow.git"
CROW_INSTALL_DIR="${CROW_INSTALL_DIR:-$HOME/.crow/app}"
CROW_BIN_DIR="${CROW_BIN_DIR:-$HOME/.local/bin}"
RUN_SETUP=1

usage() {
  cat <<'EOF'
Usage: install.sh [--no-setup]

Installs Crow to ~/.crow/app and links `crow` into ~/.local/bin.
  --no-setup  Skip the interactive setup wizard after installing.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --no-setup) RUN_SETUP=0 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

fail() {
  echo "✗ $1" >&2
  exit 1
}

command -v git  >/dev/null 2>&1 || fail "Missing required command: git"
command -v node >/dev/null 2>&1 || fail "Missing required command: node"
command -v npm  >/dev/null 2>&1 || fail "Missing required command: npm"

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
[ "$NODE_MAJOR" -ge 22 ] || fail "Crow requires Node.js >= 22 (found: $(node -v))."

echo "» Installing Crow..."

if [ -d "$CROW_INSTALL_DIR/.git" ]; then
  echo "Updating existing install at $CROW_INSTALL_DIR"
  git -C "$CROW_INSTALL_DIR" fetch --depth 1 origin main
  git -C "$CROW_INSTALL_DIR" reset --hard origin/main
else
  mkdir -p "$(dirname "$CROW_INSTALL_DIR")"
  git clone --depth 1 "$REPO_URL" "$CROW_INSTALL_DIR"
fi

cd "$CROW_INSTALL_DIR"
npm ci
npm run build

mkdir -p "$CROW_BIN_DIR"
CROW_LAUNCHER="$CROW_BIN_DIR/crow"
cat > "$CROW_LAUNCHER" <<EOF
#!/usr/bin/env sh
exec node "$CROW_INSTALL_DIR/dist/index.js" "\$@"
EOF
chmod +x "$CROW_LAUNCHER"

echo "✓ Installed. The \`crow\` command is at $CROW_LAUNCHER"

case ":$PATH:" in
  *":$CROW_BIN_DIR:"*) ;;
  *) echo "Add $CROW_BIN_DIR to your PATH: export PATH=\"$CROW_BIN_DIR:\$PATH\"" ;;
esac

if [ "$RUN_SETUP" = 1 ]; then
  echo ""
  "$CROW_LAUNCHER" setup
fi

echo ""
echo "Done. Run \`crow doctor\` to verify, and point your MCP client at \`crow\`."
