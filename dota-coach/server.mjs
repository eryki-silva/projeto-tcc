import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { AppError, createService, matchId } from './lib.mjs';

const publicRoot = new URL('./public/', import.meta.url);
const assets = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'] };

async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new AppError('Envie JSON.', 415);
  let content = '';
  for await (const chunk of req) {
    content += chunk;
    if (Buffer.byteLength(content) > 8192) throw new AppError('Solicitação muito grande.', 413);
  }
  try { return JSON.parse(content); } catch { throw new AppError('JSON inválido.'); }
}

export function createApp(service = createService()) {
  const limits = new Map();
  let analysesInProgress = 0;
  return http.createServer(async (req, res) => {
    const headers = {
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    };
    const json = (value, status = 200) => { res.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      const host = req.headers.host ?? '';
      if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) throw new AppError('Host não autorizado. Execute localmente ou configure um proxy autenticado.', 403);
      if (req.headers.origin && req.headers.origin !== `http://${host}`) throw new AppError('Origem não autorizada.', 403);
      if (req.headers['sec-fetch-site'] === 'cross-site') throw new AppError('Solicitação externa bloqueada.', 403);
      if (req.method === 'GET' && assets[url.pathname]) {
        const [name, type] = assets[url.pathname];
        const data = await readFile(new URL(name, publicRoot));
        res.writeHead(200, { ...headers, 'Content-Type': type }); res.end(data); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/health') return json({ ok: true, openai_configured: service.configured() });
      const route = url.pathname.match(/^\/api\/matches\/(\d+)(?:\/(parse|analyze))?$/);
      if (!route) throw new AppError('Rota não encontrada.', 404);
      const id = matchId(route[1]), action = route[2];
      const bucket = `${req.socket.remoteAddress}:${action ?? 'read'}`;
      const entry = limits.get(bucket) ?? { count: 0, reset: Date.now() + 60_000 };
      if (Date.now() > entry.reset) { entry.count = 0; entry.reset = Date.now() + 60_000; }
      entry.count++; limits.set(bucket, entry);
      if (entry.count > (action ? 6 : 40)) throw new AppError('Muitas solicitações. Aguarde um minuto.', 429);
      if (req.method === 'GET' && !action) return json(await service.matchView(id, url.searchParams.get('account'), url.searchParams.get('hero') ?? ''));
      if (req.method === 'POST' && action === 'parse') { await body(req); return json(await service.parse(id), 202); }
      if (req.method === 'POST' && action === 'analyze') {
        const input = await body(req);
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('Corpo inválido.');
        if (typeof input.focus !== 'undefined' && (typeof input.focus !== 'string' || input.focus.length > 600)) throw new AppError('O foco deve ter até 600 caracteres.');
        if (input.consent !== true) throw new AppError('Autorize o envio dos dados da partida à OpenAI antes de analisar.');
        if (analysesInProgress >= 2) throw new AppError('Há análises em andamento. Aguarde.', 429);
        analysesInProgress++;
        try { return json(await service.analyze(id, input.player_slot, input.focus)); }
        finally { analysesInProgress--; }
      }
      throw new AppError('Método não permitido.', 405);
    } catch (error) {
      json({ error: error instanceof AppError ? error.message : 'Falha interna. Tente novamente.' }, error instanceof AppError ? error.status : 500);
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida.');
  const server = createApp();
  server.requestTimeout = 120_000;
  server.listen(port, '127.0.0.1', () => console.log(`Dota Coach iniciado na porta ${port}. Chaves ficam apenas no servidor.`));
}
