const chamados = [
    { id: '#1542', cliente: 'Mercado X', assunto: 'Erro na nota fiscal', setor: 'Fiscal', prioridade: 'Alta', status: 'Em atendimento', tecnico: 'Carlos', sla: 'Vence em 1h' },
    { id: '#1543', cliente: 'Farmácia Y', assunto: 'Falha na integração', setor: 'Vendas', prioridade: 'Média', status: 'Aguardando retorno', tecnico: 'Marina', sla: 'Vence hoje' },
    { id: '#1544', cliente: 'Loja Z', assunto: 'Dúvida no relatório', setor: 'Financeiro', prioridade: 'Baixa', status: 'Finalizado', tecnico: 'João', sla: 'Concluído' },
    { id: '#1545', cliente: 'Padaria Central', assunto: 'Sistema lento no caixa', setor: 'Vendas', prioridade: 'Alta', status: 'Aberto', tecnico: 'Ana', sla: 'Atrasado' },
    { id: '#1546', cliente: 'Auto Peças Brasil', assunto: 'Divergência no estoque', setor: 'Estoque', prioridade: 'Média', status: 'Em atendimento', tecnico: 'Rafael', sla: 'Vence em 3h' },
    { id: '#1547', cliente: 'Clínica Vida', assunto: 'Boleto não gerado', setor: 'Financeiro', prioridade: 'Alta', status: 'Aberto', tecnico: 'Marina', sla: 'Vence em 45min' }
];

const paginas = {
    dashboard: ['Painel de Suporte Técnico', 'Central de atendimento'],
    chamados: ['Chamados', 'Fila operacional do suporte'],
    relatorios: ['Relatórios', 'Indicadores para análise do atendimento'],
    tecnicos: ['Técnicos', 'Distribuição de chamados por responsável'],
    configuracoes: ['Configurações', 'Parâmetros do painel informativo']
};

