# Codex 自动记忆（钩子）

装好后在 Codex（CLI、桌面 App、IDE 插件共用 `~/.codex`）里全自动：

| 时机 | 做什么 |
|---|---|
| 会话开始 | 把核心摘要塞进上下文 |
| 每次提问前 | 按问题语义搜相关记忆（相似度 ≥ 0.5，最多 5 条）塞进上下文 |
| 每轮结束 | 对话缓存在本地，攒够约 6000 字后台自动存档 |
| 会话结束 | 剩下的后台存档 |
| 说「存档：」 | 立刻把本段对话存档 |

存档 = 把对话发到 `/v1/import/chat`，由模型提取关于你的长期事实，默认直接入库（自动去重）。
想先审核再入库：把 `~/.codex/baomemory/env` 里的 `BAOMEMORY_MODE` 改成 `review`。

## 安装（macOS / Linux）

```sh
curl -fsSL https://<your-worker>.workers.dev/install/codex.sh | sh
```

按提示粘贴 API_KEY（不显示，保存为 600 权限文件），然后在 Codex 里输入 `/hooks`，把 4 个 baomemory 钩子设为信任。

## 卸载

删掉 `~/.codex/hooks.json` 里含 `baomemory_hook.py` 的 4 段（安装前的版本在 `hooks.json.bak`），再删 `~/.codex/baomemory/`。

记忆库连不上时钩子会静默跳过，不影响写代码。
