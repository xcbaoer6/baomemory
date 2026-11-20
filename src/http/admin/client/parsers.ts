/**
 * Browser-side parsers for chat-history exports, shipped as plain JS source.
 * Parsing happens in the browser so large export files never hit the Worker;
 * only small transcript slices are sent for extraction.
 * Kept free of backticks and template placeholders so it can live in String.raw.
 * Tested in test/parsers.test.ts by evaluating this source.
 */
export const PARSERS_JS = String.raw`
var BMParsers = (function () {
  var MAX_ASSISTANT = 400;

  function textOf(v) {
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map(textOf).filter(Boolean).join('\n');
    if (v && typeof v === 'object') {
      if (typeof v.text === 'string') return v.text;
      if (Array.isArray(v.parts)) return textOf(v.parts);
    }
    return '';
  }

  function isoDate(v) {
    if (v == null || v === '') return '';
    var d = typeof v === 'number' ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }

  // ChatGPT: conversations.json, a tree in "mapping"; follow current_node back to the root.
  function fromChatGPT(c) {
    var map = c.mapping || {};
    var ids = [];
    var id = c.current_node;
    if (!id || !map[id]) {
      ids = Object.keys(map);
    } else {
      var guard = 0;
      while (id && map[id] && guard++ < 100000) { ids.push(id); id = map[id].parent; }
      ids.reverse();
    }
    var messages = [];
    ids.forEach(function (k) {
      var m = map[k] && map[k].message;
      if (!m || !m.author) return;
      var role = m.author.role === 'user' ? 'user' : m.author.role === 'assistant' ? 'assistant' : '';
      var text = role ? textOf(m.content).trim() : '';
      if (text) messages.push({ role: role, text: text });
    });
    return { title: c.title || '', date: isoDate(c.create_time), messages: messages };
  }

  // Claude: conversations.json, a flat chat_messages list.
  function fromClaude(c) {
    var messages = (c.chat_messages || []).map(function (m) {
      var text = (m.text || textOf(m.content) || '').trim();
      return { role: m.sender === 'human' ? 'user' : 'assistant', text: text };
    }).filter(function (m) { return m.text; });
    return { title: c.name || '', date: isoDate(c.created_at), messages: messages };
  }

  // "Name: text" transcripts, or anything else as one block of user text.
  function fromPlain(text, title) {
    var messages = [];
    var re = /^(user|human|me|我|用户|assistant|ai|claude|chatgpt|gpt|助手)\s*[:：]\s*/i;
    text.replace(/\r\n?/g, '\n').split('\n').forEach(function (line) {
      var m = re.exec(line);
      if (m) {
        var who = m[1].toLowerCase();
        var role = /^(user|human|me|我|用户)$/.test(who) ? 'user' : 'assistant';
        messages.push({ role: role, text: line.slice(m[0].length) });
      } else if (messages.length) {
        messages[messages.length - 1].text += '\n' + line;
      } else if (line.trim()) {
        messages.push({ role: 'user', text: line });
      }
    });
    messages.forEach(function (m) { m.text = m.text.trim(); });
    return [{ title: title || '', date: '', messages: messages.filter(function (m) { return m.text; }) }];
  }

  function parseExport(raw, fileName) {
    var data = null;
    try { data = JSON.parse(raw); } catch (e) { data = null; }
    if (data === null) {
      // SillyTavern-style JSONL: one message object per line.
      var lines = raw.split('\n').filter(function (l) { return l.trim(); });
      var objs = [];
      try { objs = lines.map(function (l) { return JSON.parse(l); }); } catch (e) { objs = []; }
      if (objs.length && objs.every(function (o) { return o && typeof o === 'object'; })) {
        var msgs = objs.filter(function (o) { return typeof o.mes === 'string'; }).map(function (o) {
          return { role: o.is_user ? 'user' : 'assistant', text: o.mes.trim() };
        }).filter(function (m) { return m.text; });
        if (msgs.length) return { kind: 'jsonl', conversations: [{ title: fileName || '', date: '', messages: msgs }] };
      }
      return { kind: 'text', conversations: fromPlain(raw, fileName) };
    }
    var list = Array.isArray(data) ? data : (data && Array.isArray(data.conversations) ? data.conversations : [data]);
    var kind = 'unknown';
    var conversations = list.map(function (c) {
      if (c && c.mapping) { kind = 'chatgpt'; return fromChatGPT(c); }
      if (c && c.chat_messages) { kind = 'claude'; return fromClaude(c); }
      return null;
    }).filter(function (c) { return c && c.messages.some(function (m) { return m.role === 'user'; }); });
    return { kind: kind, conversations: conversations };
  }

  // Slices each conversation into transcripts of at most maxChars, on message boundaries.
  // The user's words are kept whole; replies are clipped, since only facts about the user matter.
  function toChunks(conversations, maxChars) {
    var out = [];
    conversations.forEach(function (c) {
      var buf = '';
      function flush() { if (buf.trim()) out.push({ title: c.title, date: c.date, transcript: buf.trim() }); buf = ''; }
      c.messages.forEach(function (m) {
        var t = m.role === 'user' ? m.text : (m.text.length > MAX_ASSISTANT ? m.text.slice(0, MAX_ASSISTANT) + '…' : m.text);
        var line = (m.role === 'user' ? '用户: ' : 'AI: ') + t.replace(/\n{3,}/g, '\n\n') + '\n';
        while (line.length > maxChars) { flush(); out.push({ title: c.title, date: c.date, transcript: line.slice(0, maxChars).trim() }); line = line.slice(maxChars); }
        if (buf.length + line.length > maxChars) flush();
        buf += line;
      });
      flush();
    });
    return out;
  }

  return { parseExport: parseExport, toChunks: toChunks };
})();
`;
