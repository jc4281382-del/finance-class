-- Estrutura Multi-Tenant para o Finance Class

-- 1. Criação da Tabela Workspaces
CREATE TABLE public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criação da Tabela de Vínculo entre Usuários e Workspaces
CREATE TABLE public.workspace_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- 3. Criação das Tabelas Filhas (Cartões, Transações, Investimentos)
CREATE TABLE public.cartoes_credito (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    limite DECIMAL(15, 2) NOT NULL,
    fechamento_dia INTEGER NOT NULL,
    vencimento_dia INTEGER NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.transacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    cartao_id UUID REFERENCES public.cartoes_credito(id) ON DELETE SET NULL,
    descricao TEXT NOT NULL,
    valor DECIMAL(15, 2) NOT NULL,
    categoria TEXT NOT NULL,
    data TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    parcelas INTEGER DEFAULT 1,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.investimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    valor_investido DECIMAL(15, 2) NOT NULL,
    rentabilidade DECIMAL(5, 2) DEFAULT 0,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Ativar RLS nas tabelas
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartoes_credito ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investimentos ENABLE ROW LEVEL SECURITY;

-- Workspace Users: Usuário só vê o vínculo se ele for o próprio usuário
CREATE POLICY "Usuários veem seus próprios vínculos" ON public.workspace_users
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem gerenciar seus próprios vínculos" ON public.workspace_users
    FOR ALL USING (auth.uid() = user_id);

-- Workspaces: Usuário só pode ver os workspaces que estão vinculados a ele na tabela workspace_users
CREATE POLICY "Acesso aos próprios workspaces" ON public.workspaces
    FOR ALL USING (
        id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid())
    );

-- Workspaces: Permitir que novos workspaces sejam criados por usuários autenticados
CREATE POLICY "Permitir inserção de workspaces" ON public.workspaces
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Cartões de Crédito: Acesso via Workspace
CREATE POLICY "Acesso aos cartões do workspace" ON public.cartoes_credito
    FOR ALL USING (
        workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid())
    );

-- Transações: Acesso via Workspace
CREATE POLICY "Acesso às transações do workspace" ON public.transacoes
    FOR ALL USING (
        workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid())
    );

-- Investimentos: Acesso via Workspace
CREATE POLICY "Acesso aos investimentos do workspace" ON public.investimentos
    FOR ALL USING (
        workspace_id IN (SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid())
    );
