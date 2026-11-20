export const STYLES = `
:root { --bg:#f7f7f5; --card:#fff; --ink:#1d1d1f; --mute:#6e6e73; --line:#e5e5ea; --accent:#3b5bdb; --danger:#c92a2a; --ok:#2b8a3e; }
@media (prefers-color-scheme: dark) { :root { --bg:#111214; --card:#1b1c1f; --ink:#ececf1; --mute:#9a9aa3; --line:#2c2d31; --accent:#748ffc; --danger:#ff8787; --ok:#69db7c; } }
* { box-sizing: border-box; }
body { margin:0; font:15px/1.55 -apple-system, "PingFang SC", "Noto Sans SC", system-ui, sans-serif; background:var(--bg); color:var(--ink); }
main { max-width: 920px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 22px; margin: 0 0 16px; }
h2 { font-size: 16px; margin: 0 0 8px; }
.row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
input, select, textarea, button { font: inherit; color: inherit; }
input, select, textarea { background: var(--card); border:1px solid var(--line); border-radius:8px; padding:8px 10px; }
textarea { width:100%; min-height:84px; resize: vertical; }
button { border:1px solid var(--line); background:var(--card); border-radius:8px; padding:7px 12px; cursor:pointer; }
button.primary { background: var(--accent); border-color: var(--accent); color:#fff; }
button.danger { color: var(--danger); }
button:disabled { opacity:.5; cursor: default; }
nav { display:flex; gap:6px; margin-bottom: 14px; border-bottom:1px solid var(--line); }
nav button { border:none; border-bottom:2px solid transparent; border-radius:0; background:none; padding:8px 12px; }
nav button.on { border-bottom-color: var(--accent); color: var(--accent); }
.tabs button.on { border-color: var(--accent); color: var(--accent); }
.card { background: var(--card); border:1px solid var(--line); border-radius:12px; padding:14px; margin-top:12px; }
.meta { color: var(--mute); font-size: 13px; margin-top: 6px; }
.tag { display:inline-block; background: var(--bg); border:1px solid var(--line); border-radius: 999px; padding: 0 8px; margin-right:4px; font-size:12px; }
.content { white-space: pre-wrap; word-break: break-word; }
.grow { flex: 1 1 220px; }
.hidden { display:none !important; }
.masked { -webkit-text-security: disc; }
.ok { color: var(--ok); }
.err { color: var(--danger); }
progress { width: 100%; height: 10px; }
.cand { display:flex; gap:10px; align-items:flex-start; }
.cand textarea { min-height: 48px; }
#toast { position: fixed; left:50%; bottom: 24px; transform: translateX(-50%); background: var(--ink); color: var(--bg); padding: 8px 14px; border-radius: 8px; font-size:14px; max-width: 90vw; }
label { font-size: 13px; color: var(--mute); }
`;
