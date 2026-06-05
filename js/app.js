// app.js - Global Logic for Finance Class

const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
};

// Global formatCurrency reference
window.formatCurrency = formatCurrency;

const updateMetrics = async () => {
    if (!window.db || !window.db.metrics) return;
    
    const metrics = await window.db.metrics.getDashboardMetrics();
    
    const saldoEl = document.getElementById('saldo-disponivel');
    const faturaEl = document.getElementById('fatura-atual');
    const entradasEl = document.getElementById('total-entradas');
    const saidasEl = document.getElementById('total-saidas');
    const patrimonioEl = document.getElementById('patrimonio-total');
    
    if (saldoEl) saldoEl.innerText = formatCurrency(metrics.saldo);
    if (entradasEl) entradasEl.innerText = formatCurrency(metrics.entradas);
    if (entradasEl) entradasEl.innerText = formatCurrency(metrics.entradas);
    if (saidasEl) saidasEl.innerText = formatCurrency(metrics.saidas);
    if (patrimonioEl) patrimonioEl.innerText = formatCurrency(metrics.patrimonioTotal);

    // Atualização dinâmica do status da meta no dashboard
    const metaStatusContainer = document.getElementById('meta-status-container');
    const metaStatusIcon = document.getElementById('meta-status-icon');
    const metaStatusText = document.getElementById('meta-status-text');

    if (metaStatusContainer && metaStatusIcon && metaStatusText) {
        if (metrics.saidas > metrics.entradas) {
            metaStatusContainer.className = "bg-error/10 px-3 py-2 rounded-lg flex items-center gap-2 self-start border border-error/20 mt-2";
            metaStatusIcon.innerText = "⚠️";
            metaStatusText.className = "font-label-sm text-label-sm text-error";
            metaStatusText.innerText = "Você está ultrapassando seus limites de gasto";
        } else {
            metaStatusContainer.className = "bg-tertiary-container/20 px-3 py-2 rounded-lg flex items-center gap-2 self-start border border-tertiary-container/30 mt-2";
            metaStatusIcon.innerText = "✅";
            metaStatusText.className = "font-label-sm text-label-sm text-tertiary-fixed";
            metaStatusText.innerText = "Você está gastando dentro da meta";
        }
    }

    // Atualização dinâmica do indicador visual no saldo da tela de Início
    const saldoRendimentoIcon = document.getElementById('saldo-rendimento-icon');
    const saldoRendimentoText = document.getElementById('saldo-rendimento-text');
    if (saldoRendimentoIcon && saldoRendimentoText) {
        if (metrics.saldo < 0) {
            saldoRendimentoIcon.innerText = "trending_down";
            saldoRendimentoIcon.className = "material-symbols-outlined text-[16px] text-error";
            saldoRendimentoText.innerText = "Déficit neste mês";
            saldoRendimentoText.className = "font-label-sm text-error";
        } else {
            saldoRendimentoIcon.innerText = "trending_up";
            saldoRendimentoIcon.className = "material-symbols-outlined text-[16px] text-tertiary";
            saldoRendimentoText.innerText = "Superávit este mês";
            saldoRendimentoText.className = "font-label-sm text-tertiary";
        }
    }
};

const getDynamicDueDateString = (vencimentoDia) => {
    if (!vencimentoDia) return '';
    const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const now = new Date();
    let month = now.getMonth();
    let year = now.getFullYear();
    
    if (now.getDate() > vencimentoDia) {
        month = (month + 1) % 12;
        if (month === 0) year++;
    }
    
    return `${vencimentoDia} ${months[month]}`;
};

const updateDynamicDueDates = async () => {
    if (!window.db || !window.db.cartoes) return;
    try {
        const cards = await window.db.cartoes.list();
        if (cards && cards.length > 0) {
            // Cartão principal é o primeiro
            const mainCard = cards[0];
            const vencimentoDia = mainCard.vencimento_dia;
            const formattedDate = getDynamicDueDateString(vencimentoDia);
            
            const els = document.querySelectorAll('.dynamic-vencimento');
            els.forEach(el => {
                if (el.id === 'fatura-vencimento' && el.innerText.includes('Vence')) {
                    el.innerText = `Vence ${formattedDate}`;
                } else {
                    el.innerText = formattedDate;
                }
            });
        }
    } catch (err) {
        console.error('Erro ao buscar vencimento do cartão:', err);
    }
};

