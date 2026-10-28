import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { accountId, matchId, buildEvidence, createService, validateAnalysis } from '../lib.mjs';
import { createApp } from '../server.mjs';

const match = {
  match_id: 8123456789, duration: 2400, start_time: 1740000000, patch: 60, version: 21, radiant_win: true,
  players: [
    { player_slot: 0, account_id: 132959615, hero_id: 1, personaname: '<img src=x onerror=alert(1)>', kills: 8, deaths: 3, assists: 6, gold_per_min: 600, times: [0, 60, 120], gold_t: [600, 800, 1100], lh_t: [0, 3, 7], purchase_log: [{ time: 120, key: 'boots' }], kills_log: [{ time: 600, key: 'npc_dota_hero_axe' }], buyback_log: [], item_0: 29 },
    { player_slot: 128, account_id: 42, hero_id: 2, kills: 1, deaths: 5, assists: 2 }
  ],
  teamfights: [{ start: 600, end: 620, deaths: 1, players: [{ deaths: 0, damage: 1200, gold_delta: 300 }, { deaths: 1, damage: 200 }] }],
  objectives: [{ time: 1500, type: 'CHAT_MESSAGE_ROSHAN_KILL', team: 2 }]
};
const validAnalysis = {
  summary: 'Revise a fase inicial de farm.', confidence: 'média', strengths: ['Boa participação nos abates.'],
  findings: [{ title: 'Revisar farm inicial', category: 'economia', severity: 'média', time: null, observation: 'O desempenho inicial merece revisão.', recommendation: 'Treine last hits por dez minutos.', rationale: 'Compare evolução entre sessões.', certainty: 'hipótese', evidence_ids: ['E2'] }],
  training_plan: ['Registrar last hits aos dez minutos.'], patch_context: 'Catálogo comunitário; meta agregado.', limitations: ['Posição contínua indisponível.']
};
const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
function fixture({ key = true, mutateResponse, failMeta = false } = {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/matches/')) return jsonResponse(match);
    if (url.includes('/request/')) return jsonResponse({ job: { jobId: 123 } });
    if (url.endsWith('/heroes.json')) return jsonResponse({ 1: { localized_name: 'Anti-Mage' }, 2: { localized_name: 'Axe' } });
    if (url.endsWith('/items.json')) return jsonResponse({ boots: { id: 29, dname: 'Boots of Speed' } });
    if (url.endsWith('/patch.json')) return jsonResponse([{ id: 60, name: '7.41', date: '2026-03-24' }, { id: 61, name: 'Future patch', date: '2099-01-01' }]);
    if (url.includes('/heroStats')) return failMeta ? jsonResponse({}, 403) : jsonResponse([{ id: 1, pro_pick: 100, pro_win: 50, '7_pick': 50, '7_win': 20 }]);
    if (url.includes('/benchmarks')) return jsonResponse({ result: { gold_per_min: [{ percentile: .5, value: 500 }] } });
    if (url.includes('/itemPopularity')) return jsonResponse({ start_game_items: { 29: 30 } });
    if (url.includes('steampowered')) return jsonResponse({ appnews: { newsitems: [{ title: 'Dota 2 Update 7.41', contents: '<p>Balance update</p>', url: 'https://store.steampowered.com/news/app/570/', date: 1774396800 }] } });
    if (url.includes('openai')) return jsonResponse(mutateResponse ? mutateResponse() : { status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(validAnalysis) }] }] });
    throw Error(`Unexpected URL: ${url}`);
  };
  return { service: createService({ fetcher, env: key ? { DOTA_OPENAI_API_KEY: 'test-only-not-real' } : {}, now: () => Date.parse('2026-10-27') }), calls };
}

