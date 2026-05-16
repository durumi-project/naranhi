// Vite dev 전용 plugin — Vercel Edge Function (api/*.js) 을 dev 서버에 마운트.
//
// 목적: 학생 팀이 vercel CLI 글로벌 설치 없이 `npm run dev` 한 명령으로
// 프런트엔드 + /api/classify 풀스택을 한 번에 띄울 수 있게 한다.
//
// 동작:
//   1. dev 서버 시작 시 .env.local 을 dotenv 로 로드 (ANTHROPIC_API_KEY)
//   2. /api/<name> 요청을 가로채 ./api/<name>.js 의 default export 핸들러로 위임
//   3. Node 의 http req/res 를 Web Fetch Request/Response 로 어댑팅
//      → Edge runtime 핸들러를 *그대로* 호출 가능 (Node 18+ 글로벌 Request/Response/fetch)
//
// 한계: Edge 전용 API (KV·EdgeRuntime context) 는 dev 에서 작동 안 함. 현재 미사용.
// 프로덕션은 Vercel 빌드 시 vercel.json 의 runtime:'edge' 설정으로 그대로 배포.

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

async function nodeReqToFetchRequest(req) {
  const proto = req.headers['x-forwarded-proto'] ?? 'http';
  const host = req.headers.host ?? 'localhost:5173';
  const url = `${proto}://${host}${req.url}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) headers.set(k, v.join(', '));
    else if (v !== undefined) headers.set(k, String(v));
  }
  const init = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const body = await readNodeBody(req);
    if (body.length > 0) init.body = body;
  }
  // 학생이 로컬에서 호출할 때 IP 식별이 어렵게 — rate limit 이 의미를 갖도록 한 줄 보강
  if (!headers.has('x-forwarded-for') && req.socket?.remoteAddress) {
    headers.set('x-forwarded-for', req.socket.remoteAddress);
  }
  return new Request(url, init);
}

async function writeFetchResponseToNode(response, res) {
  res.statusCode = response.status;
  response.headers.forEach((v, k) => {
    res.setHeader(k, v);
  });
  const ab = await response.arrayBuffer();
  res.end(Buffer.from(ab));
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
          const fetchRequest = await nodeReqToFetchRequest(req);
          const fetchResponse = await handler(fetchRequest);
          if (!(fetchResponse instanceof Response)) {
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'handler_did_not_return_response' }));
            return;
          }
          await writeFetchResponseToNode(fetchResponse, res);
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
