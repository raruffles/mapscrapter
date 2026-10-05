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
    > *"Olá, tudo bem? Dei uma olhada no google e instagram e gostei do projeto de vocês"*
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
  - Armazenamento local persistente em `data/leads.json` com fallback total offline.

---

## 🛠️ Como Executar

### 1. Pré-requisitos
- Node.js instalado (v16+)

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

## 📂 Estrutura do Projeto

```
data-scrapter-google/
├── data/
│   ├── leads.json                     # Banco de dados local persistente
│   └── sample_google_maps_taubate.csv # Exemplo de importação Taubaté (120+ academias)
├── public/
│   ├── index.html                     # Interface completa Kaptar
│   ├── styles.css                     # Estilização Dark Theme moderna
│   └── app.js                         # Lógica de CRM, Leaflet Maps, filtros e API
├── server.js                          # Servidor Node.js / Express com DuckDuckGo & Supabase
├── iniciar.bat                        # Script de inicialização Windows
├── package.json
└── README.md
```

---

## 👨‍💻 Autor & Créditos
- **Raphael de Oliveira Lima** — [@raruffles](https://github.com/raruffles)
- Interface inspirada no design Kaptar v5.3