function normalizar(texto) {
    return texto.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

function classeBadge(valor, tipo) {
    return `${tipo}-${normalizar(valor).toLowerCase().replace(/ /g, '-')}`;
}

function criarBadge(valor, tipo) {
    return `<span class="badge ${classeBadge(valor, tipo)}">${valor}</span>`;
}

function contarPorCampo(campo) {
    return chamados.reduce((totais, chamado) => {
        totais[chamado[campo]] = (totais[chamado[campo]] || 0) + 1;
        return totais;
    }, {});
}

function atualizarCards() {
    document.getElementById('totalAbertos').textContent = chamados.filter(chamado => chamado.status !== 'Finalizado').length;
    document.getElementById('totalAtendimento').textContent = chamados.filter(chamado => chamado.status === 'Em atendimento').length;
    document.getElementById('totalFinalizados').textContent = chamados.filter(chamado => chamado.status === 'Finalizado').length;
    document.getElementById('totalAlta').textContent = chamados.filter(chamado => chamado.prioridade === 'Alta').length;
}

function renderizarTabela(lista = chamados) {
    const corpo = document.getElementById('corpoChamados');
    const contador = document.getElementById('contadorTabela');

    corpo.innerHTML = lista.map(chamado => `
        <tr class="${chamado.sla === 'Atrasado' ? 'linha-alerta' : ''}">
            <td>${chamado.id}</td>
            <td>${chamado.cliente}</td>
            <td>${chamado.assunto}</td>
            <td>${chamado.setor}</td>
            <td>${criarBadge(chamado.prioridade, 'prioridade')}</td>
            <td>${criarBadge(chamado.status, 'status')}</td>
            <td>${chamado.tecnico}</td>
            <td>${criarBadge(chamado.sla, 'sla')}</td>
        </tr>
    `).join('');

    contador.textContent = `${lista.length} ${lista.length === 1 ? 'chamado' : 'chamados'}`;
}

function filtrarTabela() {
    const pesquisa = normalizar(document.getElementById('pesquisa').value);
    const prioridade = document.getElementById('filtroPrioridade').value;
    const status = document.getElementById('filtroStatus').value;

    const filtrados = chamados.filter(chamado => {
        const textoBusca = normalizar(`${chamado.cliente} ${chamado.assunto} ${chamado.id} ${chamado.tecnico}`);
        return textoBusca.includes(pesquisa)
            && (prioridade === 'Todas' || chamado.prioridade === prioridade)
            && (status === 'Todos' || chamado.status === status);
    });

    renderizarTabela(filtrados);
}

function montarGraficos() {
    const setores = contarPorCampo('setor');
    const prioridades = contarPorCampo('prioridade');

    new Chart(document.getElementById('graficoChamados'), {
        type: 'bar',
        data: {
            labels: Object.keys(setores),
            datasets: [{
                label: 'Quantidade de chamados',
                data: Object.values(setores),
                backgroundColor: '#2563eb',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });

    new Chart(document.getElementById('graficoPrioridade'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(prioridades),
            datasets: [{
                data: Object.values(prioridades),
                backgroundColor: ['#dc2626', '#f59e0b', '#16a34a'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

function renderizarCriticos() {
    const criticos = chamados.filter(chamado => chamado.prioridade === 'Alta' || chamado.sla === 'Atrasado');
    document.getElementById('listaCriticos').innerHTML = criticos.map(chamado => `
        <article class="item-resumo">
            <strong>${chamado.id} - ${chamado.cliente}</strong>
            <span>${chamado.assunto}</span>
            <div>${criarBadge(chamado.prioridade, 'prioridade')} ${criarBadge(chamado.sla, 'sla')}</div>
        </article>
    `).join('');
}

function renderizarRelatorios() {
    const setores = contarPorCampo('setor');
    const setorMaisAcionado = Object.entries(setores).sort((a, b) => b[1] - a[1])[0];
    const porTecnico = contarPorCampo('tecnico');

    document.getElementById('relatorioTotal').textContent = chamados.length;
    document.getElementById('relatorioAtrasados').textContent = chamados.filter(chamado => chamado.sla === 'Atrasado').length;
    document.getElementById('relatorioSetor').textContent = setorMaisAcionado ? setorMaisAcionado[0] : '-';

    document.getElementById('resumoTecnicos').innerHTML = Object.entries(porTecnico).map(([tecnico, total]) => `
        <article class="item-resumo">
            <strong>${tecnico}</strong>
            <span>${total} ${total === 1 ? 'chamado vinculado' : 'chamados vinculados'}</span>
        </article>
    `).join('');
}

function renderizarTecnicos() {
    const tecnicos = [...new Set(chamados.map(chamado => chamado.tecnico))];

    document.getElementById('cardsTecnicos').innerHTML = tecnicos.map(tecnico => {
        const meusChamados = chamados.filter(chamado => chamado.tecnico === tecnico);
        const abertos = meusChamados.filter(chamado => chamado.status !== 'Finalizado').length;
        const atrasados = meusChamados.filter(chamado => chamado.sla === 'Atrasado').length;
        const disponibilidade = abertos >= 2 ? 'Ocupado' : 'Disponível';

        return `
            <article class="tecnico-card">
                <div class="avatar">${tecnico.charAt(0)}</div>
                <h2>${tecnico}</h2>
                <p>${disponibilidade}</p>
                <div class="metricas">
                    <span><strong>${abertos}</strong> em aberto</span>
                    <span><strong>${atrasados}</strong> atrasado</span>
                </div>
            </article>
        `;
    }).join('');
}

function trocarAba(nomeAba) {
    document.querySelectorAll('.tab-page').forEach(pagina => pagina.classList.remove('active'));
    document.querySelectorAll('.sidebar li').forEach(item => item.classList.remove('active'));

    document.getElementById(nomeAba).classList.add('active');
    document.querySelector(`[data-tab="${nomeAba}"]`).classList.add('active');
    document.getElementById('tituloPagina').textContent = paginas[nomeAba][0];
    document.getElementById('subtituloPagina').textContent = paginas[nomeAba][1];
    document.querySelector('.sidebar').classList.remove('active');
    document.querySelector('.main').classList.add('menu-fechado');
}

function toggleMenu() {
    document.querySelector('.sidebar').classList.toggle('active');
    document.querySelector('.main').classList.toggle('menu-fechado');
}

document.querySelectorAll('.sidebar li').forEach(item => {
    item.addEventListener('click', () => trocarAba(item.dataset.tab));
});

document.getElementById('pesquisa').addEventListener('input', filtrarTabela);
document.getElementById('filtroPrioridade').addEventListener('change', filtrarTabela);
document.getElementById('filtroStatus').addEventListener('change', filtrarTabela);

atualizarCards();
renderizarTabela();
renderizarCriticos();
renderizarRelatorios();
renderizarTecnicos();
montarGraficos();
