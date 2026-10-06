# 🎯 MapScrapter (Kaptar) — Google Maps Scraper & CRM de Prospecção

Sistema completo de extração, inteligência de contatos e CRM de prospecção fria para leads comerciais do Google Maps.

---

## 🚀 Funcionalidades Principais

- 📍 **Extração & Normalização Google Maps**:
  - Suporte nativo a dados brutos de scrapers (Instant Data Scraper, Apify, Outscraper, CSV, JSON).
  - Normalização automática das classes obfuscadas do Google Maps (`xxVWCe`, `MW4etd`, `UY7F9`, `W4Efsd`, etc.).
  - Classificação inteligente: separa **Site Oficial**, **Instagram (@perfil)** e **WhatsApp (wa.me / celulares)**.

- 💾 **Gerenciamento de Sessões / Campanhas (Salvar & Exportar Seções)**:
  - Permite salvar análises de nichos totalmente isoladas (ex: "Academias - Taubaté SP", "Dentistas - Bela Vista SP") sem misturar os leads.
  - Alterne instantaneamente entre sessões salvas no modal `Minhas Sessões`.
  - Opções de exportar sessões individuais em CSV ou JSON a qualquer momento.
  - Backup automático em `data/backups/` ao alternar ou limpar bases.

- 💬 **Mensagem Padrão de Prospecção no WhatsApp (Rapport Rápido)**:
  - O botão de WhatsApp e o link direto abrem imediatamente com a mensagem padrão configurada:
    > *"Olá, tudo bem? Dei uma olhada no google e instagram de vocês e gostei bastante do projeto"*
  - Scripts alternativos personalizados de Tráfego Pago e Criação/Redesign de Site disponíveis com 1 clique no modal de abordagem.

- ⚡ **Varredura Rápida de Contatos & Instagram (Quick Scan)**:
  - Busca automatizada no DuckDuckGo e inspeção direta no site das empresas para capturar números de WhatsApp (`wa.me/`), telefones celulares e perfis no Instagram.
  - Resolve a limitação dos scrapers de listagem rápida do Google Maps que omitem números de telefone nos cartões sumários.

- 🎯 **Identificação do Canal Mais Viável**:
  - Avaliação algorítmica para determinar o melhor ponto de contato para cada lead:
    - 🟢 `WhatsApp Direto` (prioridade máxima se número móvel/wa.me detectado)
    - 🟣 `Instagram DM` (se houver perfil de rede social ativo)
    - 📞 `Ligação Telefônica` (fixo comercial)
    - 🌐 `Formulário Site Oficial`
    - 📍 `Google Maps`

- 📑 **Guias de Gerenciamento & Filtros Rápidos**:
  - `⭐ Alta Nota (4.8+)`: leads com reputação comprovada para abordagem de rapport.
  - `🌐 Com Site`: leads qualificados para tráfego pago, SEO e anúncios.
  - `🚫 Sem Site`: oportunidades imediatas para venda de criação de sites profissionais.
  - `📸 Com Instagram`: leads prontos para prospecção via DM no Instagram.
  - `🟢 Viável WhatsApp`: leads com canal direto pronto para envio de mensagem.
  - `🟣 Viável Instagram DM`: abordagem por direct message.

- 📥 **Importações Múltiplas**:
  - Upload de arquivos `.csv`, `.json`, `.txt`.
  - **Google Planilhas (URL)**: sincronização direta com links públicos do Google Sheets (`/export?format=csv`).
  - Colar texto bruto diretamente no modal.
  - Desduplicação inteligente com opções: Pular existentes, Atualizar dados ou Mesclar.

- ☁️ **Sincronização em Nuvem (Supabase)**:
  - Conexão REST nativa via Supabase API (`/rest/v1/leads`).
  - Script SQL pronto para execução em 1 clique (`supabase_schema.sql`).
  - Sincronização bidirecional: Envio para nuvem e download/restauração direta pelo painel.
  - Armazenamento local persistente em `data/leads.json` com fallback total offline.

- 🌐 **Deploy Serverless na Netlify**:
  - Arquitetura híbrida com Frontend estático em CDN global e Backend Express rodando via Netlify Functions (`netlify/functions/api.js`).
  - Compatibilidade com variáveis de ambiente na nuvem (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).

- 🪨 **Limitador & Compressor de Tokens Caveman**:
  - Compatível com o ecossistema Antigravity/Gemini com compressão de leitura (proxy) e regras de escrita concisa (skills).

---

## 🛠️ Como Executar Localmente

### 1. Pré-requisitos
- Node.js instalado (v18+)

### 2. Instalação
```bash
npm install
```

### 3. Iniciar Servidor
```bash
npm start
# Ou no Windows:
iniciar.bat
```

Acesse no seu navegador: **http://localhost:3333**

---

## ☁️ Configuração no Supabase

1. Crie um projeto gratuito no [Supabase](https://supabase.com).
2. Acesse o **SQL Editor** do projeto.
3. Copie e cole o conteúdo do arquivo [`supabase_schema.sql`](./supabase_schema.sql) e clique em **Run**.
4. No MapScrapter, clique no ícone de ⚙️ **Configurações** no topo direito:
   - Cole a sua **Project URL** (ex: `https://xyzproject.supabase.co`)
   - Cole a sua **Anon / Public Key**
   - Clique em **Salvar Conexão** e depois em **Sincronizar Leads para Supabase**.

---

## 🚀 Como Fazer Deploy na Netlify

1. Faça login na [Netlify](https://app.netlify.com).
2. Clique em **Add new site** > **Import an existing project** > **GitHub**.
3. Selecione o repositório `raruffles/mapscrapter`.
4. As configurações já estão pré-configuradas pelo arquivo `netlify.toml`:
   - **Publish directory**: `public`
   - **Functions directory**: `netlify/functions`
5. (Opcional) Em **Site configuration** > **Environment variables**, adicione:
   - `SUPABASE_URL`: sua URL do Supabase
   - `SUPABASE_ANON_KEY`: sua chave pública anon do Supabase
6. Clique em **Deploy site**!

---

## 📂 Estrutura do Projeto

```
data-scrapter-google/
├── data/
│   ├── leads.json                     # Banco de dados local persistente
│   └── sample_google_maps_taubate.csv # Exemplo de importação Taubaté (120+ academias)
├── netlify/
│   └── functions/
│       └── api.js                     # Handler Serverless para Netlify Functions
├── public/
│   ├── index.html                     # Interface completa Kaptar
│   ├── styles.css                     # Estilização Dark Theme moderna
│   └── app.js                         # Lógica de CRM, Leaflet Maps, filtros e API
├── server.js                          # Servidor Node.js / Express com DuckDuckGo & Supabase
├── netlify.toml                       # Configuração de build e redirects da Netlify
├── supabase_schema.sql                # Script SQL para criar tabelas no Supabase
├── iniciar.bat                        # Script de inicialização Windows
├── package.json
└── README.md
```

---

## 👨‍💻 Autor & Créditos
- **Raphael de Oliveira Lima** — [@raruffles](https://github.com/raruffles)
- Repositório oficial: [https://github.com/raruffles/mapscrapter](https://github.com/raruffles/mapscrapter)
- Interface inspirada no design Kaptar v5.3
