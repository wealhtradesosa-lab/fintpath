#!/usr/bin/env bash
# Instala los git hooks de FINPATHIA en .git/hooks/
# Corré una vez después de clonar el repo: bash scripts/install-hooks.sh

set -e

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO_ROOT" ]; then
  echo "❌ No estás en un repo git"
  exit 1
fi

HOOK_DIR="$REPO_ROOT/.git/hooks"
mkdir -p "$HOOK_DIR"

# Usamos un shim que llama al script versionado en scripts/ — así los cambios
# al hook se versionan y se aplican a todo el equipo sin reinstalar.
cat > "$HOOK_DIR/pre-commit" <<'EOF'
#!/usr/bin/env bash
REPO_ROOT=$(git rev-parse --show-toplevel)
exec bash "$REPO_ROOT/scripts/pre-commit.sh"
EOF
chmod +x "$HOOK_DIR/pre-commit"
chmod +x "$REPO_ROOT/scripts/pre-commit.sh"

echo "✅ Pre-commit hook instalado en $HOOK_DIR/pre-commit"
echo "   Apunta a: scripts/pre-commit.sh (versionado)"
echo ""
echo "Para bypassear puntualmente: git commit --no-verify"
