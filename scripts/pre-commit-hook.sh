#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# Pre-commit hook — Higher-order Prompt-Design Principle gate
# ─────────────────────────────────────────────────────────────────────
# Installed: Bundle 0 (May 2026)
# Reference: execution-plan-v5.1.md, NarrativeContract V8-LOCKED §3.X
# Validated by: F2 + F8a + F17 + F18 templating quadruplet
#
# Compatibility: bash 3.2+ (macOS default shell)
#
# Principle:
#   No generation surface should rely on one canonical "RIGHT" example.
#   When examples are needed, include ≥3 structurally distinct examples
#   OR explicit anti-copy framing. Distinct = different syntactic frame,
#   not merely different domain nouns.
#
# Detector logic (V1):
#   For each candidate label, count same-category labels within ±25
#   lines (the local block). Flag UNLESS:
#     - The local block contains ≥3 same-category labels.
#     - Anti-copy framing appears in the surrounding ±15 lines.
#   WRONG/BAD pairing does NOT legitimize.
#
# Semantics:
#   WARN-on-existing — patterns at install time are recorded in
#     .prompt-gate-baseline.txt and grandfathered.
#   BLOCK-on-new — any new singular-canonical pattern blocks commit.
#     Override: git commit --no-verify
# ─────────────────────────────────────────────────────────────────────

# NOTE: do not use `set -u` — the hook handles missing inputs gracefully
# and `set -u` produces noisy false-positive failures on bash 3.2.
set -o pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO_ROOT" ]; then
  exit 0
fi

BASELINE_FILE="$REPO_ROOT/.prompt-gate-baseline.txt"

DISEASE_REGEX='RIGHT[[:space:]]*(summary|opening|opening:|\(|:)|Example[[:space:]]+shape:|Right[[:space:]]+way:|GOOD[[:space:]]+opening|GOOD[[:space:]]*\('
ANTICOPY_REGEX='do NOT copy|study these but|use as inspiration|illustrative only|non-canonical|anti-copy|do not template'
PROXIMITY_LINES=25

HASH_CMD=""
if command -v shasum >/dev/null 2>&1; then
  HASH_CMD="shasum -a 256"
elif command -v sha256sum >/dev/null 2>&1; then
  HASH_CMD="sha256sum"
else
  echo "prompt-gate: no sha256 utility found, skipping check" >&2
  exit 0
fi

classify() {
  line="$1"
  if echo "$line" | grep -qiE 'Example[[:space:]]+shape'; then
    echo "example_shape"
  elif echo "$line" | grep -qiE 'RIGHT'; then
    echo "right"
  elif echo "$line" | grep -qiE 'GOOD'; then
    echo "good"
  else
    echo "other"
  fi
}

category_pattern() {
  case "$1" in
    right) echo 'RIGHT[[:space:]]*(summary|opening|opening:|\(|:)|Right[[:space:]]+way:' ;;
    good)  echo 'GOOD[[:space:]]+opening|GOOD[[:space:]]*\(' ;;
    example_shape) echo 'Example[[:space:]]+shape:' ;;
    *) echo '' ;;
  esac
}

# Detect violations in a file's content.
# Args: $1 = file path. Reads content from stdin.
# Outputs: one line per violation, format: file|sig12|description
detect() {
  file="$1"
  content=$(cat)
  
  labels=$(echo "$content" | grep -nE "$DISEASE_REGEX" 2>/dev/null)
  if [ -z "$labels" ]; then
    return 0
  fi
  
  echo "$labels" | while IFS= read -r entry; do
    if [ -z "$entry" ]; then continue; fi
    
    lineno="${entry%%:*}"
    labelline="${entry#*:}"
    
    cat_kind=$(classify "$labelline")
    if [ "$cat_kind" = "other" ]; then continue; fi
    
    # Local block: ±PROXIMITY_LINES around this label
    if [ "$lineno" -gt "$PROXIMITY_LINES" ]; then
      block_start=$((lineno - PROXIMITY_LINES))
    else
      block_start=1
    fi
    block_end=$((lineno + PROXIMITY_LINES))
    block_content=$(echo "$content" | sed -n "${block_start},${block_end}p")
    
    cat_pattern=$(category_pattern "$cat_kind")
    local_count=$(echo "$block_content" | grep -cE "$cat_pattern" 2>/dev/null)
    if [ -z "$local_count" ]; then local_count=0; fi
    
    if [ "$local_count" -ge 3 ]; then continue; fi
    
    # Anti-copy framing in ±15 lines?
    if [ "$lineno" -gt 15 ]; then
      ac_start=$((lineno - 15))
    else
      ac_start=1
    fi
    ac_end=$((lineno + 15))
    ac_context=$(echo "$content" | sed -n "${ac_start},${ac_end}p")
    
    if echo "$ac_context" | grep -qiE "$ANTICOPY_REGEX"; then
      continue
    fi
    
    # Violation: signature = first 12 chars of sha256(file|normalized)
    norm=$(echo "$labelline" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr -s ' ')
    sig=$(printf '%s|%s' "$file" "$norm" | $HASH_CMD | awk '{print $1}' | cut -c1-12)
    desc_short=$(echo "$norm" | cut -c1-100)
    echo "${file}|${sig}|line ${lineno}: ${desc_short}"
  done
}

