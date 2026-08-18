#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

command -v supabase >/dev/null 2>&1 || {
  echo "Supabase CLI is required." >&2
  exit 1
}

history="$(supabase migration list --linked)"
printf '%s\n' "$history"

missing=0

while IFS= read -r migration; do
  version="${migration##*/}"
  version="${version%%_*}"

  if ! printf '%s\n' "$history" | grep -Eq "^[[:space:]]*${version}[[:space:]]*\|[[:space:]]*${version}([[:space:]]*\||[[:space:]]*$)"; then
    echo "Migration ${version} is not present in both local and linked histories." >&2
    missing=1
  fi
done < <(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | sort)

if (( missing != 0 )); then
  echo "The linked Supabase schema is behind the repository. Run the guarded apply workflow." >&2
  if ! printf '%s\n' "$history" | grep -Eq "${version}"; then
    echo "Migration ${version} is not present in linked history." >&2
    missing=1
  fi

done < <(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | sort)

if (( missing != 0 )); then
  echo "The linked Supabase schema is behind the repository." >&2
  exit 1
fi

echo "All repository migrations are applied to the linked Supabase project."
