/**
 * Codex hook script (Python, stdlib only), served at /install/codex/baomemory_hook.py.
 * Kept free of backticks and template placeholders so it can live in String.raw.
 */
export const CODEX_HOOK_PY = String.raw`#!/usr/bin/env python3
"""baomemory hook for Codex: automatic recall and automatic archiving.

Events (wired in hooks.json):
  SessionStart      prints the memory digest as developer context
  UserPromptSubmit  searches memories related to the prompt and adds them as context;
                    buffers the prompt; the prompt "存档：..." archives right away
  Stop              buffers the reply; archives in the background once enough piles up
  SessionEnd        archives whatever is left, in the background

Archiving sends the buffered conversation to /v1/import/chat, where facts about the
user are extracted and remembered (dedupe applies). Standard library only.
Configuration: BAOMEMORY_API_KEY (env or the env file next to this script),
BAOMEMORY_URL, BAOMEMORY_MODE (direct or review).
"""
import json
import os
import pathlib
import subprocess
import sys
import time
import urllib.parse
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
STATE = HERE / "buffers"
ENV_FILE = HERE / "env"
FLUSH_AT = 6000          # buffered characters that trigger a background archive
CHUNK = 10000            # characters per extraction request (server limit 12000)
STALE_SECONDS = 2 * 3600  # buffers left behind by crashed sessions
REPLY_CLIP = 400         # only the user's words matter; replies are context
TRIGGERS = ("存档：", "存档:")
MIN_SIMILARITY = 0.5     # below this a hit is more noise than help


def setting(name, default=""):
    value = os.environ.get(name)
    if value:
        return value.strip()
    try:
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            if line.startswith(name + "="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    except OSError:
        pass
    return default


BASE = setting("BAOMEMORY_URL", "http://127.0.0.1:8787").rstrip("/")
MODE = setting("BAOMEMORY_MODE", "direct")


def call(method, path, body=None, timeout=8):
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={
            "authorization": "Bearer " + setting("BAOMEMORY_API_KEY"),
            "content-type": "application/json",
            "user-agent": "baomemory-codex-hook/1",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        raw = res.read().decode("utf-8")
    return json.loads(raw) if raw else {}


# ---------- buffer ----------

def buffer_path(session_id):
    safe = "".join(ch for ch in str(session_id) if ch.isalnum() or ch in "-_") or "default"
    return STATE / (safe + ".log")


def append(session_id, who, text):
    text = (text or "").strip()
    if not text:
        return 0
    if who == "AI" and len(text) > REPLY_CLIP:
        text = text[:REPLY_CLIP] + "…"
    STATE.mkdir(parents=True, exist_ok=True)
    path = buffer_path(session_id)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(who + ": " + text.replace("\r", "") + "\n")
    return path.stat().st_size


def chunks(text):
    out, buf = [], ""
    for line in text.splitlines(keepends=True):
        while len(line) > CHUNK:
            if buf:
                out.append(buf)
                buf = ""
            out.append(line[:CHUNK])
            line = line[CHUNK:]
        if len(buf) + len(line) > CHUNK:
            out.append(buf)
            buf = ""
        buf += line
    if buf.strip():
        out.append(buf)
    return out


def flush(path, title):
    """Claims the buffer by renaming it, sends it, and puts back what failed."""
    sending = path.with_suffix(".sending")
    try:
        path.rename(sending)
    except OSError:
        return
    text = sending.read_text(encoding="utf-8")
    pending = chunks(text)
    try:
        while pending:
            call(
                "POST",
                "/v1/import/chat",
                {
                    "transcript": pending[0],
                    "title": title,
                    "date": time.strftime("%Y-%m-%d"),
                    "source": "codex",
                    "mode": MODE,
                },
                timeout=60,
            )
            pending.pop(0)
    finally:
        if pending:
            with path.open("a", encoding="utf-8") as fh:
                fh.write("".join(pending))
        sending.unlink(missing_ok=True)


def spawn(*args):
    """Runs this script again, detached, so the hook returns at once."""
    subprocess.Popen(
        [sys.executable, str(pathlib.Path(__file__).resolve()), *args],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )


# ---------- events ----------

def on_session_start(event):
    if STATE.exists():
        spawn("flush-stale")
    try:
        digest = call("GET", "/v1/context", timeout=5).get("text", "").strip()
    except Exception:
        return
    if digest:
        print("用户的长期记忆摘要（来自 baomemory，用户现在说的优先）：\n" + digest)


def clip(text, limit):
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def recall_block(prompt):
    query = urllib.parse.urlencode({"q": prompt[:500], "limit": 6})
    items = call("GET", "/v1/memories/search?" + query, timeout=6).get("items", [])
    lines = [
        "- " + clip(m["content"], 300)
        for m in items
        if m.get("similarity", 0) >= MIN_SIMILARITY
    ][:5]
    if not lines:
        return ""
    return "可能相关的用户记忆（来自 baomemory，仅供参考，以用户当前说法为准）：\n" + "\n".join(lines)


def on_prompt(event):
    prompt = event.get("prompt") or ""
    sid = event.get("session_id") or "default"
    archive = any(t in prompt for t in TRIGGERS)
    spoken = prompt
    for t in TRIGGERS:
        spoken = spoken.replace(t, " ")
    append(sid, "用户", spoken)  # the trigger itself is not something to remember
    notes = []
    if archive:
        spawn("flush", sid, title_for(event))
        notes.append("用户的「存档：」口令已由 baomemory 钩子在后台处理：本段对话里值得记住的内容正在自动入库。你只需一句话确认，不用自己存。")
    if len(prompt.strip()) >= 4:
        try:
            block = recall_block(prompt)
        except Exception:
            block = ""
        if block:
            notes.append(block)
    if notes:
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": "\n\n".join(notes)}}, ensure_ascii=False))


def on_stop(event):
    sid = event.get("session_id") or "default"
    size = append(sid, "AI", event.get("last_assistant_message") or "")
    if size >= FLUSH_AT:
        spawn("flush", sid, title_for(event))
    print("{}")


def on_session_end(event):
    sid = event.get("session_id") or "default"
    if buffer_path(sid).exists():
        spawn("flush", sid, title_for(event))


def title_for(event):
    cwd = event.get("cwd") or ""
    return "Codex · " + (os.path.basename(cwd.rstrip("/\\")) or "chat")


def flush_stale():
    now = time.time()
    for path in STATE.glob("*.log"):
        if now - path.stat().st_mtime > STALE_SECONDS:
            flush(path, "Codex")


HANDLERS = {
    "SessionStart": on_session_start,
    "UserPromptSubmit": on_prompt,
    "Stop": on_stop,
    "SessionEnd": on_session_end,
}


def main():
    if len(sys.argv) > 1:
        if sys.argv[1] == "flush" and len(sys.argv) > 2:
            flush(buffer_path(sys.argv[2]), sys.argv[3] if len(sys.argv) > 3 else "Codex")
        elif sys.argv[1] == "flush-stale":
            flush_stale()
        elif sys.argv[1] == "check":
            print(json.dumps(call("GET", "/v1/memories?limit=1"), ensure_ascii=False)[:200])
        return
    try:
        event = json.load(sys.stdin)
    except ValueError:
        return
    handler = HANDLERS.get(event.get("hook_event_name"))
    if handler:
        try:
            handler(event)
        except Exception:
            # A memory hiccup must never break the coding session.
            if event.get("hook_event_name") == "Stop":
                print("{}")


if __name__ == "__main__":
    main()
`;
