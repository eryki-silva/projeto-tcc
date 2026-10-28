const $ = id => document.getElementById(id);
const state = { match: null, slot: null, report: null, busy: false, configured: false };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}
function notify(text, error = false) {
  $('message').textContent = text; $('message').className = `message${error ? ' error' : ''}`; $('message').hidden = !text;
}
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, signal: AbortSignal.timeout(125000), headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a solicitação.');
  return data;
}
function errorMessage(error) { return error.name === 'TimeoutError' ? 'A solicitação demorou demais. Aguarde e tente novamente.' : error.message || 'Falha de conexão com o servidor.'; }
function setBusy(busy, label = '') {
  state.busy = busy;
  for (const button of document.querySelectorAll('#match-form button, #match-panel button')) button.disabled = busy;
  for (const input of document.querySelectorAll('#match-form input, #focus, #consent')) input.disabled = busy;
  $('analyze-button').disabled = busy || state.slot === null || !$('consent').checked || !state.configured;
  $('load-button').replaceChildren(document.createTextNode(busy ? 'Aguarde…' : 'Buscar partida '), el('span', '', busy ? '◌' : '↗'));
  $('analyze-button').replaceChildren(document.createTextNode(label || 'Gerar análise com IA '), el('span', '', busy ? '◌' : '✦'));
}
function time(seconds) {
  if (seconds === null || seconds === undefined) return 'Sem momento específico';
  return `${seconds < 0 ? '−' : ''}${Math.floor(Math.abs(seconds) / 60)}:${String(Math.floor(Math.abs(seconds) % 60)).padStart(2, '0')}`;
}
function date(value) { return new Date(value).toLocaleString('pt-BR'); }

function renderPlayers() {
  const parent = $('players'); parent.replaceChildren();
  for (const player of state.match.players) {
    const button = el('button', `player${state.slot === player.player_slot ? ' selected' : ''}`);
    button.type = 'button'; button.setAttribute('aria-pressed', String(state.slot === player.player_slot));
    button.append(el('small', player.team === 'Dire' ? 'team-dire' : 'team-radiant', player.team), el('strong', '', player.hero), el('small', '', `${player.name} · ${player.kills ?? '—'}/${player.deaths ?? '—'}/${player.assists ?? '—'} · ${player.gold_per_min ?? '—'} GPM`));
    button.disabled = state.busy;
    button.addEventListener('click', () => {
      if (state.busy) return;
      state.slot = player.player_slot; state.report = null; $('report').hidden = true;
      renderPlayers(); setBusy(false);
    });
    parent.append(button);
  }
}
async function loadMatch(event) {
  event?.preventDefault(); if (state.busy) return;
  const id = $('match-id').value.trim(), account = $('account-id').value.trim(), hero = $('hero-name').value.trim();
  if (!/^[1-9]\d{5,11}$/.test(id)) return notify('Informe um ID de partida válido.', true);
  setBusy(true); notify('Buscando dados da partida no OpenDota…');
  state.match = null; state.slot = null; state.report = null;
  $('match-panel').hidden = true; $('report').hidden = true; $('empty-state').hidden = false;
  try {
    const params = new URLSearchParams();
    if (account && !hero) params.set('account', account);
    if (hero) params.set('hero', hero);
    const match = await api(`/api/matches/${id}${params.size ? `?${params}` : ''}`);
    state.match = match; state.slot = match.selected_slot;
    $('match-info').replaceChildren(el('span', '', `Partida #${match.match_id}`), el('span', '', `${time(match.duration)} de jogo`), el('span', '', `Vitória ${match.radiant_win ? 'Radiant' : 'Dire'}`), el('span', '', match.start_time ? date(match.start_time * 1000) : 'Data indisponível'));
    $('parse-status').textContent = match.parsed ? 'Eventos processados disponíveis.' : 'Dados parciais: processamento detalhado não confirmado.';
    $('match-panel').hidden = false; $('empty-state').hidden = true; renderPlayers();
    notify(match.selected_slot === null && (hero || account) ? (hero ? 'Esse herói não foi identificado pelo nome. Escolha o jogador desejado na lista abaixo.' : 'O perfil não foi encontrado (ou está anonimizado). Escolha o jogador desejado na lista.') : 'Partida carregada. Confirme o jogador selecionado para continuar.');
  } catch (error) { notify(errorMessage(error), true); }
  finally { setBusy(false); }
}

