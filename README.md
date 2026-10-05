# 🎯 MapScrapter (Kaptar) — Google Maps Scraper & CRM de Prospecção

Sistema completo de extração, inteligência de contatos e CRM de prospecção fria para leads comerciais do Google Maps.

---

## 🚀 Funcionalidades Principais

- 📍 **Extração & Normalização Google Maps**:
  - Suporte nativo a dados brutos de scrapers (Instant Data Scraper, Apify, Outscraper, CSV, JSON).
  - Normalização automática das classes obfuscadas do Google Maps (`xxVWCe`, `MW4etd`, `UY7F9`, `W4Efsd`, etc.).
  - Classificação inteligente: separa **Site Oficial**, **Instagram (@perfil)** e **WhatsApp (wa.me / celulares)**.

- ⚡ **Varredura Rápida de Instagram & Web (Quick Scan)**:
  - Busca automatizada no DuckDuckGo para encontrar perfis de Instagram, sites e números de WhatsApp que estavam faltando no Google Maps.
  - Execução individual por lead ou em massa pela barra de ferramentas.

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

- 💬 **Scripts de Prospecção Fria no WhatsApp (com Rapport Real)**:
  - 3 scripts de alta conversão gerados dinamicamente com base no **Nome da Empresa** e na **Nota Real do Google**:
    1. *Tráfego Pago & Rapport*
    2. *Criação de Site / Conversão*
    3. *Ultra Curta (Rápida Resposta)*
  - Botão de envio direto via `https://wa.me/...` com mensagem pré-carregada.

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
