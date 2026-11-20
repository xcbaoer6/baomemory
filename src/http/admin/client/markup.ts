export const MARKUP = `
<main>
  <h1>baomemory 后台</h1>

  <section id="login" class="card">
    <div class="row">
      <input id="key" class="grow masked" type="text" placeholder="输入或粘贴 API_KEY" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" />
      <button id="peekBtn" type="button">显示</button>
      <button class="primary" id="loginBtn" type="button">进入</button>
    </div>
    <div class="meta">密钥只保存在本标签页（关掉即清除），只发给本服务。</div>
  </section>

  <section id="app" class="hidden">
    <nav>
      <button data-view="memories" class="on">记忆</button>
      <button data-view="review">审核 <span id="reviewCount"></span></button>
      <button data-view="io">导入导出</button>
      <span class="grow"></span>
      <button id="logoutBtn">退出</button>
    </nav>

    <div id="view-memories">
      <div class="row">
        <input id="q" class="grow" placeholder="语义搜索记忆…" />
        <button id="searchBtn">搜索</button>
        <button id="newBtn" class="primary">新增</button>
      </div>
      <div class="row tabs" style="margin-top:10px">
        <button data-tier="" class="on">全部</button>
        <button data-tier="1">核心</button>
        <button data-tier="2">活跃</button>
        <button data-tier="3">归档</button>
        <span class="meta" id="count"></span>
      </div>
      <div id="editor" class="card hidden"></div>
      <div id="list"></div>
    </div>

    <div id="view-review" class="hidden">
      <div class="row">
        <button id="selAll">全选</button>
        <button id="approveBtn" class="primary">记住选中的</button>
        <button id="rejectBtn" class="danger">丢弃选中的</button>
        <span class="meta" id="reviewMeta"></span>
      </div>
      <div class="meta">候选不会被召回，记住之前可以直接改文字。记住时会自动和已有记忆去重合并。</div>
      <div id="candList"></div>
    </div>

    <div id="view-io" class="hidden">
      <div class="card">
        <h2>导出</h2>
        <div class="row">
          <button data-export="md">下载 Markdown（可再导入）</button>
          <button data-export="jsonl">下载 JSONL</button>
        </div>
      </div>

      <div class="card">
        <h2>导入整理好的条目</h2>
        <div class="meta">一行一条，例如：- [preference|核心|4] 喜欢冰美式 #饮品。类型、层级、重要度、标签都可省略。</div>
        <textarea id="entriesText" style="margin-top:8px" placeholder="- 用户在东京工作&#10;- [decision] baomemory 的数据库放在东京 #baomemory"></textarea>
        <div class="row" style="margin-top:8px">
          <label><input type="radio" name="entriesMode" value="review" checked /> 先进审核</label>
          <label><input type="radio" name="entriesMode" value="direct" /> 直接写入</label>
          <button id="entriesBtn" class="primary">导入</button>
          <span class="meta" id="entriesMeta"></span>
        </div>
      </div>

      <div class="card">
        <h2>导入聊天记录</h2>
        <div class="meta">支持 ChatGPT 和 Claude 导出的 conversations.json、SillyTavern 的 .jsonl，以及“用户: … / AI: …”格式的纯文本。文件在浏览器里解析，只把切好的小段发去提取，结果全部进审核。</div>
        <div class="row" style="margin-top:8px">
          <input id="chatFile" type="file" accept=".json,.jsonl,.txt,.md" />
          <button id="chatStart" class="primary" disabled>开始提取</button>
          <button id="chatStop" class="hidden">暂停</button>
        </div>
        <div id="chatInfo" class="meta"></div>
        <progress id="chatProgress" class="hidden" value="0" max="1"></progress>
      </div>
    </div>
  </section>
</main>
<div id="toast" class="hidden"></div>
`;
