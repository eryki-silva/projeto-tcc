const ctx = document.getElementById('graficoChamados');

new Chart(ctx, {
    type: 'bar',

    data: {
        labels: ['Financeiro', 'Fiscal', 'Vendas', 'Estoque'],

        datasets: [{
            label: 'Quantidade de Chamados',
            data: [12, 19, 8, 15]
        }]
    },

    options: {
        responsive: true
    }
});

function toggleMenu(){

    const sidebar = document.querySelector('.sidebar');

    sidebar.classList.toggle('active');

}