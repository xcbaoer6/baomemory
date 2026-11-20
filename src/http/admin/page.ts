import { APP_JS } from './client/app';
import { MARKUP } from './client/markup';
import { PARSERS_JS } from './client/parsers';
import { STYLES } from './client/styles';

/** Self-contained admin page: no build step, no external assets, no secrets. */
export const adminPage = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>baomemory 后台</title>
<style>${STYLES}</style>
</head>
<body>
${MARKUP}
<script>${PARSERS_JS}</script>
<script>${APP_JS}</script>
</body>
</html>`;