// Feature SaaS: Bloqueio de Inadimplentes
const showSubscriptionBlock = () => {
    if (document.getElementById('bloqueio-saas')) return;
    
    const block = document.createElement('div');
    block.id = 'bloqueio-saas';
    block.className = 'fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl px-6 text-center animate-in fade-in duration-500';
    
    block.innerHTML = `
        <div class="max-w-sm glass-card p-8 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center space-y-6">
            <div class="w-16 h-16 rounded-full bg-error/20 flex items-center justify-center border border-error/30 animate-pulse">
                <span class="material-symbols-outlined text-error text-3xl">warning</span>
            </div>
            <h2 class="text-2xl font-bold text-white tracking-tight">Assinatura Pendente</h2>
            <p class="text-on-surface-variant/80 text-sm leading-relaxed">
                Sua assinatura está pendente. Regularize seu pagamento para acessar seus dados.
            </p>
            <a href="#" class="w-full bg-primary text-on-primary font-semibold py-3 px-6 rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20">
                Regularizar Agora
            </a>
        </div>
    `;
    
    document.body.appendChild(block);
    
    // Ocultar menus de navegação inferior se existirem
    const nav = document.querySelector('nav');
    if (nav) nav.classList.add('hidden');
    const header = document.querySelector('header');
    if (header) {
        // Oculta botões de navegação do topo para maior segurança, mantendo apenas a logo/branding
        const navElements = header.querySelectorAll('button, a, [onclick]');
        navElements.forEach(el => {
            if (el.id !== 'btn-logout') el.classList.add('hidden');
        });
    }
};

const checkSubscriptionStatus = async () => {
    if (!window.db || !window.db.supabase) return;
    try {
        const user = await window.db.auth.getUser();
        if (!user) return;
        
        const { data, error } = await window.db.supabase
            .from('perfis')
            .select('status_assinatura')
            .eq('id', user.id)
            .single();
            
        if (data && data.status_assinatura === 'inadimplente') {
            showSubscriptionBlock();
        }
    } catch (err) {
        console.error('Erro ao verificar status de assinatura:', err);
    }
};

// UI/UX: Atualiza a foto de perfil ou exibe as iniciais
const updateProfileUI = async () => {
    try {
        const user = await window.db.auth.getUser();
        if (!user) return;
        
        const savedProfilePic = localStorage.getItem('profile_picture');
        
        const profileElements = [
            { id: 'profile-img', parentId: 'profile-img-container' },
            { id: 'profile-img-top', parentId: 'profile-img-top-container' },
            { id: 'drawer-profile-img', parentId: 'drawer-profile-container' }
        ];
        
        profileElements.forEach(cfg => {
            const imgEl = document.getElementById(cfg.id);
            if (!imgEl) return;
            
            if (savedProfilePic) {
                imgEl.src = savedProfilePic;
                imgEl.classList.remove('hidden');
                // Remove qualquer div de iniciais anterior no mesmo container
                const initialsEl = imgEl.parentElement.querySelector('.user-initials');
                if (initialsEl) initialsEl.remove();
            } else {
                imgEl.classList.add('hidden');
                const parent = imgEl.parentElement;
                if (parent) {
                    let initialsEl = parent.querySelector('.user-initials');
                    if (!initialsEl) {
                        initialsEl = document.createElement('div');
                        initialsEl.className = 'user-initials w-full h-full bg-primary/20 text-primary font-semibold flex items-center justify-center text-sm';
                        parent.appendChild(initialsEl);
                    }
                    const name = user.user_metadata?.full_name || user.email || 'U';
                    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                    initialsEl.innerText = initials;
                }
            }
        });
    } catch (err) {
        console.error('Erro ao atualizar UI do perfil:', err);
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    // Loop para aguardar a inicialização do DB e realizar validações
    let attempts = 0;
    const waitForDb = setInterval(async () => {
        if (window.db && window.db.auth) {
            clearInterval(waitForDb);
            await checkSubscriptionStatus();
            await updateProfileUI();
            await updateMetrics();
            await updateDynamicDueDates();
        }
        if (++attempts > 50) clearInterval(waitForDb);
    }, 100);

    const form = document.getElementById('transaction-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            let desc = document.getElementById('transacao-desc').value.trim();
            const val = parseFloat(document.getElementById('transacao-valor').value);
            const tipo = document.getElementById('transacao-tipo').value;
            const categoriaSelect = document.getElementById('transacao-categoria');
            const cardSwitch = document.getElementById('card-switch');
            const cartaoSelect = document.getElementById('cartao-select');
            const parcelasInput = document.getElementById('parcelas-input');
            
            if (!desc || isNaN(val)) return;
            

            const transacao = {
                descricao: desc,
                valor: tipo === 'saida' ? -Math.abs(val) : Math.abs(val),
                categoria: categoriaSelect ? categoriaSelect.value : 'Outros',
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
