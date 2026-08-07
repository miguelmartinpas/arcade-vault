#!/bin/bash
f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -z "$f" ] && exit 0
[ -f "$f" ] || exit 0

case "$f" in
  *.jsx|*.tsx|*.js|*.ts)
    npx --no-install prettier --write "$f" >/dev/null 2>&1
    lint_out=$(npx --no-install eslint --fix "$f" 2>&1)
    status=$?
    if [ "$status" -ne 0 ]; then
      msg=$(printf '%s' "$lint_out" | jq -Rs .)
      printf '{"systemMessage": %s}\n' "$msg"
    fi
    ;;
  *.md|*.mdx)
    npx --no-install prettier --write "$f" >/dev/null 2>&1
    ;;
esac
exit 0