test('valida IDs e converte SteamID64/link sem perda de precisão', () => {
  assert.equal(accountId('76561198093225343'), 132959615);
  assert.equal(accountId('https://steamcommunity.com/profiles/76561198093225343/'), 132959615);
  assert.equal(accountId('132959615'), 132959615);
  assert.equal(accountId(''), null);
  for (const v of ['abc', '0', '99999999999999999', 'https://evil.com/76561198093225343']) assert.throws(() => accountId(v));
  assert.equal(matchId('8123456789'), '8123456789');
  for (const v of ['../../secret', '000000', '1', '1e10']) assert.throws(() => matchId(v));
});
test('seleciona jogador pelo perfil e mantém escolha manual para conta ausente', async () => {
  const { service } = fixture();
  const result = await service.matchView('8123456789', '76561198093225343');
  assert.equal(result.selected_slot, 0); assert.equal(result.players[0].hero, 'Anti-Mage'); assert.equal(result.parsed, true);
  assert.equal((await service.matchView('8123456789', '123')).selected_slot, null);
});
test('gera evidências com eventos e preserva a diferença entre campo ausente e lista vazia', () => {
  const { evidence, availability } = buildEvidence(match, match.players[0], { boots: { id: 29, dname: 'Boots of Speed' } });
  assert.equal(availability.buyback_log, true); assert.equal(availability.obs_log, false);
  assert.equal(evidence.find(e => e.kind === 'purchase_log').data.item, 'Boots of Speed');
  assert.equal(evidence.find(e => e.kind === 'teamfight').data.player.damage, 1200);
  assert.equal(evidence.filter(e => e.kind === 'timeline').length, 3);
  const partial = buildEvidence(match, match.players[1]);
  assert.equal(partial.availability.timeline, false); assert.equal(partial.evidence.filter(e => e.kind === 'timeline').length, 0);
});
test('herói tem prioridade sobre a própria conta e permite analisar outros jogadores', async () => {
  const { service } = fixture();
  const friend = await service.matchView('8123456789', '132959615', 'Axe');
  assert.equal(friend.selected_slot, 128); assert.equal(friend.selection_method, 'hero');
  assert.equal((await service.matchView('8123456789', null, 'anti mage')).selected_slot, 0);
  assert.equal((await service.matchView('8123456789', '132959615', 'Invoker')).selected_slot, null);
  const report = await service.analyze('8123456789', 128);
  assert.equal(report.hero, 'Axe'); assert.equal(report.player_slot, 128);
});
test('recusa relatório sem evidências válidas, tipos incorretos e timestamps inventados', () => {
  const evidence = buildEvidence(match, match.players[0]).evidence;
  assert.equal(validateAnalysis(structuredClone(validAnalysis), evidence).confidence, 'média');
  for (const mutate of [a => a.findings[0].evidence_ids = ['FAKE'], a => a.findings[0].time = 555, a => a.findings[0].evidence_ids = [], a => a.confidence = 'absoluta', a => a.summary = {}, a => delete a.limitations]) {
    const a = structuredClone(validAnalysis); mutate(a); assert.throws(() => validateAnalysis(a, evidence));
  }
});
test('análise completa envia evidências ao modelo com esquema estrito, sem nomes e sem armazenamento', async () => {
  const { service, calls } = fixture();
  const report = await service.analyze('8123456789', 0, 'Farm e itens');
  assert.equal(report.hero, 'Anti-Mage'); assert.equal(report.context.latest_known_patch.name, '7.41');
  assert.equal(report.context.match_patch.name, '7.41'); assert.equal(report.context.sources.length, 7);
  const call = calls.find(c => c.url.includes('openai'));
  const body = JSON.parse(call.options.body), input = JSON.parse(body.input);
  assert.equal(body.store, false); assert.equal(body.text.format.strict, true);
  assert.equal(input.focus, 'Farm e itens'); assert.equal(input.won, true);
  assert(!body.input.includes('personaname')); assert(!body.input.includes('132959615'));
  assert(!body.input.includes('onerror'));
  assert(input.evidence.some(e => e.kind === 'purchase_log'));
});
test('fonte de meta indisponível gera aviso sem inventar dados', async () => {
  const { service } = fixture({ failMeta: true });
  const report = await service.analyze('8123456789', 0);
  assert.equal(report.context.meta, null);
  assert(report.context.warnings.some(w => w.startsWith('meta:')));
});
test('chave ausente não produz análise simulada nem chama serviços', async () => {
  const { service, calls } = fixture({ key: false });
  await assert.rejects(() => service.analyze('8123456789', 0), error => error.status === 503);
  assert.equal(calls.length, 0);
});
test('valida jogador antes de chamar OpenAI', async () => {
  const { service, calls } = fixture();
  await assert.rejects(() => service.analyze('8123456789', 99), /Jogador não encontrado/);
  assert(!calls.some(c => c.url.includes('openai')));
});
test('processamento envia POST e retorna protocolo sem prometer replay disponível', async () => {
  const { service, calls } = fixture();
  const result = await service.parse('8123456789');
  assert.equal(result.job_id, 123); assert.match(result.message, /não é garantido/);
  assert.equal(calls[0].options.method, 'POST');
});
test('falha de rede, limite e autenticação têm erros seguros', async () => {
  for (const status of [403, 404, 429, 500]) {
    const service = createService({ fetcher: async () => jsonResponse({ secret: 'never-show-this' }, status) });
    await assert.rejects(() => service.matchView('8123456789'), error => !error.message.includes('never-show-this') && error.status >= 400);
  }
  const service = createService({ fetcher: async () => { throw Error('secret-value'); } });
  await assert.rejects(() => service.matchView('8123456789'), /Não foi possível acessar api.opendota.com/);
});
test('resposta OpenAI incompleta ou malformada não vira relatório', async () => {
  for (const response of [{ status: 'incomplete' }, { status: 'completed', output: [] }, { status: 'completed', output: [{ content: [{ type: 'output_text', text: '{"summary":"incompleto"}' }] }] }]) {
    const { service } = fixture({ mutateResponse: () => response });
    await assert.rejects(() => service.analyze('8123456789', 0), error => error.status === 502);
  }
});