function list(items, ordered = false) { const node = el(ordered ? 'ol' : 'ul', 'report-list'); items.forEach(item => node.append(el('li', '', item))); return node; }
function section(title) { const node = el('section', 'panel'); node.append(el('h3', 'report-section-title', title)); return node; }
function safeLink(url) { try { const parsed = new URL(url); return parsed.protocol === 'https:' ? parsed.href : null; } catch { return null; } }
function download(content, type, extension) {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob);
  const a = el('a'); a.href = url; a.download = `dota-${state.report.match_id}-${state.report.player_slot}.${extension}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function markdown(report) {
  const a = report.analysis;
  return [`# ${report.hero} · partida ${report.match_id}`, `Gerado: ${report.generated_at}\nModelo: ${report.model}\nConfiança: ${a.confidence}`, a.summary, '## Pontos positivos', ...a.strengths.map(x => `- ${x}`), '## Decisões para revisar', ...a.findings.map(f => `### ${f.title} (${time(f.time)})\n${f.observation}\n\nO que fazer: ${f.recommendation}\n\nPor quê: ${f.rationale}\n\n${f.certainty} · evidências ${f.evidence_ids.join(', ')}`), '## Plano de treino', ...a.training_plan.map((x, i) => `${i + 1}. ${x}`), '## Patch e meta', a.patch_context, report.context.freshness_note, '## Limitações', ...a.limitations.map(x => `- ${x}`), ...report.context.warnings.map(x => `- ${x}`), '## Fontes', ...report.context.sources.map(x => `- ${x.name}: ${x.url} (consulta: ${x.fetched_at})`), '## Evidências', JSON.stringify(report.evidence, null, 2)].join('\n\n');
}
function renderReport(report) {
  const root = $('report'); root.replaceChildren(); root.hidden = false;
  const a = report.analysis;
  const intro = el('section', 'panel');
  const header = el('div', 'report-head'), titles = el('div');
  titles.append(el('p', 'eyebrow', 'SEU RELATÓRIO'), el('h2', '', `${report.hero} · #${report.match_id}`), el('p', '', `Gerado em ${date(report.generated_at)} · ${report.model}`));
  header.append(titles, el('span', 'badge', `Confiança ${a.confidence}`));
  intro.append(header, el('p', 'report-summary', a.summary));
  const metrics = el('div', 'report-grid');
  for (const [value, text] of [[a.findings.length, 'decisões para revisar'], [report.coverage, 'cobertura dos dados']]) {
    const metric = el('div', 'metric'); metric.append(el('b', '', value), el('span', '', text)); metrics.append(metric);
  }
  intro.append(metrics); root.append(intro);
  if (a.strengths.length) { const s = section('Continue fazendo'); s.append(list(a.strengths)); root.append(s); }
  const findings = section('Decisões para revisar');
  if (!a.findings.length) findings.append(el('p', 'report-context', 'Os dados disponíveis não sustentaram erros específicos. Veja as limitações e o plano de treino.'));
  for (const f of a.findings) {
    const card = el('article', 'finding'), meta = el('div', 'finding-meta');
    meta.append(el('span', `badge severity-${f.severity}`, `Prioridade ${f.severity}`), el('span', 'badge', f.category), el('span', 'badge', f.certainty), el('span', 'badge time', time(f.time)));
    card.append(meta, el('h3', '', f.title), el('p', '', f.observation), el('p', 'recommendation', f.recommendation), el('p', 'reason', f.rationale));
    const details = el('details'); details.append(el('summary', '', `Ver evidências · ${f.evidence_ids.join(', ')}`), el('pre', '', JSON.stringify(report.evidence.filter(e => f.evidence_ids.includes(e.id)), null, 2))); card.append(details); findings.append(card);
  }
  root.append(findings);
  const training = section('Seu plano para as próximas partidas'); training.append(list(a.training_plan, true)); root.append(training);
  const context = section('Patch, meta e transparência');
  const patches = el('div', 'report-grid');
  for (const [title, value] of [['Patch da partida', report.context.match_patch?.name ?? 'Não identificado'], ['Mais recente no catálogo', report.context.latest_known_patch?.name ?? 'Não disponível']]) {
    const metric = el('div', 'metric'); metric.append(el('b', '', value), el('span', '', title)); patches.append(metric);
  }
  context.append(patches, el('p', 'report-context', a.patch_context), el('p', 'report-context', report.context.freshness_note));
  context.append(el('h4', '', 'Limitações desta análise'), list([...a.limitations, ...report.context.warnings]));
  const sourceNames = { patches: 'Catálogo comunitário de patches', items: 'Catálogo de itens', heroes: 'Catálogo de heróis', meta: 'Meta agregado · OpenDota', benchmarks: 'Benchmarks do herói', itemPopularity: 'Popularidade de itens', news: 'Notícias oficiais · Steam' };
  for (const source of report.context.sources) {
    const href = safeLink(source.url); if (!href) continue;
    const link = el('a', 'source-link', sourceNames[source.name] || source.name); link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.append(el('span', '', `Consultado em ${date(source.fetched_at)}`)); context.append(link);
  }
  const raw = el('details'); raw.append(el('summary', '', 'Dados de contexto e cobertura'), el('pre', '', JSON.stringify({ availability: report.availability, context: report.context }, null, 2))); context.append(raw); root.append(context);
  const actions = el('div', 'report-actions');
  const md = el('button', 'secondary', 'Exportar relatório (.md)'); md.type = 'button'; md.addEventListener('click', () => download(markdown(report), 'text/markdown;charset=utf-8', 'md'));
  const json = el('button', 'secondary', 'Exportar análise e evidências (.json)'); json.type = 'button'; json.addEventListener('click', () => download(JSON.stringify(report, null, 2), 'application/json', 'json'));
  actions.append(md, json); root.append(actions);
}

