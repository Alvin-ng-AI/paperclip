#!/bin/bash
# CLAWD OS — Import all n8n workflows
# Run this once to load all workflows into n8n.
# Requires: n8n running on port 5678

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Importing CLAWD OS n8n workflows..."

for f in "$SCRIPT_DIR"/*.json; do
  name=$(python3 -c "import json; print(json.load(open('$f'))['name'])" 2>/dev/null || echo "$f")
  echo "  → Importing: $name"
  n8n import:workflow --input="$f" 2>/dev/null && echo "    ✓ Imported" || echo "    ✗ Failed (n8n must be running)"
done

echo ""
echo "Done. Open n8n at http://178.128.212.222:5678 to:"
echo "  1. Set credentials (META_ACCESS_TOKEN, SHOPIFY_ACCESS_TOKEN, BRAVE_SEARCH_API_KEY)"
echo "  2. Activate Meta Ads Alert and Shopify Daily Feed workflows"
echo "  3. Web Search workflow activates automatically (no credentials needed after BRAVE key set)"
