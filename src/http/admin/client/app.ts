/**
 * Admin page behaviour, shipped as plain JS source (no backticks / placeholders,
 * so it can live in String.raw). Talks only to the authenticated /v1 API.
 * Handlers are bound with addEventListener: an on* handler that returns false
 * cancels the event, which once swallowed every keystroke in the key field.
 */
export const APP_JS = String.raw`
(function () {
  var KINDS = { fact:'事实', preference:'偏好', decision:'决定', project:'项目', person:'人物', event:'事件', note:'笔记' };
  var TIERS = { 1:'核心', 2:'活跃', 3:'归档' };
  var CHUNK = 6000;
  var $ = function (id) { return document.getElementById(id); };
  var on = function (el, ev, fn) { el.addEventListener(ev, fn); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]; }); };
  var state = { key: sessionStorage.getItem('bm_key') || '', tier: '', items: [], cands: [], chunks: [], running: false };

  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.add('hidden'); }, 2800); }

  function api(path, opts) {
    opts = opts || {};
    return fetch('/v1' + path, {
      method: opts.method || 'GET',
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      headers: { authorization: 'Bearer ' + state.key, 'content-type': 'application/json' }
    }).then(function (res) {
      if (res.status === 401) { logout(); throw new Error('密钥不对'); }
      if (opts.raw) { if (!res.ok) throw new Error('请求失败 ' + res.status); return res; }
      if (res.status === 204) return null;
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) throw new Error((body && body.error && body.error.message) || ('请求失败 ' + res.status));
        return body;
      });
    });
  }

  function showApp(yes) { $('login').classList.toggle('hidden', yes); $('app').classList.toggle('hidden', !yes); }
  function logout() { sessionStorage.removeItem('bm_key'); state.key = ''; showApp(false); }
  function login() {
    state.key = $('key').value.trim();
    if (!state.key) return;
    api('/memories?limit=1').then(function () {
      sessionStorage.setItem('bm_key', state.key); $('key').value = ''; showApp(true); loadMemories(); refreshReviewCount();
    }).catch(function (e) { toast(e.message); });
  }

  function switchView(name) {
    document.querySelectorAll('nav button[data-view]').forEach(function (b) { b.classList.toggle('on', b.dataset.view === name); });
    ['memories', 'review', 'io'].forEach(function (v) { $('view-' + v).classList.toggle('hidden', v !== name); });
    if (name === 'review') loadReview();
  }

  // ---------- memories ----------
  function memoryCard(m, scored) {
    return '<div class="card" data-id="' + esc(m.id) + '">' +
      '<div class="content">' + esc(m.content) + '</div>' +
      '<div class="meta">' + esc(KINDS[m.kind] || m.kind) + ' · ' + esc(TIERS[m.tier]) + ' · 重要度 ' + esc(m.importance) +
        (scored ? ' · 相关度 ' + Number(m.score).toFixed(2) : '') +
        ' · 更新于 ' + esc(new Date(m.updatedAt).toLocaleString('zh-CN')) +
        (m.source ? ' · 来源 ' + esc(m.source) : '') + '</div>' +
      '<div class="meta">' + (m.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
      '<div class="row" style="margin-top:8px"><button data-act="edit">编辑</button><button data-act="del" class="danger">删除</button></div>' +
    '</div>';
  }

  function renderMemories(items, scored) {
    state.items = items;
    $('count').textContent = items.length + ' 条';
    $('list').innerHTML = items.length ? items.map(function (m) { return memoryCard(m, scored); }).join('') : '<div class="card meta">这里还没有记忆。</div>';
  }

  function loadMemories() {
    document.querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tier === state.tier); });
    api('/memories?limit=200' + (state.tier ? '&tier=' + state.tier : ''))
      .then(function (r) { renderMemories(r.items, false); }).catch(function (e) { toast(e.message); });
  }

  function search() {
    var q = $('q').value.trim();
    if (!q) return loadMemories();
    api('/memories/search?limit=30&archived=true&q=' + encodeURIComponent(q))
      .then(function (r) { renderMemories(r.items, true); }).catch(function (e) { toast(e.message); });
  }

  function options(map, cur) {
    return Object.keys(map).map(function (v) { return '<option value="' + v + '"' + (String(cur) === v ? ' selected' : '') + '>' + map[v] + '</option>'; }).join('');
  }

  function openEditor(m) {
    var ed = $('editor');
    ed.innerHTML =
      '<textarea id="edContent" maxlength="4000" placeholder="记忆内容">' + esc(m && m.content) + '</textarea>' +
      '<div class="row" style="margin-top:8px">' +
        '<label>类型 <select id="edKind">' + options(KINDS, (m && m.kind) || 'fact') + '</select></label>' +
        '<label>层级 <select id="edTier">' + options(m ? TIERS : { 1:'核心', 2:'活跃' }, (m && m.tier) || 2) + '</select></label>' +
        '<label>重要度 <select id="edImp">' + options({ 1:'1', 2:'2', 3:'3', 4:'4', 5:'5' }, (m && m.importance) || 3) + '</select></label>' +
        '<input id="edTags" class="grow" placeholder="标签，用逗号分隔" value="' + esc(((m && m.tags) || []).join(', ')) + '" />' +
      '</div>' +
      '<div class="row" style="margin-top:10px"><button class="primary" id="edSave">' + (m ? '保存' : '新增') + '</button><button id="edCancel">取消</button></div>';
    ed.classList.remove('hidden');
    ed.scrollIntoView({ behavior: 'smooth', block: 'center' });
    on($('edCancel'), 'click', function () { ed.classList.add('hidden'); });
    on($('edSave'), 'click', function () {
      var body = {
        content: $('edContent').value.trim(),
        kind: $('edKind').value,
        tier: Number($('edTier').value),
        importance: Number($('edImp').value),
        tags: $('edTags').value.split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean)
      };
      if (!body.content) return toast('内容不能为空');
      $('edSave').disabled = true;
      var req = m ? api('/memories/' + m.id, { method: 'PATCH', body: body })
                  : api('/memories', { method: 'POST', body: Object.assign({ source: 'admin' }, body) });
      req.then(function (r) {
        toast(m ? '已保存' : (r.action === 'merged' ? '已合并到相似记忆' : '已新增'));
        ed.classList.add('hidden');
        if ($('q').value) search(); else loadMemories();
      }).catch(function (e) { toast(e.message); $('edSave').disabled = false; });
    });
  }

  // ---------- review ----------
  function refreshReviewCount() {
    api('/candidates?limit=1').then(function (r) { $('reviewCount').textContent = r.total ? '(' + r.total + ')' : ''; }).catch(function () {});
  }

  function loadReview() {
    api('/candidates?limit=200').then(function (r) {
      state.cands = r.items;
      $('reviewCount').textContent = r.total ? '(' + r.total + ')' : '';
      $('reviewMeta').textContent = r.total > r.items.length ? '共 ' + r.total + ' 条，显示最新 ' + r.items.length + ' 条' : (r.total ? '共 ' + r.total + ' 条' : '');
      $('candList').innerHTML = r.items.length ? r.items.map(function (c) {
        return '<div class="card cand" data-id="' + esc(c.id) + '">' +
          '<input type="checkbox" class="pick" />' +
          '<div class="grow">' +
            '<textarea class="cText" maxlength="4000">' + esc(c.content) + '</textarea>' +
            '<div class="row" style="margin-top:6px">' +
              '<select class="cKind">' + options(KINDS, c.kind) + '</select>' +
              '<select class="cImp">' + options({ 1:'1', 2:'2', 3:'3', 4:'4', 5:'5' }, c.importance) + '</select>' +
              '<input class="cTags grow" value="' + esc(c.tags.join(', ')) + '" placeholder="标签" />' +
            '</div>' +
            '<div class="meta">' + (c.source ? '来源 ' + esc(c.source) : '') + (c.evidence ? ' · 原话：' + esc(c.evidence) : '') + '</div>' +
          '</div>' +
        '</div>';
      }).join('') : '<div class="card meta">没有待审核的候选。</div>';
    }).catch(function (e) { toast(e.message); });
  }

  function picked() {
    return Array.prototype.slice.call(document.querySelectorAll('#candList .cand')).filter(function (el) { return el.querySelector('.pick').checked; });
  }

  function approve() {
    var els = picked();
    if (!els.length) return toast('先勾选要记住的候选');
    var edits = {};
    var ids = els.map(function (el) {
      var id = el.dataset.id;
      var c = state.cands.find(function (x) { return x.id === id; });
      var e = {
        content: el.querySelector('.cText').value.trim(),
        kind: el.querySelector('.cKind').value,
        importance: Number(el.querySelector('.cImp').value),
        tags: el.querySelector('.cTags').value.split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean)
      };
      if (c && (e.content !== c.content || e.kind !== c.kind || e.importance !== c.importance || e.tags.join() !== c.tags.join())) edits[id] = e;
      return id;
    });
    $('approveBtn').disabled = true;
    api('/candidates/approve', { method: 'POST', body: { ids: ids, edits: edits } }).then(function (r) {
      toast('新增 ' + r.created + ' 条，合并 ' + r.merged + ' 条' + (r.failed.length ? '，' + r.failed.length + ' 条被拒（疑似敏感信息）' : ''));
      loadReview();
    }).catch(function (e) { toast(e.message); }).then(function () { $('approveBtn').disabled = false; });
  }

  function reject() {
    var ids = picked().map(function (el) { return el.dataset.id; });
    if (!ids.length) return toast('先勾选要丢弃的候选');
    if (!confirm('丢弃选中的 ' + ids.length + ' 条候选？')) return;
    api('/candidates/reject', { method: 'POST', body: { ids: ids } }).then(function (r) { toast('已丢弃 ' + r.removed + ' 条'); loadReview(); }).catch(function (e) { toast(e.message); });
  }

  // ---------- import / export ----------
  function download(format) {
    api('/export?format=' + format, { raw: true }).then(function (res) { return res.blob(); }).then(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'baomemory-' + new Date().toISOString().slice(0, 10) + '.' + format;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }).catch(function (e) { toast(e.message); });
  }

  function importEntries() {
    var text = $('entriesText').value.trim();
    if (!text) return toast('先粘贴要导入的内容');
    var mode = document.querySelector('input[name=entriesMode]:checked').value;
    $('entriesBtn').disabled = true;
    api('/import/entries', { method: 'POST', body: { text: text, mode: mode, source: 'import' } }).then(function (r) {
      var parts = ['识别 ' + r.parsed + ' 条'];
      if (mode === 'review') parts.push('进审核 ' + r.queued + ' 条'); else parts.push('新增 ' + r.created + ' 条', '合并 ' + r.merged + ' 条');
      if (r.rejected.length) parts.push('拦下 ' + r.rejected.length + ' 条疑似敏感信息');
      $('entriesMeta').textContent = parts.join('，');
      if (mode === 'review') refreshReviewCount();
      $('entriesText').value = '';
    }).catch(function (e) { toast(e.message); }).then(function () { $('entriesBtn').disabled = false; });
  }

  function progressKey() { var f = $('chatFile').files[0]; return f ? 'bm_import:' + f.name + ':' + f.size : ''; }

  function onFile() {
    var f = $('chatFile').files[0];
    state.chunks = [];
    $('chatStart').disabled = true;
    if (!f) return;
    $('chatInfo').textContent = '正在读取 ' + f.name + ' …';
    f.text().then(function (raw) {
      var parsed = BMParsers.parseExport(raw, f.name.replace(/\.[^.]+$/, ''));
      state.chunks = BMParsers.toChunks(parsed.conversations, CHUNK);
      var done = Number(localStorage.getItem(progressKey()) || 0);
      var label = { chatgpt: 'ChatGPT', claude: 'Claude', jsonl: 'JSONL', text: '纯文本', unknown: '未知格式' }[parsed.kind];
      $('chatInfo').textContent = label + '：' + parsed.conversations.length + ' 段对话，切成 ' + state.chunks.length + ' 小段' +
        (done ? '，上次做到第 ' + done + ' 段，会接着做' : '') + '。每段调用一次 Workers AI，量大时可能用到明天的免费额度。';
      $('chatStart').disabled = !state.chunks.length;
    }).catch(function (e) { $('chatInfo').textContent = '读取失败：' + e.message; });
  }

  function runChat() {
    var key = progressKey();
    var i = Number(localStorage.getItem(key) || 0);
    var queued = 0;
    var failures = 0;
    state.running = true;
    $('chatStart').disabled = true; $('chatStop').classList.remove('hidden');
    var bar = $('chatProgress'); bar.classList.remove('hidden'); bar.max = state.chunks.length; bar.value = i;
    function finish(msg) {
      state.running = false;
      $('chatStart').disabled = false; $('chatStop').classList.add('hidden');
      $('chatInfo').innerHTML = esc(msg);
      refreshReviewCount();
    }
    function next() {
      if (!state.running) return finish('已暂停，在第 ' + i + ' / ' + state.chunks.length + ' 段。本次新增候选 ' + queued + ' 条。');
      if (i >= state.chunks.length) { localStorage.removeItem(key); return finish('完成！本次新增候选 ' + queued + ' 条，去“审核”里挑。'); }
      var c = state.chunks[i];
      $('chatInfo').textContent = '第 ' + (i + 1) + ' / ' + state.chunks.length + ' 段：' + (c.title || '未命名对话') + ' · 已得候选 ' + queued + ' 条';
      api('/import/chat', { method: 'POST', body: { transcript: c.transcript, title: c.title || undefined, date: c.date || undefined, source: 'chat-import' } })
        .then(function (r) { queued += r.queued; failures = 0; i++; localStorage.setItem(key, String(i)); bar.value = i; next(); })
        .catch(function (e) {
          failures++;
          if (failures >= 3) return finish('连续失败，已停在第 ' + (i + 1) + ' 段：' + e.message + '。稍后再点开始会接着做。');
          setTimeout(next, 3000 * failures);
        });
    }
    next();
  }

  // ---------- wiring ----------
  on($('loginBtn'), 'click', login);
  on($('key'), 'keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) login(); });
  on($('peekBtn'), 'click', function () { var masked = $('key').classList.toggle('masked'); $('peekBtn').textContent = masked ? '显示' : '隐藏'; });
  on($('logoutBtn'), 'click', logout);
  document.querySelectorAll('nav button[data-view]').forEach(function (b) { on(b, 'click', function () { switchView(b.dataset.view); }); });
  document.querySelectorAll('.tabs button').forEach(function (b) { on(b, 'click', function () { state.tier = b.dataset.tier; $('q').value = ''; loadMemories(); }); });
  on($('searchBtn'), 'click', search);
  on($('q'), 'keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) search(); });
  on($('newBtn'), 'click', function () { openEditor(null); });
  on($('list'), 'click', function (ev) {
    var btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    var id = btn.closest('[data-id]').dataset.id;
    var m = state.items.find(function (x) { return x.id === id; });
    if (btn.dataset.act === 'edit') return openEditor(m);
    if (!confirm('确定删除这条记忆？删除后无法恢复。\n\n' + m.content.slice(0, 120))) return;
    api('/memories/' + id, { method: 'DELETE' }).then(function () {
      toast('已删除'); btn.closest('.card').remove();
      state.items = state.items.filter(function (x) { return x.id !== id; });
      $('count').textContent = state.items.length + ' 条';
    }).catch(function (e) { toast(e.message); });
  });
  on($('selAll'), 'click', function () {
    var boxes = document.querySelectorAll('#candList .pick');
    var all = Array.prototype.every.call(boxes, function (b) { return b.checked; });
    boxes.forEach(function (b) { b.checked = !all; });
  });
  on($('approveBtn'), 'click', approve);
  on($('rejectBtn'), 'click', reject);
  document.querySelectorAll('button[data-export]').forEach(function (b) { on(b, 'click', function () { download(b.dataset.export); }); });
  on($('entriesBtn'), 'click', importEntries);
  on($('chatFile'), 'change', onFile);
  on($('chatStart'), 'click', function () { if (!state.running) runChat(); });
  on($('chatStop'), 'click', function () { state.running = false; });

  if (state.key) { showApp(true); loadMemories(); refreshReviewCount(); }
})();
`;
