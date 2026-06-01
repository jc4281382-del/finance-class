// db.js - Conexão Real com Supabase para Autenticação
const SUPABASE_URL = 'https://xatxelcacgnuurwyumdn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhdHhlbGNhY2dudXVyd3l1bWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTkyMDcsImV4cCI6MjA5NTYzNTIwN30.XDf8iy7c3Xc-42iXTKjE9B4IShtSCojCQQ8jvbuolDI';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhdHhlbGNhY2dudXVyd3l1bWRuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA1OTIwNywiZXhwIjoyMDk1NjM1MjA3fQ.8-hSqOAkpFIYY-9-2xyUQxqk7JiZi8iXqiecmDBlotM';

// Rename the local variable to avoid conflict with the global 'supabase' variable from the CDN
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = window.supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
});

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
                
                // Criar o workspace usando a chave Service Role para contornar o RLS
                if (data.user) {
                    try {
                        const { data: ws } = await supabaseAdmin.from('workspaces').insert({ nome: 'Meu Workspace' }).select().single();
                        if (ws) {
                            await supabaseAdmin.from('workspace_users').insert({ workspace_id: ws.id, user_id: data.user.id });
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
                
                if (data.user) {
                    await window.db.ensureWorkspace();
                }
                
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
        const { data: ws } = await supabaseAdmin.from('workspaces').insert({ nome: 'Meu Workspace' }).select().single();
        if (ws) {
            await supabaseAdmin.from('workspace_users').insert({ workspace_id: ws.id, user_id: user.id });
            return ws.id;
        }
        return null;
    },
    getCurrentWorkspace: async () => {
        const user = await window.db.auth.getUser();
        if (!user) return null;
        const { data } = await supabaseClient
            .from('workspace_users')
            .select('workspace_id')
            .eq('user_id', user.id)
            .limit(1);
        if (data?.[0]?.workspace_id) return data[0].workspace_id;
        return await window.db.ensureWorkspace();
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
                    data: transacao.data || new Date().toISOString()
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
                .select('valor, cartao_id')
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
            (transacoes || []).forEach(t => {
                if (t.valor > 0) entradas += Number(t.valor);
                else saidas += Math.abs(Number(t.valor));
                if (t.cartao_id) limiteUtilizado += Math.abs(Number(t.valor));
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
