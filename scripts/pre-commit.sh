#!/usr/bin/env bash
# Pre-commit hook FINPATHIA — corre en cada `git commit` antes de permitirlo.
#
# Bloquea el commit si:
#   1. audit.py falla (checks estructurales del repo).
#   2. Algún test de normalize falla.
#   3. Algún test de taxCO falla.
#   4. El snapshot del motor tributario cambió sin ser actualizado
#      explícitamente con `node scripts/snapshot_tax.mjs --update`.
#
# No corre `npm run build` acá porque es lento (~12s); confiamos que lo hacés
# manualmente antes de cada push (y el deploy lo valida igual).
#
# Instalación: bash scripts/install-hooks.sh
# Bypass puntual (NO recomendado): git commit --no-verify

set -e

# Solo corre si hay cambios en archivos que afectan el motor o sus tests.
# Para otros cambios (estilos, componentes UI sin tocar cálculo) no hace falta.
CHANGED=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || true)
TOUCHES_ENGINE=$(echo "$CHANGED" | grep -E '^(src/lib/(taxCO|fiscalCodes|normalize|ownerPlanAdapter|tablaArt241|alertasCore)\.js|src/components/Formulario(110|210)\.jsx|scripts/(verify_tax|verify_normalize|verify_adapter|verify_wizard_parity|verify_flujo_declaracion|snapshot_tax)\.mjs|tests/snapshots/)' || true)
TOUCHES_AUDIT=$(echo "$CHANGED" | grep -E '^(src/|audit\.py|package\.json)' || true)
TOUCHES_UI=$(echo "$CHANGED" | grep -E '^(src/(App|main)\.jsx|src/components/.+\.jsx)' || true)

echo ""
echo "🔍 FINPATHIA pre-commit checks..."

if [ -n "$TOUCHES_AUDIT" ]; then
  echo "  → audit.py"
  python3 audit.py > /tmp/fp_audit.log 2>&1 || { cat /tmp/fp_audit.log; echo "❌ audit.py falló"; exit 1; }
  tail -2 /tmp/fp_audit.log | head -1
fi

if [ -n "$TOUCHES_ENGINE" ]; then
  echo "  → verify_normalize.mjs"
  node scripts/verify_normalize.mjs > /tmp/fp_norm.log 2>&1 || { cat /tmp/fp_norm.log; echo "❌ verify_normalize falló"; exit 1; }
  tail -2 /tmp/fp_norm.log | head -1

  echo "  → verify_tax.mjs"
  node scripts/verify_tax.mjs > /tmp/fp_tax.log 2>&1 || { cat /tmp/fp_tax.log; echo "❌ verify_tax falló"; exit 1; }

  echo "  → verify_adapter.mjs"
  node scripts/verify_adapter.mjs > /tmp/fp_adap.log 2>&1 || { cat /tmp/fp_adap.log; echo "❌ verify_adapter falló"; exit 1; }
  tail -2 /tmp/fp_adap.log | head -1

  echo "  → verify_wizard_parity.mjs"
  node scripts/verify_wizard_parity.mjs > /tmp/fp_wiz.log 2>&1 || { cat /tmp/fp_wiz.log; echo "❌ verify_wizard_parity falló (wizard y motor divergen)"; exit 1; }
  tail -2 /tmp/fp_wiz.log | head -1

  echo "  → verify_flujo_declaracion.mjs"
  node scripts/verify_flujo_declaracion.mjs > /tmp/fp_flujo.log 2>&1 || { cat /tmp/fp_flujo.log; echo "❌ verify_flujo_declaracion falló (flujo e2e roto)"; exit 1; }
  tail -2 /tmp/fp_flujo.log | head -1

  echo "  → snapshot_tax.mjs"
  node scripts/snapshot_tax.mjs > /tmp/fp_snap.log 2>&1 || {
    cat /tmp/fp_snap.log
    echo ""
    echo "❌ El snapshot del motor tributario cambió."
    echo "   Si el cambio es intencional, corré:"
    echo "       node scripts/snapshot_tax.mjs --update"
    echo "   y agregá tests/snapshots/tax.json al commit con un mensaje que lo justifique."
    exit 1
  }
  tail -2 /tmp/fp_snap.log | head -1
fi

if [ -n "$TOUCHES_UI" ] && [ -d "node_modules/playwright" ]; then
  echo "  → test_page_load.mjs (Playwright UI test)"
  # Build + servir + probar con headless browser. CRÍTICO: atrapa
  # errores de runtime que rompen el arranque (como ReferenceError en JSX)
  # que no detectan los tests del motor ni el build.
  npm run build > /tmp/fp_build.log 2>&1 || { cat /tmp/fp_build.log; echo "❌ build falló"; exit 1; }
  pkill -f "python3 -m http.server 4173" 2>/dev/null || true
  sleep 1
  (cd dist && setsid python3 -m http.server 4173 </dev/null >/tmp/fp_srv.log 2>&1 &)
  sleep 3
  node scripts/test_page_load.mjs http://localhost:4173/ > /tmp/fp_load.log 2>&1
  LOAD_RC=$?
  pkill -f "python3 -m http.server 4173" 2>/dev/null || true
  if [ $LOAD_RC -ne 0 ]; then
    cat /tmp/fp_load.log
    echo ""
    echo "❌ test_page_load falló — la página no carga o tira errores de runtime."
    echo "   Revisá el output de arriba para identificar la causa."
    exit 1
  fi
  grep -E "PAGE ERRORS|✅ ninguno|body:" /tmp/fp_load.log | head -3
fi

echo "✅ OK — commit permitido"
echo ""