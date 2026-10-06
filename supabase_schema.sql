-- =========================================================================
-- MAPSCRAPTER - SCHEMA SUPABASE
-- Execute este script no SQL Editor do seu projeto Supabase (Dashboard > SQL Editor)
-- =========================================================================

-- 1. Criar tabela de Leads
CREATE TABLE IF NOT EXISTS public.leads (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "niche" TEXT,
    "category" TEXT,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "rawPhone" TEXT,
    "isMobile" BOOLEAN DEFAULT false,
    "rating" NUMERIC DEFAULT 0,
    "reviewCount" INTEGER DEFAULT 0,
    "website" TEXT,
    "instagram" TEXT,
    "whatsappLink" TEXT,
    "googleMapsUrl" TEXT,
    "imageUrl" TEXT,
    "hasPhone" BOOLEAN DEFAULT false,
    "hasWebsite" BOOLEAN DEFAULT false,
    "hasInstagram" BOOLEAN DEFAULT false,
    "bestContactChannel" TEXT DEFAULT 'whatsapp',
    "type" TEXT,
    "status" TEXT DEFAULT 'Novo',
    "score" INTEGER DEFAULT 0,
    "opportunity" TEXT,
    "lastUpdated" TEXT,
    "notes" TEXT,
    "tags" JSONB DEFAULT '[]'::jsonb,
    "number" TEXT,
    "phoneNumber" TEXT,
    "rawNumber" TEXT,
    "whatsappNumber" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT now()
);

-- 2. Criar tabela de Sessões / Campanhas
CREATE TABLE IF NOT EXISTS public.sessions (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "niche" TEXT,
    "city" TEXT,
    "leadCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "leads" JSONB DEFAULT '[]'::jsonb
);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Acesso (Permite leitura e gravação via Anon Key)
DROP POLICY IF EXISTS "Permitir leitura publica de leads" ON public.leads;
CREATE POLICY "Permitir leitura publica de leads" ON public.leads FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir gravacao publica de leads" ON public.leads;
CREATE POLICY "Permitir gravacao publica de leads" ON public.leads FOR ALL USING (true);

DROP POLICY IF EXISTS "Permitir leitura publica de sessions" ON public.sessions;
CREATE POLICY "Permitir leitura publica de sessions" ON public.sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir gravacao publica de sessions" ON public.sessions;
CREATE POLICY "Permitir gravacao publica de sessions" ON public.sessions FOR ALL USING (true);
