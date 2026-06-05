// db.js - Conexão Real com Supabase para Autenticação
const SUPABASE_URL = 'https://xatxelcacgnuurwyumdn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhdHhlbGNhY2dudXVyd3l1bWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTkyMDcsImV4cCI6MjA5NTYzNTIwN30.XDf8iy7c3Xc-42iXTKjE9B4IShtSCojCQQ8jvbuolDI';
// Rename the local variable to avoid conflict with the global 'supabase' variable from the CDN
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.db = {
    supabase: supabaseClient,
    auth: {
        signUp: async (email, password, name) => {
            try {
                const { data, error } = await supabaseClient.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: name
                        }
                    }
                });
                
                if (error) throw error;
                
                // Criar o workspace
                if (data.user) {
                    try {
                        const newWorkspaceId = crypto.randomUUID();
                        const { error: wsError } = await supabaseClient.from('workspaces').insert({ id: newWorkspaceId, nome: 'Meu Workspace' });
                        if (!wsError) {
                            await supabaseClient.from('workspace_users').insert({ workspace_id: newWorkspaceId, user_id: data.user.id });
                        } else {
                            console.error('Erro ao criar workspace (pode ser RLS)', wsError);
                        }
                    } catch (err) {
                        console.error('Erro ao criar workspace', err);
                    }
                }
                
                return { user: data.user, session: data.session, error: null };
            } catch (error) {
                return { error };
            }
        },
        signIn: async (email, password) => {
            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });
                
                if (error) throw error;
                
                return { user: data.user, error: null };
            } catch (error) {
                return { error };
            }
        },
        signOut: async () => {
            await supabaseClient.auth.signOut();
            window.location.href = 'login.html';
        },
        getUser: async () => {
            const { data: { session } } = await supabaseClient.auth.getSession();
            return session?.user || null;
        },
        requireAuth: async () => {
            const user = await window.db.auth.getUser();
            const isLoginPage = window.location.pathname.includes('login.html');
            
            if (!user && !isLoginPage) {
                window.location.href = 'login.html';
            }
            if (user && isLoginPage) {
                window.location.href = 'inicio.html';
            }
        },
        updateProfilePicture: async (event) => {
            const file = event.target.files[0];
            if (file) {
                // Prevent large files (e.g., max 2MB)
                if (file.size > 2 * 1024 * 1024) {
                    alert('A imagem deve ter no máximo 2MB.');
                    return;
                }
                const reader = new FileReader();
                reader.onload = function(e) {
                    const dataUrl = e.target.result;
                    localStorage.setItem('profile_picture', dataUrl);
                    const img = document.getElementById('profile-img');
                    if (img) img.src = dataUrl;
                    const drawerImg = document.getElementById('drawer-profile-img');
                    if (drawerImg) drawerImg.src = dataUrl;
                };
                reader.readAsDataURL(file);
            }
        }
    },
    
    ensureWorkspace: async () => {
        const user = await window.db.auth.getUser();
        if (!user) return null;
        
        // Verifica se já existe um workspace para evitar duplicatas
        const { data: existing } = await supabaseClient.from('workspace_users').select('workspace_id').eq('user_id', user.id).limit(1);
        if (existing && existing.length > 0) return existing[0].workspace_id;
        
        const newWorkspaceId = crypto.randomUUID();
        const { error: wsError } = await supabaseClient.from('workspaces').insert({ id: newWorkspaceId, nome: 'Meu Workspace' });
        if (!wsError) {
            await supabaseClient.from('workspace_users').insert({ workspace_id: newWorkspaceId, user_id: user.id });
            return newWorkspaceId;
        } else {
            console.error('Erro ao criar workspace no ensureWorkspace:', wsError);
            return null;
        }
    },
    _workspacePromise: null,
    _currentWorkspaceId: null,
    getCurrentWorkspace: async () => {
        if (window.db._currentWorkspaceId) return window.db._currentWorkspaceId;
        if (window.db._workspacePromise) return await window.db._workspacePromise;

        window.db._workspacePromise = (async () => {
            const user = await window.db.auth.getUser();
            if (!user) return null;
            const { data } = await supabaseClient
                .from('workspace_users')
                .select('workspace_id')
                .eq('user_id', user.id)
                .limit(1);
            if (data?.[0]?.workspace_id) {
                window.db._currentWorkspaceId = data[0].workspace_id;
                return window.db._currentWorkspaceId;
            }
            const newId = await window.db.ensureWorkspace();
            if (newId) {
                window.db._currentWorkspaceId = newId;
            }
            return newId;
        })();

        try {
            return await window.db._workspacePromise;
        } finally {
            window.db._workspacePromise = null;
        }
    },
    transacoes: {
        list: async () => {
            const workspaceId = await window.db.getCurrentWorkspace();
            if (!workspaceId) return [];
            const { data } = await supabaseClient
                .from('transacoes')
                .select('*')
                .eq('workspace_id', workspaceId)
                .order('data', { ascending: false });
            return data || [];
        },
        add: async (transacao) => {
            const workspaceId = await window.db.getCurrentWorkspace();
            if (!workspaceId) throw new Error('Nenhum workspace encontrado');
            const { data, error } = await supabaseClient
                .from('transacoes')
                .insert({
                    workspace_id: workspaceId,
                    descricao: transacao.descricao,
                    valor: transacao.valor,
                    categoria: transacao.categoria || 'Outros',
                    cartao_id: transacao.cartao_id || null,
                    parcelas: transacao.parcelas || 1,
                    data: transacao.data || new Date().toISOString(),
                    compra_id_referencia: transacao.compra_id_referencia || null
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        remove: async (id) => {
            const workspaceId = await window.db.getCurrentWorkspace();
            if (!workspaceId) throw new Error('Nenhum workspace encontrado');
            const { error } = await supabaseClient
                .from('transacoes')
                .delete()
                .eq('id', id)
                .eq('workspace_id', workspaceId);
            if (error) throw error;
            return true;
        }
    },
    cartoes: {
        list: async () => {
            const workspaceId = await window.db.getCurrentWorkspace();
            if (!workspaceId) return [];
            const { data } = await supabaseClient
                .from('cartoes_credito')
                .select('*')
                .eq('workspace_id', workspaceId);
            return data || [];
        },
        add: async (cartao) => {
            const workspaceId = await window.db.getCurrentWorkspace();
            if (!workspaceId) throw new Error('Nenhum workspace encontrado');
            const { data, error } = await supabaseClient
                .from('cartoes_credito')
                .insert({
                    workspace_id: workspaceId,
                    nome: cartao.nome,
                    limite: cartao.limite,
                    fechamento_dia: cartao.fechamento_dia,
                    vencimento_dia: cartao.vencimento_dia
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        remove: async (id) => {
            const workspaceId = await window.db.getCurrentWorkspace();
            if (!workspaceId) throw new Error('Nenhum workspace encontrado');
            const { error } = await supabaseClient
                .from('cartoes_credito')
                .delete()
                .eq('id', id)
                .eq('workspace_id', workspaceId);
            if (error) throw error;
            return true;
        }
    },
    investimentos: {
        list: async () => {
            const workspaceId = await window.db.getCurrentWorkspace();
            if (!workspaceId) return [];
            const { data } = await supabaseClient
                .from('investimentos')
                .select('*')
                .eq('workspace_id', workspaceId);
            return data || [];
        },
        add: async (investimento) => {
            const workspaceId = await window.db.getCurrentWorkspace();
            if (!workspaceId) throw new Error('Nenhum workspace encontrado');
            const { data, error } = await supabaseClient
                .from('investimentos')
                .insert({
                    workspace_id: workspaceId,
                    nome: investimento.nome,
                    valor_investido: investimento.valor_investido,
                    rentabilidade: investimento.rentabilidade || 0
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        }
    },
    metrics: {
        getDashboardMetrics: async () => {
            const workspaceId = await window.db.getCurrentWorkspace();
            if (!workspaceId) {
                return { saldo: 0, entradas: 0, saidas: 0, patrimonioTotal: 0, limiteUtilizado: 0, limiteTotal: 0 };
            }
            const { data: transacoes } = await supabaseClient
                .from('transacoes')
                .select('valor, cartao_id, descricao, parcelas')
                .eq('workspace_id', workspaceId);
            const { data: investimentos } = await supabaseClient
                .from('investimentos')
                .select('valor_investido')
                .eq('workspace_id', workspaceId);
            const { data: cartoes } = await supabaseClient
                .from('cartoes_credito')
                .select('limite')
                .eq('workspace_id', workspaceId);
            let entradas = 0, saidas = 0, limiteUtilizado = 0;
            const comprasCartao = (transacoes || []).filter(t => t.cartao_id && t.valor < 0 && !(t.descricao && t.descricao.startsWith('Pgto Parcela')));
            const pagamentosCartao = (transacoes || []).filter(t => t.cartao_id && t.valor > 0 && t.descricao && t.descricao.startsWith('Pgto Parcela'));

            comprasCartao.forEach(compra => {
                const valTotal = Math.abs(Number(compra.valor));
                const pagamentosDessaCompra = pagamentosCartao.filter(p => p.compra_id_referencia === compra.id || (p.descricao && p.descricao.includes(compra.id)));
                const pagoRealizado = pagamentosDessaCompra.reduce((s, p) => s + Math.abs(Number(p.valor)), 0);
                limiteUtilizado += Math.max(0, valTotal - pagoRealizado);
            });

            (transacoes || []).forEach(t => {
                const isPgtoFaturaPositive = t.valor > 0 && t.descricao && t.descricao.startsWith('Pgto Parcela') && t.cartao_id;
                
                if (isPgtoFaturaPositive) {
                    // Ignora esta transação para cálculo de saldo/entradas/saídas da conta, 
                    // pois ela serve apenas para restaurar o limite do cartão.
                } else if (t.valor > 0) {
                    entradas += Number(t.valor);
                } else {
                    if (!t.cartao_id) { saidas += Math.abs(Number(t.valor)); } // Aqui entra a transação negativa "Pagamento Fatura" e as despesas normais
                }
            });
            const patrimonioTotal = (investimentos || []).reduce((sum, i) => sum + Number(i.valor_investido || 0), 0);
            const limiteTotal = (cartoes || []).reduce((sum, c) => sum + Number(c.limite || 0), 0);
            const saldo = entradas - saidas;
            return { saldo, entradas, saidas, patrimonioTotal, limiteUtilizado, limiteTotal };
        }
    }
};

// Verificar autenticação ao carregar
document.addEventListener('DOMContentLoaded', () => {
    window.db.auth.requireAuth();
    
    // Carregar foto de perfil se existir
    const savedProfilePic = localStorage.getItem('profile_picture');
    if (savedProfilePic) {
        const img = document.getElementById('profile-img');
        if (img) img.src = savedProfilePic;
    }
});
