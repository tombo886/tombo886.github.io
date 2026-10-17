/* ==========================================================================
   本地后端：Express 5，做两件事——
   1. serve public/ 下的静态站点（index.html / css / js / fonts / img / assets）
   2. 提供两个 API：
      GET  /api/projects       作品卡片数据，来自 data/projects.json
      POST /api/contact/phone  电话/微信号码，来自环境变量 CONTACT_PHONE

   号码为什么放环境变量：之前它拆成四段写在 js/phone-reveal.js 里，
   仓库一旦公开，号码就跟源码一起上了 GitHub。现在号码只存在 .env
   （已被 .gitignore 排除）或部署平台的环境变量里，源码里一位都没有。
   POST + 简单限流是为了让爬虫不能靠一个 GET 链接批量抓。
   ========================================================================== */

import express from 'express';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile();
} catch {
  // 没有 .env 文件就只用进程本身的环境变量（部署平台上通常如此）。
}

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const IS_PROD = process.env.NODE_ENV === 'production';
const CONTACT_PHONE = (process.env.CONTACT_PHONE || '').replace(/\D/g, '');
const CONTACT_PHONE_PREFIX = process.env.CONTACT_PHONE_PREFIX || '+86';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

/* ---------------------------------------------------------------- API */

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/projects', async (req, res, next) => {
  try {
    const raw = await readFile(path.join(ROOT, 'data', 'projects.json'), 'utf8');
    res.set('Cache-Control', 'no-cache');
    res.json(JSON.parse(raw));
  } catch (err) {
    next(err);
  }
});

/* 每个 IP 每 10 分钟最多 10 次。内存计数，单进程够用；进程重启就清零。 */
const PHONE_WINDOW_MS = 10 * 60 * 1000;
const PHONE_MAX_HITS = 10;
const phoneHits = new Map();

app.post('/api/contact/phone', (req, res) => {
  if (!CONTACT_PHONE) {
    return res.status(404).json({ error: 'not_configured' });
  }

  const now = Date.now();
  const entry = phoneHits.get(req.ip);
  if (!entry || now - entry.start > PHONE_WINDOW_MS) {
    phoneHits.set(req.ip, { start: now, count: 1 });
  } else if (++entry.count > PHONE_MAX_HITS) {
    return res.status(429).json({ error: 'too_many_requests' });
  }

  res.set('Cache-Control', 'no-store');
  res.json({ number: CONTACT_PHONE, tel: CONTACT_PHONE_PREFIX + CONTACT_PHONE });
});

/* 能拿 GET 访问的接口只有上面两个，告诉前端是否配置了号码，
   让它决定要不要渲染"Show phone"按钮。 */
app.get('/api/contact', (req, res) => {
  res.json({ phoneAvailable: Boolean(CONTACT_PHONE) });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not_found' });
});

/* ------------------------------------------------------------- 静态文件 */

/* 本地开发时强制 no-cache：改完 css/js 刷新就能看到，跟原来 serve.sh
   的行为一致。生产环境字体缓存一年，其他文件交给 ETag 协商。 */
app.use(
  express.static(path.join(ROOT, 'public'), {
    setHeaders(res, filePath) {
      if (!IS_PROD) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      } else if (/\.(woff2|ttf)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

/* Express 5 会把监听失败（比如端口被占用）作为参数传给回调，
   不处理的话会照样打印地址，看起来像启动成功了。 */
app.listen(PORT, err => {
  if (err) {
    console.error(
      err.code === 'EADDRINUSE'
        ? `端口 ${PORT} 已被占用，换一个：PORT=3000 npm start`
        : err
    );
    process.exit(1);
  }
  console.log(`→ http://localhost:${PORT}`);
  if (!CONTACT_PHONE) {
    console.log('  (CONTACT_PHONE 未设置，页面上不显示电话按钮——见 .env.example)');
  }
});
