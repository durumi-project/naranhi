// Vite dev 전용 plugin — Vercel Node Function (api/*.js) 을 dev 서버에 마운트.
//
// 목적: 학생 팀이 vercel CLI 글로벌 설치 없이 `npm run dev` 한 명령으로
// 프런트엔드 + /api/classify 풀스택을 한 번에 띄울 수 있게 한다.
//
// 동작:
//   1. dev 서버 시작 시 .env.local 을 dotenv 로 로드 (ANTHROPIC_API_KEY)
//   2. /api/<name> 요청을 가로채 ./api/<name>.js 의 default export 핸들러로 위임
//   3. Vercel Node runtime 시그니처 (req, res) 그대로 호출 — req.body 자동 파싱,
//      res.status()/json()/send() 헬퍼 주입 → 프로덕션 동작과 동일하게 재현.
//
// 배경: 세션 12 에서 @anthropic-ai/sdk 가 node:fs 를 import 해 Edge runtime 배포 실패.
// 그래서 api/*.js 는 Vercel Node runtime 으로 전환됐고, dev 플러그인도 같은 시그니처로 맞춤.

import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

let envLoaded = false;
function loadEnvOnce() {
  if (envLoaded) return;
  const envPath = resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) {
    loadEnv({ path: envPath });
  }
  envLoaded = true;
}

function readNodeBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolveBody(Buffer.concat(chunks)));
    req.on('error', rejectBody);
  });
}

async function augmentNodeReq(req) {
  // 학생이 로컬에서 호출할 때 IP 식별이 어렵게 — rate limit 이 의미를 갖도록 한 줄 보강
  if (!req.headers['x-forwarded-for'] && req.socket?.remoteAddress) {
    req.headers['x-forwarded-for'] = req.socket.remoteAddress;
  }
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const raw = await readNodeBody(req);
  if (raw.length === 0) {
    req.body = undefined;
    return;
  }
  const ct = String(req.headers['content-type'] ?? '');
  const text = raw.toString('utf-8');
  if (ct.includes('application/json')) {
    try {
      req.body = JSON.parse(text);
    } catch {
      // Vercel 도 파싱 실패 시 string 그대로 노출 — 핸들러가 재파싱 가능
      req.body = text;
    }
  } else {
    req.body = text;
  }
}

function augmentNodeRes(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    if (!res.getHeader('content-type')) {
      res.setHeader('content-type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = (data) => {
    if (data == null) {
      res.end();
      return res;
    }
    if (typeof data === 'object' && !Buffer.isBuffer(data)) {
      return res.json(data);
    }
    res.end(data);
    return res;
  };
}

export function devApiPlugin() {
  return {
    name: 'naranhi-dev-api',
    apply: 'serve',
    configureServer(server) {
      loadEnvOnce();
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();
        const route = req.url.split('?')[0].slice('/api/'.length);
        if (!/^[A-Za-z0-9_-]+$/.test(route)) return next();
        const apiFile = resolve(process.cwd(), 'api', `${route}.js`);
        if (!existsSync(apiFile)) return next();

        try {
          const mod = await server.ssrLoadModule(apiFile);
          const handler = mod.default ?? mod.handler;
          if (typeof handler !== 'function') {
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'no_handler', route }));
            return;
          }
          await augmentNodeReq(req);
          augmentNodeRes(res);
          await handler(req, res);
        } catch (err) {
          // dev 환경에서만 노출되는 콘솔 로그 — 학생 팀이 디버깅 시 도움
          // eslint-disable-next-line no-console
          console.error('[dev-api] handler error', err);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              error: 'dev_api_handler_failed',
              message: err?.message ?? String(err),
            }),
          );
        }
      });
    },
  };
}