# Collect staged prompt files
PROMPT_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -E '(^|/)prompt(-[a-z0-9]+)?\.js$')
if [ -z "$PROMPT_FILES" ]; then
  exit 0
fi

# Load baseline into a flat newline-separated list of "file|sig" keys
BASELINE_KEYS=""
if [ -f "$BASELINE_FILE" ]; then
  BASELINE_KEYS=$(grep -vE '^[[:space:]]*(#|$)' "$BASELINE_FILE" | awk -F'|' '{print $1"|"$2}')
fi

# Collect detection results across all staged prompt files
ALL_DETECTIONS=""
for f in $PROMPT_FILES; do
  staged_content=$(git show ":$f" 2>/dev/null)
  if [ -z "$staged_content" ]; then continue; fi
  
  detections=$(echo "$staged_content" | detect "$f")
  if [ -z "$detections" ]; then continue; fi
  
  ALL_DETECTIONS="${ALL_DETECTIONS}${detections}
"
done

if [ -z "$ALL_DETECTIONS" ]; then
  exit 0
fi

# Split into NEW vs EXISTING
NEW_VIOLATIONS=""
EXISTING_COUNT=0

# Use printf to feed lines safely
printf '%s' "$ALL_DETECTIONS" | while IFS= read -r v; do
  if [ -z "$v" ]; then continue; fi
  echo "$v"
done > /tmp/.prompt-gate-detections.$$

while IFS= read -r v; do
  if [ -z "$v" ]; then continue; fi
  file_part=$(echo "$v" | awk -F'|' '{print $1}')
  sig_part=$(echo "$v" | awk -F'|' '{print $2}')
  key="${file_part}|${sig_part}"
  
  if echo "$BASELINE_KEYS" | grep -Fxq "$key"; then
    EXISTING_COUNT=$((EXISTING_COUNT + 1))
  else
    NEW_VIOLATIONS="${NEW_VIOLATIONS}${v}
"
  fi
done < /tmp/.prompt-gate-detections.$$

rm -f /tmp/.prompt-gate-detections.$$

# Report
if [ -n "$NEW_VIOLATIONS" ]; then
  echo "" >&2
  echo "❌ COMMIT BLOCKED — Higher-order Prompt-Design Principle gate" >&2
  echo "" >&2
  echo "New singular-canonical example pattern(s) detected." >&2
  echo "Per V4S29 V8 methodology amendment (validated by F2/F8a/F17/F18):" >&2
  echo "  - ≥3 structurally distinct examples OR explicit anti-copy framing" >&2
  echo "  - Distinct = different syntactic frame, not different domain nouns" >&2
  echo "  - WRONG/BAD pairing does not legitimize a singular RIGHT" >&2
  echo "" >&2
  echo "Locations:" >&2
  printf '%s' "$NEW_VIOLATIONS" | while IFS= read -r v; do
    if [ -z "$v" ]; then continue; fi
    file_part=$(echo "$v" | awk -F'|' '{print $1}')
    desc_part=$(echo "$v" | awk -F'|' '{for (i=3; i<=NF; i++) printf "%s%s", $i, (i<NF?"|":""); print ""}')
    echo "  $file_part — $desc_part" >&2
  done
  echo "" >&2
  echo "Resolutions:" >&2
  echo "  1. Add ≥2 more structurally distinct example variants alongside this one." >&2
  echo "  2. Add explicit anti-copy framing nearby (e.g. \"do NOT copy these word-for-word\")." >&2
  echo "  3. If intentional and a downstream gate handles it: git commit --no-verify" >&2
  echo "  4. If this should be grandfathered: append the file|sig|desc line" >&2
  echo "     to .prompt-gate-baseline.txt and re-commit." >&2
  echo "" >&2
  exit 1
fi

if [ "$EXISTING_COUNT" -gt 0 ]; then
  echo "ℹ️  prompt-gate: $EXISTING_COUNT grandfathered pattern(s) in staged files (scheduled for fix in Bundle 4 / Bundle 6)." >&2
fi

exit 0
