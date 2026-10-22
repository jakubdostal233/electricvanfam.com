#!/usr/bin/env bash
# fetch-fonts.sh - download the self-hosted OFL webfonts (woff2) used by the
# pers-ui gallery. Pulls only the weights the templates use, in the
# latin + latin-ext subsets (latin-ext covers Czech diacritics).
#
# Source: google-webfonts-helper (https://gwfh.mranftl.com) -> fonts.gstatic.com.
# Both families, Inter and JetBrains Mono, are SIL Open Font License 1.1; see
# fonts/OFL.txt.
#
# Standalone: needs only bash, curl, and python3. Safe to re-run - existing
# files are skipped unless --force is given. Nothing here depends on Claude.
#
# Usage:
#   ./fetch-fonts.sh            # download any missing font files
#   ./fetch-fonts.sh --force    # re-download everything, overwriting
#   ./fetch-fonts.sh --list     # show what would be downloaded, fetch nothing
#   ./fetch-fonts.sh --help     # this help
#
# After running, fonts/fonts.css (hand-maintained) references these files.

set -euo pipefail

API="https://gwfh.mranftl.com/api/fonts"
SUBSETS="latin,latin-ext"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# family_slug | gwfh_id | weight:style,weight:style,...
FONTS=(
  "inter|inter|400:normal,500:normal,600:normal,700:normal,400:italic"
  "jetbrains-mono|jetbrains-mono|400:normal,500:normal,700:normal"
)

FORCE=0
LIST=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --list) LIST=1 ;;
    -h|--help)
      sed -n '2,19p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "Unknown option: $arg (try --help)" >&2; exit 2 ;;
  esac
done

for spec in "${FONTS[@]}"; do
  IFS='|' read -r slug id variants <<< "$spec"
  mkdir -p "$HERE/$slug"
  json="$(curl -sSL --max-time 40 "$API/$id?subsets=$SUBSETS")"
  IFS=',' read -ra want <<< "$variants"
  for wv in "${want[@]}"; do
    IFS=':' read -r weight style <<< "$wv"
    suffix="$weight"; [ "$style" = "italic" ] && suffix="${weight}i"
    out="$HERE/$slug/${slug}-${suffix}.woff2"
    url="$(printf '%s' "$json" | python3 -c "
import sys, json
w, s = '$weight', '$style'
d = json.load(sys.stdin)
for v in d['variants']:
    if str(v.get('fontWeight')) == w and v.get('fontStyle') == s:
        print(v['woff2']); break
")"
    if [ -z "$url" ]; then
      echo "  ! no variant ${weight} ${style} for ${id}" >&2; continue
    fi
    if [ "$LIST" = "1" ]; then
      echo "  would fetch ${slug}-${suffix}.woff2  <- $url"; continue
    fi
    if [ "$FORCE" = "0" ] && [ -s "$out" ]; then
      echo "  skip  ${slug}/${slug}-${suffix}.woff2 (exists)"; continue
    fi
    curl -sSL --max-time 40 -o "$out" "$url"
    echo "  ok    ${slug}/${slug}-${suffix}.woff2 ($(du -h "$out" | cut -f1))"
  done
done

echo "Done. woff2 files are under $HERE/<family>/"
