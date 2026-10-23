#!/bin/sh
# 在獨立下載的專案資料夾啟動，不需要其他練習或共用 launcher。
PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P) || exit 1
cd "$PROJECT_DIR" || exit 1
printf '%s\n' '請在瀏覽器開啟 http://127.0.0.1:5230/，按 Control+C 停止。'
exec python3 -m http.server 5230 --bind 127.0.0.1