function httpCall(server, path, { method = 'GET', body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path, method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers } }, res => {
      let text = ''; res.on('data', c => text += c); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text, json: () => JSON.parse(text) }));
    }); req.on('error', reject); if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body)); req.end();
  });
}
test('HTTP: interface, endpoints, consentimento e validação', async t => {
  const { service } = fixture(); const server = createApp(service);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  const home = await httpCall(server, '/'); assert.equal(home.status, 200); assert.match(home.text, /76561198093225343/);
  assert.match(home.headers['content-security-policy'], /default-src 'self'/);
  assert.equal((await httpCall(server, '/api/health')).json().openai_configured, true);
  assert.equal((await httpCall(server, '/api/matches/8123456789?account=132959615')).json().selected_slot, 0);
  const path = '/api/matches/8123456789/analyze';
  assert.equal((await httpCall(server, path, { method: 'POST', body: { player_slot: 0 } })).status, 400);
  assert.equal((await httpCall(server, path, { method: 'POST', body: { player_slot: 0, consent: true } })).status, 200);
  assert.equal((await httpCall(server, path, { method: 'POST', body: '{' })).status, 400);
  assert.equal((await httpCall(server, path, { method: 'POST', body: null })).status, 400);
  assert.equal((await httpCall(server, '/.env')).status, 404);
});
test('HTTP: bloqueia origens externas, DNS rebinding e corpos grandes', async t => {
  const server = createApp(fixture().service);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  for (const headers of [{ Origin: 'https://evil.example' }, { Host: 'evil.example' }, { 'Sec-Fetch-Site': 'cross-site' }]) assert.equal((await httpCall(server, '/api/health', { headers })).status, 403);
  assert.equal((await httpCall(server, '/api/matches/8123456789/analyze', { method: 'POST', body: 'x'.repeat(9000) })).status, 413);
});
test('HTTP: limita solicitações de processamento', async t => {
  const server = createApp(fixture().service);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  for (let i = 0; i < 6; i++) assert.equal((await httpCall(server, '/api/matches/8123456789/parse', { method: 'POST', body: {} })).status, 202);
  assert.equal((await httpCall(server, '/api/matches/8123456789/parse', { method: 'POST', body: {} })).status, 429);
});
