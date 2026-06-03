// demo-db.js - Mock Local para Versão Demo
const STORAGE_KEY = 'finance_class_demo_data';

// Initial Mock Data
const initialData = {
    user: { id: 'mock-user-1', email: 'demo@financeclass.com', user_metadata: { full_name: 'Usuário Demo' } },
    transacoes: [
        { id: '1', descricao: 'Salário', valor: 8500, categoria: 'Outros', data: new Date().toISOString() },
        { id: '2', descricao: 'Aluguel', valor: -2500, categoria: 'Moradia', data: new Date().toISOString() },
        { id: '3', descricao: 'Mercado', valor: -800, categoria: 'Alimentação', data: new Date().toISOString() }
    ],
    cartoes: [
        { id: 'c1', nome: 'Cartão Black', limite: 15000, fechamento_dia: 10, vencimento_dia: 15 }
    ],
    investimentos: [
        { id: 'i1', nome: 'Tesouro Direto', valor_investido: 10000, rentabilidade: 10.5, criado_em: new Date().toISOString() }
    ]
};

function getData() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : initialData;
}

function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

window.db = {
    supabase: { auth: { resetPasswordForEmail: async () => ({ error: null }) } },
    auth: {
        signUp: async (email, password, name) => {
            return { user: { id: 'new', email }, session: {}, error: null };
        },
        signIn: async (email, password) => {
            return { user: initialData.user, error: null };
        },
        signOut: async () => {
            window.location.href = 'login.html';
        },
        getUser: async () => {
            return initialData.user;
        },
        requireAuth: async () => {
            return true;
        },
        updateProfilePicture: async (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const dataUrl = e.target.result;
                    localStorage.setItem('profile_picture', dataUrl);
                    const img = document.getElementById('profile-img') || document.getElementById('profile-img-top');
                    if (img) img.src = dataUrl;
                    const drawerImg = document.getElementById('drawer-profile-img');
                    if (drawerImg) drawerImg.src = dataUrl;
                };
                reader.readAsDataURL(file);
            }
        }
    },
    
    ensureWorkspace: async () => 'mock-workspace-id',
    getCurrentWorkspace: async () => 'mock-workspace-id',
    
    transacoes: {
        list: async () => {
            return getData().transacoes;
        },
        add: async (transacao) => {
            const data = getData();
            const newTx = { ...transacao, id: crypto.randomUUID(), data: transacao.data || new Date().toISOString() };
            data.transacoes.unshift(newTx);
            saveData(data);
            return newTx;
        },
        remove: async (id) => {
            const data = getData();
            data.transacoes = data.transacoes.filter(t => t.id !== id);
            saveData(data);
            return true;
        }
    },
    cartoes: {
        list: async () => {
            return getData().cartoes;
        },
        add: async (cartao) => {
            const data = getData();
            const newC = { ...cartao, id: crypto.randomUUID() };
            data.cartoes.push(newC);
            saveData(data);
            return newC;
        }
    },
    investimentos: {
        list: async () => {
            return getData().investimentos;
        },
        add: async (investimento) => {
            const data = getData();
            const newI = { ...investimento, id: crypto.randomUUID(), criado_em: new Date().toISOString() };
            data.investimentos.push(newI);
            saveData(data);
            return newI;
        }
    },
    metrics: {
        getDashboardMetrics: async () => {
            const data = getData();
            let entradas = 0, saidas = 0, limiteUtilizado = 0;
            data.transacoes.forEach(t => {
                if (t.valor > 0) entradas += Number(t.valor);
                else saidas += Math.abs(Number(t.valor));
                if (t.cartao_id) limiteUtilizado += Math.abs(Number(t.valor));
            });
            const patrimonioTotal = data.investimentos.reduce((sum, i) => sum + Number(i.valor_investido), 0);
            const limiteTotal = data.cartoes.reduce((sum, c) => sum + Number(c.limite), 0);
            const saldo = entradas - saidas;
            return { saldo, entradas, saidas, patrimonioTotal, limiteUtilizado, limiteTotal };
        }
    }
};
