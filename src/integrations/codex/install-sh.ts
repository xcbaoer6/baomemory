/**
 * One-line installer for the Codex hooks (macOS / Linux):
 *   curl -fsSL <origin>/install/codex.sh | sh
 * Installs the hook script, asks for the API key on the terminal (never echoed,
 * stored mode 600), and merges four entries into ~/.codex/hooks.json.
 * __BASE__ is replaced with the serving origin.
 */
export const CODEX_INSTALL_SH = String.raw`#!/bin/sh
# baomemory · Codex 自动记忆钩子安装器
set -eu
BASE="__BASE__"
CODEX_DIR=$(printenv CODEX_HOME || echo "$HOME/.codex")
DIR="$CODEX_DIR/baomemory"

command -v python3 >/dev/null 2>&1 || { echo "需要 python3，先装一下再来"; exit 1; }
mkdir -p "$DIR"
curl -fsSL "$BASE/install/codex/baomemory_hook.py" -o "$DIR/baomemory_hook.py"

if [ ! -s "$DIR/env" ]; then
  printf '粘贴 baomemory 的 API_KEY 后回车（输入不显示）：' > /dev/tty
  stty -echo < /dev/tty
  IFS= read -r KEY < /dev/tty
  stty echo < /dev/tty
  printf '\n' > /dev/tty
  umask 077
  printf 'BAOMEMORY_API_KEY=%s\nBAOMEMORY_URL=%s\nBAOMEMORY_MODE=direct\n' "$KEY" "$BASE" > "$DIR/env"
fi

python3 - "$CODEX_DIR/hooks.json" "$DIR/baomemory_hook.py" <<'PY'
import json, os, shutil, sys
path, script = sys.argv[1], sys.argv[2]
command = 'python3 "' + script + '"'
try:
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    shutil.copy(path, path + ".bak")
except FileNotFoundError:
    data = {}
hooks = data.setdefault("hooks", {})
timeouts = {"SessionStart": 8, "UserPromptSubmit": 8, "Stop": 5, "SessionEnd": 3}
for event, timeout in timeouts.items():
    groups = [
        g for g in hooks.get(event, [])
        if not any("baomemory_hook.py" in h.get("command", "") for h in g.get("hooks", []))
    ]
    groups.append({"hooks": [{"type": "command", "command": command, "timeout": timeout}]})
    hooks[event] = groups
with open(path, "w", encoding="utf-8") as fh:
    json.dump(data, fh, ensure_ascii=False, indent=2)
PY

if python3 "$DIR/baomemory_hook.py" check >/dev/null 2>&1; then
  echo "✅ 装好了，连接正常"
else
  echo "⚠️ 钩子装好了，但连不上记忆库。检查 $DIR/env 里的 API_KEY"
fi
echo "最后一步：打开 Codex，输入 /hooks，把 baomemory 的 4 个钩子设为信任。"
`;
