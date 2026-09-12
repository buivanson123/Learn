#!/bin/sh
# Ghi một mục log cho commit vào log/YYYY-MM.md
#
#   .githooks/ghi-log.sh            -> ghi cho HEAD
#   .githooks/ghi-log.sh <commit>   -> ghi cho commit chỉ định (dùng khi nạp lại lịch sử cũ)
#
# Quy tắc:
#   - Commit chỉ sửa trong log/ thì bỏ qua (nếu không log sẽ tự sinh ra log của log, vô tận).
#   - Commit đã có trong file log thì bỏ qua, nên chạy lại nhiều lần không sinh mục trùng.
set -eu

ref=${1:-HEAD}
root=$(git rev-parse --show-toplevel)

full=$(git log -1 --format=%H "$ref")
short=$(git log -1 --format=%h "$ref")
when=$(git log -1 --format=%cd --date=format:'%Y-%m-%d %H:%M' "$ref")
month=$(git log -1 --format=%cd --date=format:'%Y-%m' "$ref")
subject=$(git log -1 --format=%s "$ref")
author=$(git log -1 --format=%an "$ref")
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')

# Thống kê file, loại thư mục log/ ra khỏi phép đếm
numstat=$(git show --numstat --format='' "$ref" -- . ':(exclude)log' || true)
[ -n "$numstat" ] || exit 0   # commit chỉ chứa log/ (hoặc rỗng) -> không ghi

f="$root/log/$month.md"
if [ ! -f "$f" ]; then
  mkdir -p "$root/log"
  {
    printf '# Log thay đổi — %s\n\n' "$month"
    printf 'Hook `.githooks/post-commit` tự ghi mỗi mục sau khi commit. Cách đọc và cách ghi tay:\n'
    printf '[log/README.md](./README.md). Thứ tự: cũ trước, mới sau.\n'
  } > "$f"
fi

# Đã ghi rồi thì thôi
if grep -q "$full" "$f" 2>/dev/null; then exit 0; fi

# Nếu mục cuối file trỏ tới một commit không còn nằm trong lịch sử (bạn vừa `--amend`
# hoặc rebase), mục đó đã lạc -> cắt bỏ trước khi ghi mục mới, tránh log hai lần một việc.
last=$(grep -o '<!-- [0-9a-f]\{40\} -->' "$f" 2>/dev/null | tail -1 | tr -cd '0-9a-f')
if [ -n "${last:-}" ] && ! git merge-base --is-ancestor "$last" "$ref" 2>/dev/null; then
  mark=$(grep -n "$last" "$f" | tail -1 | cut -d: -f1)
  cut=$(head -n "$mark" "$f" | grep -n '^---$' | tail -1 | cut -d: -f1)
  if [ -n "${cut:-}" ] && [ "$cut" -gt 2 ]; then
    tmp=$(mktemp)
    head -n $((cut - 2)) "$f" > "$tmp" && mv "$tmp" "$f"
  fi
fi

files=$(printf '%s\n' "$numstat" | grep -c '[^[:space:]]')
ins=$(printf '%s\n' "$numstat" | awk '$1 ~ /^[0-9]+$/ {s+=$1} END {print s+0}')
del=$(printf '%s\n' "$numstat" | awk '$2 ~ /^[0-9]+$/ {s+=$2} END {print s+0}')

{
  printf '\n---\n\n'
  printf '## %s — `%s` %s\n\n' "$when" "$short" "$subject"
  printf '%s file, +%s / −%s dòng · %s · nhánh `%s`\n\n' "$files" "$ins" "$del" "$author" "$branch"
  printf '%s\n' "$numstat" | awk 'NF {
      add = ($1 ~ /^[0-9]+$/) ? "+" $1 : "nhị phân"
      rem = ($2 ~ /^[0-9]+$/) ? " / −" $2 : ""
      path = $3
      for (i = 4; i <= NF; i++) path = path " " $i
      if (++n <= 25) printf "- `%s` %s%s\n", path, add, rem
    }
    END { if (n > 25) printf "- … và %d file nữa\n", n - 25 }'
  printf '\n<!-- %s -->\n' "$full"
} >> "$f"