$('match-form').addEventListener('submit', loadMatch);
$('reload-button').addEventListener('click', () => loadMatch());
$('consent').addEventListener('change', () => setBusy(false));
$('parse-button').addEventListener('click', async () => {
  if (state.busy || !state.match) return;
  setBusy(true); notify('Solicitando processamento ao OpenDota…');
  try {
    const result = await api(`/api/matches/${state.match.match_id}/parse`, { method: 'POST', body: '{}' });
    notify(`${result.message}${result.job_id ? ` Protocolo: ${result.job_id}.` : ''}`);
  } catch (error) { notify(errorMessage(error), true); }
  finally { setBusy(false); }
});
$('analyze-button').addEventListener('click', async () => {
  if (state.busy || !state.match || state.slot === null || !$('consent').checked) return;
  setBusy(true, 'Analisando sua partida… '); $('report').hidden = true;
  notify('Preparando evidências, consultando patch/meta e gerando a análise com OpenAI…');
  try {
    state.report = await api(`/api/matches/${state.match.match_id}/analyze`, { method: 'POST', body: JSON.stringify({ player_slot: state.slot, focus: $('focus').value, consent: true }) });
    renderReport(state.report); notify('Análise concluída. Revise os achados junto das evidências e limitações.');
    $('report').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  } catch (error) { notify(errorMessage(error), true); }
  finally { setBusy(false); }
});
api('/api/health').then(health => {
  state.configured = health.openai_configured;
  $('key-status').textContent = health.openai_configured ? 'OpenAI configurada no servidor · conexão será verificada ao analisar.' : 'Análise IA: configure DOTA_OPENAI_API_KEY no servidor. A consulta de partidas funciona sem essa chave.';
  setBusy(state.busy);
}).catch(error => { $('key-status').textContent = 'Servidor indisponível.'; notify(errorMessage(error), true); });
