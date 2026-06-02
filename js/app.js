// app.js - Global Logic for Finance Class

const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
};

const updateMetrics = async () => {
    if (!window.db || !window.db.metrics) return;
    
    const metrics = await window.db.metrics.getDashboardMetrics();
    
    const saldoEl = document.getElementById('saldo-disponivel');
    const faturaEl = document.getElementById('fatura-atual');
    const entradasEl = document.getElementById('total-entradas');
    const saidasEl = document.getElementById('total-saidas');
    const patrimonioEl = document.getElementById('patrimonio-total');
    
    if (saldoEl) saldoEl.innerText = formatCurrency(metrics.saldo);
    if (faturaEl) faturaEl.innerText = formatCurrency(metrics.limiteUtilizado);
    if (entradasEl) entradasEl.innerText = formatCurrency(metrics.entradas);
    if (saidasEl) saidasEl.innerText = formatCurrency(metrics.saidas);
    if (patrimonioEl) patrimonioEl.innerText = formatCurrency(metrics.patrimonioTotal);
};

document.addEventListener('DOMContentLoaded', async () => {
    await updateMetrics();

    const form = document.getElementById('transaction-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            let desc = document.getElementById('transacao-desc').value.trim();
            const val = parseFloat(document.getElementById('transacao-valor').value);
            const tipo = document.getElementById('transacao-tipo').value;
            const cardSwitch = document.getElementById('card-switch');
            const fixedSwitch = document.getElementById('fixed-switch');
            const cartaoSelect = document.getElementById('cartao-select');
            const parcelasInput = document.getElementById('parcelas-input');
            
            if (!desc || isNaN(val)) return;
            
            // Adiciona o indicador visual "📌 Fixa" na descrição
            if (fixedSwitch && fixedSwitch.checked) {
                desc += ' 📌 Fixa';
            }
            
            const transacao = {
                descricao: desc,
                valor: tipo === 'saida' ? -Math.abs(val) : Math.abs(val),
                categoria: 'Outros',
                parcelas: 1,
                data: new Date().toISOString()
            };
            
            if (cardSwitch && cardSwitch.checked) {
                if (cartaoSelect && cartaoSelect.value) transacao.cartao_id = cartaoSelect.value;
                if (parcelasInput) transacao.parcelas = parseInt(parcelasInput.value) || 1;
            }
            
            try {
                await window.db.transacoes.add(transacao);
                form.reset();
                if (cardSwitch) {
                    cardSwitch.checked = false;
                    document.getElementById('card-details')?.classList.add('hidden');
                }
                if (fixedSwitch) {
                    fixedSwitch.checked = false;
                }
                await updateMetrics();
                
                // Notificação visual não bloqueante (Toast)
                const toast = document.createElement('div');
                toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-6 py-3 rounded-full shadow-lg font-label-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 flex items-center gap-2';
                toast.innerHTML = '<span class="material-symbols-outlined text-[18px]">check_circle</span> Concluído';
                document.body.appendChild(toast);
                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transition = 'opacity 0.3s ease';
                    setTimeout(() => toast.remove(), 300);
                }, 2500);
            } catch (err) {
                alert('Erro ao adicionar transação: ' + err.message);
            }
        });
    }
});
