// State Management
let currentTab = 'leads'; // default to 'leads'
let crmActiveTab = 'ativos'; // 'ativos', 'qualificados', 'em_contato', 'fechados', 'arquivados'
let smartActiveTab = 'all'; // 'all', 'high_rating', 'with_site', 'no_site', 'with_instagram', 'viavel_whatsapp', 'viavel_instagram'
let allLeads = [];
let filteredLeads = [];
let selectedNiches = ['Academia'];
let activeFilters = { phone: false, site: false, instagram: false };
let presenceFilter = null; // 'phone', 'site', 'instagram', 'none'
let currentSort = 'mais-viavel';

// Bulk Selection
const selectedLeadIds = new Set();

// Upload Variables
let uploadFileContent = '';
let uploadFileType = 'csv';
let uploadFileName = '';

// WhatsApp Modal Variables
let currentLeadForWhatsApp = null;
let currentLeadTemplates = [];
let activeTemplateIndex = 0;

// Edit Lead Modal Variables
let editingLeadId = null;

// Map Variables
let map = null;
let mapMarker = null;
let mapCircle = null;
let currentCoords = { lat: -23.5629, lon: -46.6548 }; // Bela Vista, São Paulo
let currentRadiusKm = 2;

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  switchPage('leads');
  loadLeads();
  fetchActiveSessionInfo();
});

// Switch Main Page
function switchPage(page) {
  currentTab = page;
  const navBuscar = document.getElementById('nav-buscar-leads');
  const navLeads = document.getElementById('nav-leads');
  const pageBuscar = document.getElementById('page-buscar');
  const pageLeads = document.getElementById('page-leads');

  if (navBuscar) navBuscar.classList.toggle('active', page === 'buscar');
  if (navLeads) navLeads.classList.toggle('active', page === 'leads');
  if (pageBuscar) pageBuscar.classList.toggle('active', page === 'buscar');
  if (pageLeads) pageLeads.classList.toggle('active', page === 'leads');

  const titleEl = document.getElementById('page-title-display');
  if (titleEl) {
    if (page === 'buscar') {
      titleEl.innerText = 'Buscar Leads (Pausado)';
      setTimeout(() => {
        if (map) map.invalidateSize();
      }, 200);
    } else {
      titleEl.innerText = 'Gerenciamento de Leads & Upload';
      loadLeads();
    }
  }
}

// Initialize Leaflet Map
function initMap() {
  const mapContainer = document.getElementById('map');
  if (!mapContainer) return;

  map = L.map('map', {
    zoomControl: true,
    attributionControl: false
  }).setView([currentCoords.lat, currentCoords.lon], 14);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd'
  }).addTo(map);

  const pinIcon = L.divIcon({
    className: 'custom-map-pin',
    html: '<div style="background:#22c55e;color:#000;font-weight:700;font-size:11px;padding:3px 8px;border-radius:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.5);display:flex;align-items:center;gap:4px;"><i class=\"fa-solid fa-location-dot\"></i> Pin 1</div>',
    iconSize: [60, 26],
    iconAnchor: [30, 13]
  });

  mapMarker = L.marker([currentCoords.lat, currentCoords.lon], {
    icon: pinIcon,
    draggable: true
  }).addTo(map);

  mapCircle = L.circle([currentCoords.lat, currentCoords.lon], {
    color: '#22c55e',
    fillColor: '#22c55e',
    fillOpacity: 0.15,
    weight: 2,
    radius: currentRadiusKm * 1000
  }).addTo(map);

  map.on('click', (e) => {
    updateMarkerPosition(e.latlng.lat, e.latlng.lng);
  });

  mapMarker.on('dragend', (e) => {
    const latlng = e.target.getLatLng();
    updateMarkerPosition(latlng.lat, latlng.lng);
  });
}

function updateMarkerPosition(lat, lon) {
  currentCoords = { lat, lon };
  if (mapMarker) mapMarker.setLatLng([lat, lon]);
  if (mapCircle) mapCircle.setLatLng([lat, lon]);
}

function updateRadius(val) {
  currentRadiusKm = parseFloat(val);
  document.getElementById('radius-val').innerText = val;
  if (mapCircle) {
    mapCircle.setRadius(currentRadiusKm * 1000);
  }
}

// Search region / geocoding
async function searchRegionOnMap() {
  const query = document.getElementById('region-input').value.trim();
  if (!query) return;

  try {
    showToast('Buscando localização...');
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Não encontrado');
    const data = await res.json();

    updateMarkerPosition(data.lat, data.lon);
    map.setView([data.lat, data.lon], 14);
    showToast(`Localizado: ${data.name.split(',')[0]}`);
  } catch (err) {
    showToast('Localização não encontrada. Clique no mapa.');
  }
}

// Niche Tags Management
function renderSelectedNiches() {
  const container = document.getElementById('selected-tags');
  if (!container) return;
  container.innerHTML = '';

  selectedNiches.forEach(niche => {
    const pill = document.createElement('span');
    pill.className = 'tag-pill selected';
    pill.innerHTML = `${niche} <i class="fa-solid fa-xmark remove-tag" onclick="removeNiche('${niche}')"></i>`;
    container.appendChild(pill);
  });

  const countEl = document.getElementById('selected-niche-count');
  if (countEl) {
    countEl.innerText = `${selectedNiches.length} selecionada${selectedNiches.length > 1 ? 's' : ''}`;
  }

  document.querySelectorAll('.pill-chip').forEach(btn => {
    const txt = btn.innerText.trim();
    btn.classList.toggle('active', selectedNiches.includes(txt));
  });
}

function toggleNicheChip(btn, niche) {
  if (selectedNiches.includes(niche)) {
    selectedNiches = selectedNiches.filter(n => n !== niche);
  } else {
    selectedNiches.push(niche);
  }
  renderSelectedNiches();
}

function removeNiche(niche) {
  selectedNiches = selectedNiches.filter(n => n !== niche);
  renderSelectedNiches();
}

function clearSelectedNiches() {
  selectedNiches = [];
  renderSelectedNiches();
}

function handleCustomNicheKey(event) {
  if (event.key === 'Enter') {
    addCustomNiche();
  }
}

function addCustomNiche() {
  const input = document.getElementById('custom-niche-input');
  const val = input.value.trim();
  if (val && !selectedNiches.includes(val)) {
    selectedNiches.push(val);
    renderSelectedNiches();
    input.value = '';
  }
}

// Filters toggle (phone, site, instagram)
function toggleFilterChip(el) {
  el.classList.toggle('active');
  activeFilters.phone = document.getElementById('filter-phone').classList.contains('active');
  activeFilters.site = document.getElementById('filter-site').classList.contains('active');
  activeFilters.instagram = document.getElementById('filter-instagram').classList.contains('active');
}

// REAL SCRAPING EXECUTION
async function executeRealScraper() {
  const btn = document.getElementById('btn-start-scrape');
  const statusMsg = document.getElementById('scrape-status-message');
  const region = document.getElementById('region-input').value.trim() || 'Bela Vista, São Paulo - SP';
  const maxResults = parseInt(document.getElementById('max-results-slider').value) || 15;
  const dataSource = document.getElementById('data-source-select').value;
  const niche = selectedNiches[0] || 'Clínicas de Odontologia';

  btn.disabled = true;
  statusMsg.classList.remove('hidden');
  statusMsg.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Conectando a <strong>${dataSource}</strong> e extraindo leads em <strong>${region}</strong>...`;

  try {
    const response = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        niche,
        region,
        lat: currentCoords.lat,
        lon: currentCoords.lon,
        radiusKm: currentRadiusKm,
        maxResults,
        filters: activeFilters,
        dataSource
      })
    });

    const data = await response.json();

    if (data.success) {
      showToast(`🎯 Sucesso! ${data.count} leads reais extraídos com telefone e nota.`);
      setTimeout(() => {
        switchPage('leads');
      }, 1000);
    } else {
      showToast('Aviso: Nenhum novo lead encontrado para os critérios.');
    }
  } catch (err) {
    console.error(err);
    showToast('Erro ao executar o scraper. Verifique a conexão.');
  } finally {
    btn.disabled = false;
    statusMsg.classList.add('hidden');
  }
}

// LOAD LEADS FROM API WITH AUTO-PERSISTENCE
async function loadLeads() {
  try {
    // Purga proativa de cache legado contendo números falsos
    const staleCache = localStorage.getItem('mapscrapter_leads_cache');
    if (staleCache && (staleCache.includes('9122-5471') || staleCache.includes('9122-5472') || staleCache.includes('94074-7584'))) {
      localStorage.removeItem('mapscrapter_leads_cache');
    }

    const res = await fetch('/api/leads');
    allLeads = await res.json();

    // Persistência automática em cache do navegador
    if (Array.isArray(allLeads) && allLeads.length > 0) {
      localStorage.setItem('mapscrapter_leads_cache', JSON.stringify(allLeads));
      localStorage.setItem('mapscrapter_cache_time', new Date().toISOString());
    } else {
      // Se o backend retornou vazio e o usuário NÃO clicou em limpar explicitamente, restaura do cache local
      const cached = localStorage.getItem('mapscrapter_leads_cache');
      const userCleared = localStorage.getItem('mapscrapter_user_cleared');
      if (cached && !userCleared) {
        try {
          const parsedCache = JSON.parse(cached);
          if (Array.isArray(parsedCache) && parsedCache.length > 0) {
            allLeads = parsedCache;
            // Sincroniza de volta para o backend
            fetch('/api/leads/sync-cache', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ leads: allLeads, session: activeSessionMeta })
            }).catch(e => console.warn(e));
          }
        } catch (e) {}
      }
    }

    const countBadge = document.getElementById('sidebar-leads-count');
    if (countBadge) countBadge.innerText = allLeads.length;

    updateTabCounts();
    applyLeadsFilters();
  } catch (err) {
    console.error('Erro ao carregar leads:', err);
    // Fallback de cache offline
    const cached = localStorage.getItem('mapscrapter_leads_cache');
    if (cached) {
      try {
        allLeads = JSON.parse(cached);
        updateTabCounts();
        applyLeadsFilters();
      } catch (e) {}
    }
  }
}

// DOMAIN EXTRACT HELPER
function extractDomain(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url.startsWith('http') ? url : 'https://' + url);
    return parsed.hostname.replace(/^www\./, '');
  } catch (e) {
    return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  }
}

// UPDATE TAB COUNTS
function updateTabCounts() {
  const countAtivos = allLeads.filter(l => l.status !== 'Arquivado').length;
  const countQualificados = allLeads.filter(l => l.status === 'Qualificado').length;
  const countEmContato = allLeads.filter(l => l.status === 'Em Contato').length;
  const countFechados = allLeads.filter(l => l.status === 'Fechado').length;
  const countArquivados = allLeads.filter(l => l.status === 'Arquivado').length;

  const tabAtivos = document.getElementById('tab-count-ativos');
  if (tabAtivos) tabAtivos.innerText = countAtivos;
  const tabQual = document.getElementById('tab-count-qualificados');
  if (tabQual) tabQual.innerText = countQualificados;
  const tabContato = document.getElementById('tab-count-em_contato');
  if (tabContato) tabContato.innerText = countEmContato;
  const tabFech = document.getElementById('tab-count-fechados');
  if (tabFech) tabFech.innerText = countFechados;
  const tabArq = document.getElementById('tab-count-arquivados');
  if (tabArq) tabArq.innerText = countArquivados;

  // SMART COUNTS
  const scAll = document.getElementById('smart-count-all');
  if (scAll) scAll.innerText = allLeads.length;

  const scMaisViaveis = document.getElementById('smart-count-mais-viaveis');
  if (scMaisViaveis) scMaisViaveis.innerText = allLeads.filter(l => !l.hasWebsite && (l.hasPhone || l.hasInstagram)).length;

  const scRetornar = document.getElementById('smart-count-retornar-contato');
  if (scRetornar) scRetornar.innerText = allLeads.filter(l => l.status === 'Retornar Contato').length;

  const scHigh = document.getElementById('smart-count-high-rating');
  if (scHigh) scHigh.innerText = allLeads.filter(l => (l.rating || 0) >= 4.8).length;

  const scWithSite = document.getElementById('smart-count-with-site');
  if (scWithSite) scWithSite.innerText = allLeads.filter(l => l.hasWebsite).length;

  const scNoSite = document.getElementById('smart-count-no-site');
  if (scNoSite) scNoSite.innerText = allLeads.filter(l => !l.hasWebsite).length;

  const scWithIg = document.getElementById('smart-count-with-instagram');
  if (scWithIg) scWithIg.innerText = allLeads.filter(l => l.hasInstagram).length;

  const scWithPhone = document.getElementById('smart-count-with-phone');
  if (scWithPhone) scWithPhone.innerText = allLeads.filter(l => l.hasPhone || l.phone || l.number).length;

  const scViavelWa = document.getElementById('smart-count-viavel-whatsapp');
  if (scViavelWa) scViavelWa.innerText = allLeads.filter(l => l.bestContactChannel === 'whatsapp').length;

  const scViavelIg = document.getElementById('smart-count-viavel-instagram');
  if (scViavelIg) scViavelIg.innerText = allLeads.filter(l => l.bestContactChannel === 'instagram').length;
}

// FILTER BY PIPELINE TAB
function filterByTab(tab) {
  crmActiveTab = tab;
  document.querySelectorAll('.crm-tab').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tab);
  });

  // Reset dropdown filters so clicking the tab displays all leads in this stage
  const scoreSelect = document.getElementById('filter-score-select');
  if (scoreSelect) scoreSelect.value = 'all';

  applyLeadsFilters();
}

// FILTER BY SMART TAB (Nota, Sem Site, Instagram, Viabilidade)
function filterBySmartTab(tab) {
  smartActiveTab = tab;
  document.querySelectorAll('.smart-tab').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-smart') === tab);
  });

  // Reset dropdown filters so clicking the smart tab displays all leads in that category!
  const scoreSelect = document.getElementById('filter-score-select');
  if (scoreSelect) scoreSelect.value = 'all';

  const statusSelect = document.getElementById('filter-status-select');
  if (statusSelect) statusSelect.value = 'all';

  applyLeadsFilters();
}

// RESET ALL FILTERS
function resetAllFilters() {
  const searchInput = document.getElementById('search-leads-input');
  if (searchInput) searchInput.value = '';

  const scoreSelect = document.getElementById('filter-score-select');
  if (scoreSelect) scoreSelect.value = 'all';

  const statusSelect = document.getElementById('filter-status-select');
  if (statusSelect) statusSelect.value = 'all';

  presenceFilter = null;
  document.querySelectorAll('.presence-chip').forEach(b => b.classList.remove('active'));

  applyLeadsFilters();
}

// TOGGLE PRESENCE FILTER
function togglePresenceFilter(btn, type) {
  const wasActive = btn.classList.contains('active');
  document.querySelectorAll('.presence-chip').forEach(b => b.classList.remove('active'));

  if (!wasActive) {
    btn.classList.add('active');
    presenceFilter = type;
  } else {
    presenceFilter = null;
  }
  applyLeadsFilters();
}

// SORTING
function applySort(sortVal) {
  currentSort = sortVal;
  applyLeadsFilters();
}

// APPLY ALL FILTERS & SORT
function applyLeadsFilters() {
  const search = document.getElementById('search-leads-input').value.toLowerCase().trim();
  const scoreFilter = document.getElementById('filter-score-select').value;
  const statusFilter = document.getElementById('filter-status-select').value;

  // Count total leads in current active tab (baseline)
  const tabLeads = allLeads.filter(lead => {
    // 1. Pipeline Tab Filter
    if (crmActiveTab === 'ativos' && lead.status === 'Arquivado') return false;
    if (crmActiveTab === 'qualificados' && lead.status !== 'Qualificado') return false;
    if (crmActiveTab === 'em_contato' && lead.status !== 'Em Contato') return false;
    if (crmActiveTab === 'fechados' && lead.status !== 'Fechado') return false;
    if (crmActiveTab === 'arquivados' && lead.status !== 'Arquivado') return false;

    // 2. Smart Tabs (Guias Inteligentes)
    if (smartActiveTab === 'mais_viaveis' && (lead.hasWebsite || (!lead.hasPhone && !lead.hasInstagram))) return false;
    if (smartActiveTab === 'retornar_contato' && lead.status !== 'Retornar Contato') return false;
    if (smartActiveTab === 'high_rating' && (lead.rating || 0) < 4.8) return false;
    if (smartActiveTab === 'with_site' && !lead.hasWebsite) return false;
    if (smartActiveTab === 'no_site' && lead.hasWebsite) return false;
    if (smartActiveTab === 'with_instagram' && !lead.hasInstagram) return false;
    if (smartActiveTab === 'with_phone' && (!lead.hasPhone && !lead.phone && !lead.number)) return false;
    if (smartActiveTab === 'viavel_whatsapp' && lead.bestContactChannel !== 'whatsapp') return false;
    if (smartActiveTab === 'viavel_instagram' && lead.bestContactChannel !== 'instagram') return false;

    return true;
  });

  filteredLeads = tabLeads.filter(lead => {
    // 3. Status Dropdown
    if (statusFilter !== 'all' && lead.status !== statusFilter) return false;

    // 4. Score Dropdown (85+ Alta Prioridade, 70-84 Boa Oportunidade, < 70 Inicial)
    if (scoreFilter === 'high' && (lead.score || 0) < 85) return false;
    if (scoreFilter === 'medium' && ((lead.score || 0) < 70 || (lead.score || 0) >= 85)) return false;
    if (scoreFilter === 'low' && (lead.score || 0) >= 70) return false;

    // 5. Presence Filter Chips
    if (presenceFilter === 'phone' && !lead.hasPhone) return false;
    if (presenceFilter === 'site' && !lead.hasWebsite) return false;
    if (presenceFilter === 'instagram' && !lead.hasInstagram) return false;
    if (presenceFilter === 'none' && (lead.hasWebsite || lead.hasInstagram)) return false;

    // 6. Search Text
    if (search) {
      const match =
        (lead.name && lead.name.toLowerCase().includes(search)) ||
        (lead.niche && lead.niche.toLowerCase().includes(search)) ||
        (lead.city && lead.city.toLowerCase().includes(search)) ||
        (lead.address && lead.address.toLowerCase().includes(search)) ||
        (lead.phone && lead.phone.toLowerCase().includes(search)) ||
        (lead.instagram && lead.instagram.toLowerCase().includes(search)) ||
        (lead.website && lead.website.toLowerCase().includes(search));
      if (!match) return false;
    }

    return true;
  });

  // Sort
  if (currentSort === 'mais-viavel') {
    filteredLeads.sort((a, b) => {
      // 1º: Priorizar SEM SITE (Oportunidade de ouro para vender site)
      const noSiteA = (!a.hasWebsite || !a.website) ? 1 : 0;
      const noSiteB = (!b.hasWebsite || !b.website) ? 1 : 0;
      if (noSiteB !== noSiteA) return noSiteB - noSiteA;

      // 2º: Priorizar quem tem WhatsApp / Celular
      const waA = (a.isMobile || a.isWhatsapp || a.bestContactChannel === 'whatsapp') ? 1 : 0;
      const waB = (b.isMobile || b.isWhatsapp || b.bestContactChannel === 'whatsapp') ? 1 : 0;
      if (waB !== waA) return waB - waA;

      // 3º: Score de Viabilidade
      const scoreDiff = (b.score || 0) - (a.score || 0);
      if (scoreDiff !== 0) return scoreDiff;

      // 4º: Avaliação do Google
      return (b.rating || 0) - (a.rating || 0);
    });
  } else if (currentSort === 'score-desc') {
    filteredLeads.sort((a, b) => (b.score || 0) - (a.score || 0));
  } else if (currentSort === 'rating-desc') {
    filteredLeads.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (currentSort === 'reviews-desc') {
    filteredLeads.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
  } else if (currentSort === 'name-asc') {
    filteredLeads.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (currentSort === 'date-desc') {
    filteredLeads.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  // Update presence hint
  const withPhone = filteredLeads.filter(l => l.hasPhone).length;
  const withSite = filteredLeads.filter(l => l.hasWebsite).length;
  const withIg = filteredLeads.filter(l => l.hasInstagram).length;
  const hintEl = document.getElementById('presence-count-hint');
  if (hintEl) {
    if (filteredLeads.length < tabLeads.length) {
      hintEl.innerHTML = `<span style="color:#facc15;font-weight:600;"><i class="fa-solid fa-filter"></i> Exibindo ${filteredLeads.length} de ${tabLeads.length} leads</span> <button class="btn-clear-filter-sm" onclick="resetAllFilters()" style="margin-left:8px;background:#1e293b;border:1px solid #334155;color:#93c5fd;border-radius:12px;padding:3px 8px;font-size:0.74rem;cursor:pointer;">Limpar Filtros</button>`;
    } else {
      hintEl.innerText = `${filteredLeads.length} leads (${withPhone} c/ tel, ${withSite} c/ site, ${withIg} c/ IG)`;
    }
  }

  renderTable(filteredLeads);
  updateBulkActionBar();
}

// RENDER TABLE (9 COLUNAS ALINHADAS, ACESSÍVEIS WCAG AA)
function renderTable(leads) {
  const tbody = document.getElementById('leads-table-body');
  tbody.innerHTML = '';

  if (leads.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:50px 20px;color:#94a3b8;">
      <i class="fa-solid fa-filter-circle-xmark" style="font-size:2.2rem;margin-bottom:12px;display:block;color:#64748b;"></i>
      Nenhum lead encontrado com os filtros atuais.<br>
      <button class="btn-primary-highlight" style="margin-top:14px" onclick="openUploadModal()"><i class="fa-solid fa-cloud-arrow-up"></i> Fazer Upload de Leads do Google</button>
      <button class="btn-secondary" style="margin-top:14px; margin-left:8px;" onclick="resetAllFilters()"><i class="fa-solid fa-arrows-rotate"></i> Limpar Filtros</button>
    </td></tr>`;
    return;
  }

  leads.forEach(lead => {
    const tr = document.createElement('tr');
    const isChecked = selectedLeadIds.has(lead.id);

    const statusClean = (lead.status || 'Novo').replace(/\s+/g, '-');
    const statusClass = 'status-' + statusClean;
    const ratingDisplay = lead.rating ? lead.rating.toFixed(1) : '5.0';

    // 1. Canal Mais Viável Badge
    let channelBadgeHtml = '';
    const channel = lead.bestContactChannel || 'phone';
    if (channel === 'whatsapp') {
      channelBadgeHtml = `<span class="channel-badge whatsapp" title="Melhor canal: WhatsApp Direto ativo"><i class="fa-brands fa-whatsapp"></i> WhatsApp</span>`;
    } else if (channel === 'instagram') {
      channelBadgeHtml = `<span class="channel-badge instagram" title="Melhor canal: Direct Message no Instagram"><i class="fa-brands fa-instagram"></i> Instagram DM</span>`;
    } else if (channel === 'phone') {
      channelBadgeHtml = `<span class="channel-badge phone" title="Melhor canal: Ligação comercial telefônica"><i class="fa-solid fa-phone"></i> Telefone</span>`;
    } else if (channel === 'website') {
      channelBadgeHtml = `<span class="channel-badge website" title="Melhor canal: Formulário no site oficial"><i class="fa-solid fa-globe"></i> Site Oficial</span>`;
    } else {
      channelBadgeHtml = `<span class="channel-badge maps" title="Canal: Perfil no Google Maps"><i class="fa-solid fa-location-dot"></i> Google Maps</span>`;
    }

    // 2. Presença Digital (Site oficial vs Instagram)
    const siteDomain = extractDomain(lead.website);
    const siteHtml = lead.hasWebsite && lead.website
      ? `<a href="${lead.website}" target="_blank" class="tag-presence-link tag-site-link" title="Acessar site oficial: ${lead.website}"><i class="fa-solid fa-globe"></i> ${siteDomain || 'Site'}</a>`
      : `<span class="tag-no-site" title="Lead SEM site oficial: Oportunidade máxima para venda de criação de website!"><i class="fa-solid fa-ban"></i> Sem Site</span>`;

    const igClean = lead.instagram ? lead.instagram.replace(/^@/, '') : '';
    const igSearchUrl = `https://www.google.com/search?q=site:instagram.com+${encodeURIComponent(lead.name + ' ' + (lead.city || ''))}`;
    const igHtml = lead.hasInstagram && lead.instagram
      ? `<a href="https://instagram.com/${igClean}" target="_blank" class="tag-presence-link tag-ig-link" title="Instagram: @${igClean}"><i class="fa-brands fa-instagram"></i> @${igClean}</a>`
      : `<a href="${igSearchUrl}" target="_blank" class="tag-search-ig-link" title="Pesquisar perfil no Instagram"><i class="fa-brands fa-instagram" style="opacity:0.6"></i> Buscar IG <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.65rem"></i></a>`;

    // 3. Contato (Telefone / WhatsApp) - Exibido logo no início na tela principal!
    const phoneDisplay = lead.phone || lead.number || '';
    const rawDigits = lead.rawPhone || (phoneDisplay ? phoneDisplay.replace(/\D/g, '') : '');
    const isZap = lead.isMobile || lead.isWhatsapp || (rawDigits.length >= 10 && rawDigits.replace(/^55/, '')[2] === '9');
    const waNumber = rawDigits ? (rawDigits.startsWith('55') ? rawDigits : '55' + rawDigits) : '';
    const defaultMsg = encodeURIComponent('Olá, tudo bem? Dei uma olhada no google e instagram de vocês e gostei bastante do projeto');

    let contactCellHtml = '';
    if (phoneDisplay) {
      if (isZap) {
        contactCellHtml = `
          <div class="contact-card-box whatsapp-box">
            <a href="https://wa.me/${waNumber}?text=${defaultMsg}" target="_blank" class="contact-pill-link whatsapp-pill" title="Iniciar conversa no WhatsApp com mensagem padrão">
              <i class="fa-brands fa-whatsapp text-green"></i> <span class="phone-number-txt">${phoneDisplay}</span>
            </a>
            <button class="btn-copy-contact" onclick="copyContactNumber('${phoneDisplay}')" title="Copiar número para área de transferência">
              <i class="fa-regular fa-copy"></i>
            </button>
          </div>
        `;
      } else {
        contactCellHtml = `
          <div class="contact-card-box phone-box">
            <a href="tel:${rawDigits || phoneDisplay}" class="contact-pill-link phone-pill" title="Ligar para telefone fixo">
              <i class="fa-solid fa-phone text-blue"></i> <span class="phone-number-txt">${phoneDisplay}</span>
            </a>
            <button class="btn-copy-contact" onclick="copyContactNumber('${phoneDisplay}')" title="Copiar número para área de transferência">
              <i class="fa-regular fa-copy"></i>
            </button>
          </div>
        `;
      }
    } else {
      const googleSearchPhoneUrl = `https://www.google.com/search?q=${encodeURIComponent(lead.name + ' ' + (lead.city || '') + ' telefone whatsapp')}`;
      contactCellHtml = `
        <div class="contact-empty-box">
          <span class="no-phone-tag"><i class="fa-solid fa-phone-slash"></i> Sem telefone</span>
          <button class="btn-quick-search-phone" onclick="searchContactForLead('${lead.id}')" title="Buscar telefone e WhatsApp no DuckDuckGo">
            <i class="fa-solid fa-magnifying-glass"></i> Buscar
          </button>
          <a href="${googleSearchPhoneUrl}" target="_blank" class="btn-web-search-phone" title="Pesquisar no Google"><i class="fa-brands fa-google"></i></a>
        </div>
      `;
    }

    // 4. Endereço limpo e Links Diretos (Google Search e Google Maps)
    const cityDisplay = lead.city || 'Taubaté - SP';
    const addressDisplay = lead.address ? lead.address.substring(0, 36) + (lead.address.length > 36 ? '...' : '') : cityDisplay;
    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent((lead.name || '') + ' ' + (lead.city || 'Taubaté'))}`;
    const mapsUrl = lead.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((lead.name || '') + ' ' + (lead.address || lead.city || 'Taubaté'))}`;

    tr.innerHTML = `
      <td><input type="checkbox" class="lead-check" value="${lead.id}" ${isChecked ? 'checked' : ''} onchange="toggleSelectLead('${lead.id}', this.checked)"></td>
      <td>
        <div class="company-cell">
          <div class="company-name-row">
            <a href="${googleSearchUrl}" target="_blank" rel="noopener noreferrer" class="company-name-link" title="Pesquisar '${lead.name}' diretamente no Google">
              ${lead.name} <i class="fa-brands fa-google text-blue google-search-icon" title="Abrir busca no Google"></i>
            </a>
          </div>
          <div class="company-meta-row">
            <span class="company-sub">${lead.niche || 'Geral'}</span>
            <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="company-maps-link" title="Abrir localização no Google Maps">
              📍 ${addressDisplay} <i class="fa-solid fa-arrow-up-right-from-square maps-ext-icon"></i>
            </a>
          </div>
        </div>
      </td>
      <td style="text-align: center;">
        <div class="google-rating-col">
          <span class="google-rating-pill" title="Avaliação Google: ${ratingDisplay} com ${lead.reviewCount || 0} avaliações">
            <i class="fa-solid fa-star"></i> ${ratingDisplay} <span class="review-count">(${lead.reviewCount || 0})</span>
          </span>
        </div>
      </td>
      <td>
        ${channelBadgeHtml}
      </td>
      <td>
        <div class="presence-tags-cell">
          ${siteHtml}
          ${igHtml}
        </div>
      </td>
      <td>
        <div class="phone-cell">
          ${contactCellHtml}
        </div>
      </td>
      <td>
        <select class="status-pill-select ${statusClass}" onchange="updateLeadStatus('${lead.id}', this.value)">
          <option value="Novo" ${lead.status === 'Novo' ? 'selected' : ''}>🔵 Novo</option>
          <option value="Retornar Contato" ${lead.status === 'Retornar Contato' ? 'selected' : ''}>⏰ Retornar Contato</option>
          <option value="Em Contato" ${lead.status === 'Em Contato' ? 'selected' : ''}>💬 Em Contato</option>
          <option value="Qualificado" ${lead.status === 'Qualificado' ? 'selected' : ''}>⭐ Qualificado</option>
          <option value="Fechado" ${lead.status === 'Fechado' ? 'selected' : ''}>🤝 Fechado</option>
          <option value="Arquivado" ${lead.status === 'Arquivado' ? 'selected' : ''}>📁 Arquivado</option>
        </select>
      </td>
      <td>
        <div class="score-cell" title="Pontuação de Viabilidade: ${lead.score || 85}/100">
          <div class="score-bar">
            <div class="score-fill" style="width: ${lead.score || 85}%;"></div>
          </div>
          <span class="score-num">${lead.score || 85}</span>
        </div>
      </td>
      <td>
        <div class="actions-cell">
          <!-- WHATSAPP PROSPECTING MODAL ACTION -->
          <button class="action-btn wa-btn" onclick="openWhatsAppModal('${lead.id}')" title="Gerar Prospecção Fria WhatsApp com Rapport">
            <i class="fa-brands fa-whatsapp"></i>
          </button>
          <!-- INSTAGRAM ACTION -->
          ${lead.hasInstagram && igClean
            ? `<a href="https://instagram.com/${igClean}" target="_blank" class="action-btn" title="Abrir perfil no Instagram" style="color:#e1306c"><i class="fa-brands fa-instagram"></i></a>`
            : `<button class="action-btn" onclick="startInstagramQuickScan(['${lead.id}'])" title="Buscar Instagram deste lead no DuckDuckGo"><i class="fa-brands fa-instagram" style="opacity:0.5"></i></button>`
          }
          <!-- RETORNAR CONTATO TOGGLE -->
          <button class="action-btn ${lead.status === 'Retornar Contato' ? 'clock-active' : ''}" onclick="toggleRetornarContato('${lead.id}')" title="Marcar para Retornar Contato mais tarde">
            <i class="fa-solid fa-clock"></i>
          </button>
          <!-- STAR / QUALIFY -->
          <button class="action-btn ${lead.status === 'Qualificado' ? 'starred' : ''}" onclick="toggleQualify('${lead.id}')" title="Qualificar Lead">
            <i class="fa-solid fa-star"></i>
          </button>
          <!-- EDIT / MANAGE -->
          <button class="action-btn" onclick="openEditLeadModal('${lead.id}')" title="Editar Informações Completas">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <!-- DELETE -->
          <button class="action-btn delete-btn" onclick="deleteLead('${lead.id}')" title="Excluir Lead">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// BULK ACTIONS
function toggleSelectLead(id, checked) {
  if (checked) {
    selectedLeadIds.add(id);
  } else {
    selectedLeadIds.delete(id);
  }
  updateBulkActionBar();
}

function toggleSelectAll(master) {
  if (master.checked) {
    filteredLeads.forEach(l => selectedLeadIds.add(l.id));
  } else {
    selectedLeadIds.clear();
  }
  document.querySelectorAll('.lead-check').forEach(cb => {
    cb.checked = master.checked;
  });
  updateBulkActionBar();
}

function clearSelection() {
  selectedLeadIds.clear();
  document.getElementById('check-all-leads').checked = false;
  document.querySelectorAll('.lead-check').forEach(cb => { cb.checked = false; });
  updateBulkActionBar();
}

function updateBulkActionBar() {
  const bar = document.getElementById('bulk-actions-bar');
  const countEl = document.getElementById('bulk-selected-count');
  if (selectedLeadIds.size > 0) {
    bar.classList.remove('hidden');
    countEl.innerText = `${selectedLeadIds.size} lead${selectedLeadIds.size > 1 ? 's' : ''} selecionado${selectedLeadIds.size > 1 ? 's' : ''}`;
  } else {
    bar.classList.add('hidden');
  }
}

async function applyBulkStatus(status) {
  if (!status || selectedLeadIds.size === 0) return;
  const ids = Array.from(selectedLeadIds);

  try {
    const res = await fetch('/api/leads/bulk-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status })
    });
    if (res.ok) {
      showToast(`✅ ${ids.length} leads atualizados para "${status}"`);
      document.getElementById('bulk-status-select').value = '';
      clearSelection();
      loadLeads();
    }
  } catch (err) {
    showToast('Erro ao atualizar status em massa');
  }
}

async function applyBulkDelete() {
  if (selectedLeadIds.size === 0) return;
  const count = selectedLeadIds.size;
  if (!confirm(`Deseja realmente excluir os ${count} leads selecionados? Esta ação não pode ser desfeita.`)) return;

  const ids = Array.from(selectedLeadIds);
  try {
    const res = await fetch('/api/leads/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    if (res.ok) {
      showToast(`🗑️ ${count} leads excluídos com sucesso.`);
      clearSelection();
      loadLeads();
    }
  } catch (err) {
    showToast('Erro ao excluir leads em massa');
  }
}

// UPDATE SINGLE LEAD STATUS
async function updateLeadStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      const idx = allLeads.findIndex(l => l.id === id);
      if (idx !== -1) allLeads[idx].status = newStatus;
      updateTabCounts();
      applyLeadsFilters();
      showToast(`Status atualizado: ${newStatus}`);
    }
  } catch (err) {
    showToast('Erro ao atualizar status');
  }
}

function toggleQualify(id) {
  const lead = allLeads.find(l => l.id === id);
  if (!lead) return;
  const newStatus = lead.status === 'Qualificado' ? 'Novo' : 'Qualificado';
  updateLeadStatus(id, newStatus);
}

function toggleDealClosed(id) {
  const lead = allLeads.find(l => l.id === id);
  if (!lead) return;
  const newStatus = lead.status === 'Fechado' ? 'Novo' : 'Fechado';
  updateLeadStatus(id, newStatus);
}

async function deleteLead(id) {
  if (!confirm('Deseja realmente excluir este lead?')) return;
  try {
    const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' });
    if (res.ok) {
      allLeads = allLeads.filter(l => l.id !== id);
      selectedLeadIds.delete(id);
      document.getElementById('sidebar-leads-count').innerText = allLeads.length;
      updateTabCounts();
      applyLeadsFilters();
      showToast('Lead removido com sucesso.');
    }
  } catch (err) {
    showToast('Erro ao excluir lead');
  }
}

// DEDUPLICATE DATABASE
async function deduplicateDatabase() {
  if (!confirm('Deseja procurar e fundir cadastros duplicados (mesmo nome ou telefone)?')) return;
  try {
    showToast('🧹 Escaneando base por duplicados...');
    const res = await fetch('/api/leads/deduplicate', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ ${data.duplicatesRemoved} duplicados removidos. Restam ${data.totalRemaining} leads únicos.`);
      loadLeads();
    }
  } catch (err) {
    showToast('Erro ao remover duplicados');
  }
}

// CLEAR ALL LEADS (Zerar base para nova planilha limpa)
async function clearAllLeads() {
  if (!confirm('Deseja realmente limpar todos os leads da base para importar uma nova planilha limpa?')) return;
  try {
    showToast('🗑️ Limpando base de leads...');
    const res = await fetch('/api/leads/clear-all', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      localStorage.removeItem('mapscrapter_leads_cache');
      localStorage.setItem('mapscrapter_user_cleared', 'true');
      activeSessionMeta = { id: null, name: 'Tabela Vazia' };
      updateActiveSessionHeaderUI();
      showToast('Base limpa com sucesso! Pronto para carregar nova planilha.');
      loadLeads();
    }
  } catch (err) {
    showToast('Erro ao limpar base: ' + err.message);
  }
}

// UPLOAD MODAL & DRAG AND DROP
function openUploadModal() {
  document.getElementById('upload-modal').classList.remove('hidden');
  uploadFileContent = '';
  document.getElementById('selected-file-name').classList.add('hidden');
  document.getElementById('upload-preview-container').classList.add('hidden');
  document.getElementById('btn-confirm-upload').disabled = true;
}

function closeUploadModal() {
  document.getElementById('upload-modal').classList.add('hidden');
}

function switchUploadMode(mode) {
  const tabFile = document.getElementById('tab-file-mode');
  const tabSheets = document.getElementById('tab-sheets-mode');
  const tabText = document.getElementById('tab-text-mode');

  if (tabFile) tabFile.classList.toggle('active', mode === 'file');
  if (tabSheets) tabSheets.classList.toggle('active', mode === 'sheets');
  if (tabText) tabText.classList.toggle('active', mode === 'text');

  const zoneFile = document.getElementById('file-drop-zone');
  const zoneSheets = document.getElementById('sheets-input-zone');
  const zoneText = document.getElementById('text-input-zone');

  if (zoneFile) zoneFile.classList.toggle('hidden', mode !== 'file');
  if (zoneSheets) zoneSheets.classList.toggle('hidden', mode !== 'sheets');
  if (zoneText) zoneText.classList.toggle('hidden', mode !== 'text');
}

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('file-drop-zone').classList.add('dragover');
}

function handleDragLeave(e) {
  e.preventDefault();
  document.getElementById('file-drop-zone').classList.remove('dragover');
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('file-drop-zone').classList.remove('dragover');
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    processSelectedFile(e.dataTransfer.files[0]);
  }
}

function handleFileSelected(e) {
  if (e.target.files && e.target.files[0]) {
    processSelectedFile(e.target.files[0]);
  }
}

function processSelectedFile(file) {
  uploadFileName = file.name;

  const badge = document.getElementById('selected-file-name');
  const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
  const iconClass = isExcel ? 'fa-solid fa-file-excel text-green' : (file.name.endsWith('.json') ? 'fa-solid fa-file-code' : 'fa-solid fa-file-csv');
  badge.innerHTML = `<i class="${iconClass}"></i> <strong>${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)`;
  badge.classList.remove('hidden');

  // Excel (.xlsx, .xls) native support via SheetJS
  if (isExcel) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        if (typeof XLSX === 'undefined') {
          showToast('Biblioteca XLSX inicializando, tente novamente em 2 segundos...');
          return;
        }
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        uploadFileContent = JSON.stringify(rows);
        uploadFileType = 'json';
        parseAndPreviewUpload(uploadFileContent, 'json');
      } catch (err) {
        showToast('Erro ao ler planilha Excel: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    return;
  }

  // Text, CSV, JSON
  uploadFileType = file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv';
  const reader = new FileReader();
  reader.onload = function(evt) {
    uploadFileContent = evt.target.result;
    parseAndPreviewUpload(uploadFileContent, uploadFileType);
  };
  reader.readAsText(file, 'utf-8');
}

function previewRawText() {
  const text = document.getElementById('raw-upload-textarea').value.trim();
  if (!text) {
    showToast('Cole o conteúdo no campo de texto antes de analisar');
    return;
  }
  uploadFileContent = text;
  uploadFileType = text.startsWith('[') || text.startsWith('{') ? 'json' : 'csv';
  parseAndPreviewUpload(uploadFileContent, uploadFileType);
}

function parseAndPreviewUpload(content, type) {
  let sampleRows = [];
  let totalCount = 0;

  try {
    if (type === 'json' || content.trim().startsWith('[') || content.trim().startsWith('{')) {
      const parsed = JSON.parse(content);
      const arr = Array.isArray(parsed) ? parsed : (parsed.data || parsed.results || [parsed]);
      totalCount = arr.length;
      sampleRows = arr.slice(0, 4);
    } else {
      // Basic CSV splitting for preview
      const lines = content.split(/\r?\n/).filter(Boolean);
      totalCount = Math.max(lines.length - 1, 0);
      const headerLine = lines[0] || '';
      const delim = headerLine.includes(';') ? ';' : ',';
      const headers = headerLine.split(delim).map(h => h.replace(/["']/g, '').trim());

      for (let i = 1; i < Math.min(lines.length, 5); i++) {
        const parts = lines[i].split(delim);
        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = parts[idx] ? parts[idx].replace(/["']/g, '').trim() : '';
        });
        sampleRows.push(obj);
      }
    }

    if (totalCount > 0) {
      document.getElementById('upload-preview-container').classList.remove('hidden');
      document.getElementById('preview-count-label').innerHTML = `<strong>${totalCount}</strong> leads identificados no arquivo`;
      document.getElementById('btn-confirm-upload').disabled = false;

      // Render sample table
      const pBody = document.getElementById('preview-table-body');
      pBody.innerHTML = '';
      sampleRows.forEach(row => {
        const tr = document.createElement('tr');
        const keys = Object.keys(row);
        const nameVal = row.title || row.name || row.nome || row.company || row.xxVWCe || row[keys[0]] || 'Sem nome';

        // Detecção fiel de telefone na prévia do arquivo enviado pelo usuário
        let phoneVal = '—';
        for (const k of keys) {
          const lk = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
          if (lk.includes('phone') || lk.includes('telef') || lk.includes('cel') || lk.includes('whats') || lk.includes('zap') || lk.includes('fone') || lk.includes('contat') || lk === 'tel' || lk === 'usdlk' || lk === 'csenbe') {
            if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
              phoneVal = String(row[k]).trim().replace(/\.0+$/, '');
              break;
            }
          }
        }
        if (phoneVal === '—') {
          for (const k of keys) {
            const vStr = String(row[k] || '').trim().replace(/\.0+$/, '');
            const digits = vStr.replace(/\D/g, '');
            if (digits.length >= 8 && digits.length <= 13 && !vStr.includes('http') && !vStr.includes('@') && !vStr.includes('·')) {
              phoneVal = vStr;
              break;
            }
          }
        }

        const ratingVal = row.totalScore || row.rating || row.nota || row.stars || row.MW4etd || '5.0';
        const siteVal = row.website || row.site || row.url || '—';
        const addrVal = row.address || row.endereco || row.full_address || row['W4Efsd 4'] || row['W4Efsd 3'] || '—';

        tr.innerHTML = `
          <td><strong>${nameVal}</strong></td>
          <td>${phoneVal !== '—' ? `<span class="badge-success">${phoneVal}</span>` : '<span style="opacity:0.5">Sem telefone</span>'}</td>
          <td>⭐ ${ratingVal}</td>
          <td>${siteVal !== '—' ? 'Sim' : 'Não'}</td>
          <td>${addrVal.substring(0, 30)}...</td>
        `;
        pBody.appendChild(tr);
      });
      // Auto-detect niche from sample rows
      let detectedNiche = '';
      for (const row of sampleRows) {
        const val = row.W4Efsd || row.categoryName || row.category || row.categories || row.nicho || row.tipo || row.type || row.Categoria;
        if (val && typeof val === 'string' && val.trim().length > 1 && !val.includes('http') && val !== '·' && val !== '') {
          detectedNiche = val.trim();
          break;
        }
      }
      if (!detectedNiche && sampleRows.length > 0) {
        const sampleNames = sampleRows.map(r => Object.values(r)[0] || '').join(' ').toLowerCase();
        if (sampleNames.includes('academia') || sampleNames.includes('fit') || sampleNames.includes('crossfit')) detectedNiche = 'Academia';
        else if (sampleNames.includes('barbearia') || sampleNames.includes('barber')) detectedNiche = 'Barbearia';
        else if (sampleNames.includes('restaurante') || sampleNames.includes('pizzaria')) detectedNiche = 'Restaurante';
      }

      if (detectedNiche) {
        const nicheInput = document.getElementById('upload-default-nicho');
        if (nicheInput) nicheInput.value = detectedNiche;
      }

      showToast(`Arquivo analisado: ${totalCount} registros prontos para importação! ${detectedNiche ? 'Nicho detectado: ' + detectedNiche : ''}`);
    } else {
      showToast('Nenhum registro legível encontrado.');
    }
  } catch (err) {
    showToast('Erro ao interpretar o formato do arquivo: ' + err.message);
  }
}

async function processUploadExecution() {
  if (!uploadFileContent) {
    showToast('Selecione ou cole um arquivo primeiro.');
    return;
  }

  const btn = document.getElementById('btn-confirm-upload');
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processando & Normalizando...`;

  const defaultNiche = document.getElementById('upload-default-nicho').value.trim() || '';
  const deduplicateOption = document.getElementById('upload-dedup-select').value;

  try {
    const res = await fetch('/api/leads/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileContent: uploadFileContent,
        fileType: uploadFileType,
        fileName: uploadFileName,
        defaultNiche,
        deduplicateOption
      })
    });

    const data = await res.json();
    if (data.success) {
      localStorage.removeItem('mapscrapter_user_cleared');
      if (data.activeSession) {
        activeSessionMeta = data.activeSession;
        updateActiveSessionHeaderUI();
      }
      closeUploadModal();
      await loadLeads();
      switchPage('leads');
      const sessName = activeSessionMeta && activeSessionMeta.name ? activeSessionMeta.name : 'Sessão salva';
      showToast(`🎉 ${data.importedCount} leads importados! Sessão "${sessName}" salva automaticamente.`);
    } else {
      showToast('Erro: ' + (data.error || 'Falha ao processar arquivo'));
    }
  } catch (err) {
    showToast('Erro de conexão ao enviar o arquivo.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Confirmar & Importar Leads`;
  }
}

// EDIT / NEW LEAD MODAL
function openNewLeadModal() {
  editingLeadId = null;
  document.getElementById('edit-lead-title').innerText = 'Cadastrar Novo Lead';
  document.getElementById('edit-lead-subtitle').innerText = 'Insira os dados da empresa para prospecção';
  document.getElementById('edit-lead-id').value = '';
  document.getElementById('edit-lead-name').value = '';
  document.getElementById('edit-lead-niche').value = 'Academia';
  document.getElementById('edit-lead-phone').value = '';
  document.getElementById('edit-lead-status').value = 'Novo';
  document.getElementById('edit-lead-rating').value = '5.0';
  document.getElementById('edit-lead-reviews').value = '50';
  document.getElementById('edit-lead-website').value = '';
  document.getElementById('edit-lead-instagram').value = '';
  document.getElementById('edit-lead-address').value = '';
  document.getElementById('edit-lead-city').value = 'Taubaté - SP';
  document.getElementById('edit-lead-notes').value = '';
  document.getElementById('btn-delete-from-modal').classList.add('hidden');

  document.getElementById('edit-lead-modal').classList.remove('hidden');
}

function openEditLeadModal(id) {
  const lead = allLeads.find(l => l.id === id);
  if (!lead) return;

  editingLeadId = id;
  document.getElementById('edit-lead-title').innerText = 'Editar Lead & Follow-up';
  document.getElementById('edit-lead-subtitle').innerText = `Gerenciando dados de: ${lead.name}`;
  document.getElementById('edit-lead-id').value = lead.id;
  document.getElementById('edit-lead-name').value = lead.name || '';
  document.getElementById('edit-lead-niche').value = lead.niche || 'Geral';
  document.getElementById('edit-lead-phone').value = lead.phone || '';
  document.getElementById('edit-lead-status').value = lead.status || 'Novo';
  document.getElementById('edit-lead-rating').value = lead.rating || 5.0;
  document.getElementById('edit-lead-reviews').value = lead.reviewCount || 0;
  document.getElementById('edit-lead-website').value = lead.website || '';
  document.getElementById('edit-lead-instagram').value = lead.instagram || '';
  document.getElementById('edit-lead-address').value = lead.address || '';
  document.getElementById('edit-lead-city').value = lead.city || 'Taubaté - SP';
  document.getElementById('edit-lead-notes').value = lead.notes || '';
  document.getElementById('btn-delete-from-modal').classList.remove('hidden');

  document.getElementById('edit-lead-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-lead-modal').classList.add('hidden');
}

async function saveLeadEdit() {
  const name = document.getElementById('edit-lead-name').value.trim();
  if (!name) {
    showToast('O nome da empresa é obrigatório.');
    return;
  }

  const payload = {
    name,
    niche: document.getElementById('edit-lead-niche').value.trim(),
    phone: document.getElementById('edit-lead-phone').value.trim(),
    status: document.getElementById('edit-lead-status').value,
    rating: parseFloat(document.getElementById('edit-lead-rating').value) || 5.0,
    reviewCount: parseInt(document.getElementById('edit-lead-reviews').value) || 0,
    website: document.getElementById('edit-lead-website').value.trim(),
    instagram: document.getElementById('edit-lead-instagram').value.trim(),
    address: document.getElementById('edit-lead-address').value.trim(),
    city: document.getElementById('edit-lead-city').value.trim(),
    notes: document.getElementById('edit-lead-notes').value.trim()
  };

  try {
    if (editingLeadId) {
      // Update
      const res = await fetch(`/api/leads/${editingLeadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('Lead atualizado com sucesso!');
        closeEditModal();
        loadLeads();
      }
    } else {
      // Create Manual
      const res = await fetch('/api/leads/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('Novo lead cadastrado com sucesso!');
        closeEditModal();
        loadLeads();
      }
    }
  } catch (err) {
    showToast('Erro ao salvar lead.');
  }
}

function deleteCurrentEditLead() {
  if (editingLeadId) {
    closeEditModal();
    deleteLead(editingLeadId);
  }
}

// WHATSAPP COLD PROSPECTING MODAL
async function openWhatsAppModal(id) {
  currentLeadForWhatsApp = allLeads.find(l => l.id === id);
  if (!currentLeadForWhatsApp) return;

  const modal = document.getElementById('whatsapp-modal');
  modal.classList.remove('hidden');

  document.getElementById('whatsapp-lead-subtitle').innerText = `${currentLeadForWhatsApp.niche || 'Empresa'} • ${currentLeadForWhatsApp.city || 'Taubaté - SP'}`;
  document.getElementById('modal-rep-name').innerText = currentLeadForWhatsApp.name;
  document.getElementById('modal-rep-score').innerText = `⭐ ${currentLeadForWhatsApp.rating ? currentLeadForWhatsApp.rating.toFixed(1) : '4.9'} no Google (${currentLeadForWhatsApp.reviewCount || 100}+ avaliações)`;
  document.getElementById('modal-rep-phone').innerText = currentLeadForWhatsApp.phone || 'Sem telefone';

  try {
    const res = await fetch(`/api/templates/${id}`);
    const data = await res.json();
    currentLeadTemplates = data.templates;
    activeTemplateIndex = 0;
    renderActiveTemplate();
  } catch (err) {
    console.error(err);
  }
}

function selectScriptTab(index) {
  activeTemplateIndex = index;
  document.querySelectorAll('.script-tab').forEach((tab, i) => {
    tab.classList.toggle('active', i === index);
  });
  renderActiveTemplate();
}

function renderActiveTemplate() {
  if (!currentLeadTemplates || currentLeadTemplates.length === 0) return;
  const tpl = currentLeadTemplates[activeTemplateIndex];
  document.getElementById('script-objective-label').innerText = tpl.objective;
  document.getElementById('whatsapp-message-text').value = tpl.message;
}

function closeWhatsAppModal() {
  document.getElementById('whatsapp-modal').classList.add('hidden');
}

function copyWhatsAppMessage() {
  const text = document.getElementById('whatsapp-message-text').value;
  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 Mensagem copiada para a área de transferência!');
  });
}

function openDirectWhatsApp() {
  const defaultMsg = 'Olá, tudo bem? Dei uma olhada no google e instagram de vocês e gostei bastante do projeto';
  const textVal = document.getElementById('whatsapp-message-text') ? document.getElementById('whatsapp-message-text').value.trim() : '';
  const text = textVal || defaultMsg;
  const rawPhone = currentLeadForWhatsApp.rawPhone || (currentLeadForWhatsApp.phone ? currentLeadForWhatsApp.phone.replace(/\D/g, '') : '');

  let fullPhone = rawPhone;
  if (fullPhone.length === 10 || fullPhone.length === 11) {
    fullPhone = '55' + fullPhone;
  }

  const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
  markAsContacted();
}

function markAsContacted() {
  if (currentLeadForWhatsApp) {
    updateLeadStatus(currentLeadForWhatsApp.id, 'Em Contato');
    closeWhatsAppModal();
  }
}

// EXPORT DROPDOWN TOGGLE
function toggleExportMenu() {
  const menu = document.getElementById('export-dropdown');
  menu.classList.toggle('hidden');
}

document.addEventListener('click', (e) => {
  const wrapper = document.querySelector('.dropdown-wrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    const dropdown = document.getElementById('export-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
  }
});

// GOOGLE SHEETS DIRECT IMPORT
async function importFromGoogleSheets() {
  const urlInput = document.getElementById('sheets-url-input');
  const sheetUrl = urlInput ? urlInput.value.trim() : '';

  if (!sheetUrl) {
    showToast('Por favor, cole a URL pública da planilha do Google.');
    return;
  }

  const defaultNiche = document.getElementById('upload-default-nicho').value.trim() || 'Google Planilhas';
  const deduplicateOption = document.getElementById('upload-dedup-select').value;

  showToast('📥 Baixando e organizando dados do Google Planilhas...');
  try {
    const res = await fetch('/api/leads/google-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetUrl, defaultNiche, deduplicateOption })
    });

    const data = await res.json();
    if (data.success) {
      localStorage.removeItem('mapscrapter_user_cleared');
      if (data.activeSession) {
        activeSessionMeta = data.activeSession;
        updateActiveSessionHeaderUI();
      }
      closeUploadModal();
      await loadLeads();
      switchPage('leads');
      const sessName = activeSessionMeta && activeSessionMeta.name ? activeSessionMeta.name : 'Google Planilhas';
      showToast(`🎉 Planilha sincronizada! Sessão "${sessName}" salva automaticamente.`);
    } else {
      showToast('Erro: ' + (data.error || 'Falha ao sincronizar planilha'));
    }
  } catch (err) {
    showToast('Erro ao conectar com Google Planilhas: ' + err.message);
  }
}

// INSTAGRAM & WEB QUICK SCAN
async function startInstagramQuickScan(specificIds = null) {
  const btn = document.getElementById('btn-quick-scan-ig');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Varrendo Web...`;
  }

  showToast('⚡ Varrendo web e DuckDuckGo por perfis do Instagram e WhatsApp...');

  try {
    const targetIds = specificIds || (selectedLeadIds.size > 0 ? Array.from(selectedLeadIds) : null);
    const res = await fetch('/api/leads/quick-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: targetIds,
        limit: 20
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`✨ Varredura concluída! ${data.enrichedCount} leads enriquecidos com Instagram e novos canais.`);
      loadLeads();
    } else {
      showToast('Erro na varredura: ' + (data.error || 'Tente novamente'));
    }
  } catch (err) {
    showToast('Erro de comunicação na varredura: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

function scanSelectedLeads() {
  if (selectedLeadIds.size === 0) {
    showToast('Selecione ao menos um lead para escanear.');
    return;
  }
  startInstagramQuickScan(Array.from(selectedLeadIds));
}

// SETTINGS & SUPABASE MODAL
async function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  try {
    const res = await fetch('/api/supabase/config');
    const data = await res.json();
    const badge = document.getElementById('supabase-status-badge');
    const urlInput = document.getElementById('supabase-url-input');

    if (data.connected) {
      if (badge) {
        badge.className = 'supabase-status-pill connected';
        badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Conectado';
      }
      if (urlInput && data.url) urlInput.value = data.url;
    } else {
      if (badge) {
        badge.className = 'supabase-status-pill';
        badge.innerText = 'Não configurado';
      }
    }
  } catch (e) {
    console.error('Erro ao verificar Supabase:', e);
  }
}

function closeSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.add('hidden');
}

async function saveSupabaseConfig() {
  const url = document.getElementById('supabase-url-input').value.trim();
  const key = document.getElementById('supabase-key-input').value.trim();

  if (!url || !key) {
    showToast('Preencha a URL e a Anon Key do Supabase.');
    return;
  }

  try {
    const res = await fetch('/api/supabase/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, key })
    });
    if (res.ok) {
      showToast('✅ Conexão Supabase salva com sucesso!');
      openSettingsModal();
    } else {
      showToast('Erro ao salvar configuração.');
    }
  } catch (e) {
    showToast('Erro: ' + e.message);
  }
}

async function syncLeadsToSupabase() {
  const btn = document.getElementById('btn-sync-supabase');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando...`;
  }

  try {
    showToast('☁️ Enviando base de leads para o Supabase...');
    const res = await fetch('/api/supabase/sync', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`🎉 Sucesso! ${data.count} leads sincronizados com o Supabase.`);
    } else {
      showToast('Falha na sincronização: ' + (data.error || 'Verifique as permissões da tabela'));
    }
  } catch (e) {
    showToast('Erro de sincronização: ' + e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Sincronizar Leads para Supabase`;
    }
  }
}

async function pullLeadsFromSupabase() {
  const btn = document.getElementById('btn-pull-supabase');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Baixando...`;
  }

  try {
    showToast('☁️ Buscando leads do Supabase...');
    const res = await fetch('/api/supabase/pull', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`🎉 Sucesso! ${data.count} leads carregados do Supabase.`);
      await fetchLeads();
    } else {
      showToast('Falha ao baixar: ' + (data.error || 'Verifique as configurações'));
    }
  } catch (e) {
    showToast('Erro ao baixar: ' + e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i> Baixar do Supabase`;
    }
  }
}

// ==========================================
// SESSIONS & CAMPAIGNS (SALVAR / EXPORTAR SEÇÕES)
// ==========================================
let activeSessionMeta = { id: null, name: 'Academias - Taubaté SP' };
let allSavedSessions = [];

async function fetchActiveSessionInfo() {
  try {
    const res = await fetch('/api/sessions');
    if (res.ok) {
      const data = await res.json();
      allSavedSessions = data.sessions || [];
      if (data.activeSession && data.activeSession.name) {
        activeSessionMeta = data.activeSession;
        updateActiveSessionHeaderUI();
      }
    }
  } catch (e) {
    console.warn('Erro ao carregar info de sessão:', e);
  }
}

function updateActiveSessionHeaderUI() {
  const label = document.getElementById('header-active-session-name');
  if (label) {
    label.innerText = activeSessionMeta.name || 'Geral';
  }
}

function openSessionsModal() {
  const modal = document.getElementById('sessions-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const countEl = document.getElementById('session-current-leads-count');
  if (countEl) countEl.innerText = allLeads.length;

  const input = document.getElementById('new-session-name-input');
  if (input) {
    if (allLeads.length > 0) {
      const firstNiche = allLeads[0].niche || 'Prospecção';
      const firstCity = allLeads[0].city ? allLeads[0].city.split(',')[0].trim() : 'Local';
      input.value = `${firstNiche} - ${firstCity} (${allLeads.length} leads)`;
    } else {
      input.value = 'Nova Campanha';
    }
  }

  loadSessionsList();
}

function closeSessionsModal() {
  const modal = document.getElementById('sessions-modal');
  if (modal) modal.classList.add('hidden');
}

function openSaveSessionPrompt() {
  openSessionsModal();
  const input = document.getElementById('new-session-name-input');
  if (input) {
    input.focus();
    input.select();
  }
}

async function loadSessionsList() {
  const container = document.getElementById('sessions-list-container');
  if (!container) return;

  container.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Carregando sessões salvas...</div>`;

  try {
    const res = await fetch('/api/sessions');
    const data = await res.json();
    allSavedSessions = data.sessions || [];
    if (data.activeSession) activeSessionMeta = data.activeSession;
    updateActiveSessionHeaderUI();

    if (allSavedSessions.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:30px 15px; color:#64748b; background:#0c1017; border-radius:8px;">
          <i class="fa-regular fa-folder-open" style="font-size:2rem; margin-bottom:8px; opacity:0.4;"></i>
          <p>Nenhuma sessão salva ainda.</p>
          <span style="font-size:0.75rem;">Digite um nome acima e clique em "Salvar Sessão" para guardar os leads atuais.</span>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    allSavedSessions.forEach(sess => {
      const isCurrentActive = activeSessionMeta && activeSessionMeta.id === sess.id;
      const card = document.createElement('div');
      card.className = `session-item-card ${isCurrentActive ? 'active-session' : ''}`;

      const dateStr = sess.updatedAt ? new Date(sess.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Recente';

      card.innerHTML = `
        <div class="session-info-left">
          <div class="session-title-line">
            <span class="session-item-name">${sess.name}</span>
            ${isCurrentActive ? '<span class="session-active-pill"><i class="fa-solid fa-check"></i> Ativa</span>' : ''}
          </div>
          <div class="session-meta-line">
            <span><i class="fa-solid fa-tag text-blue"></i> ${sess.niche || 'Geral'}</span>
            <span><i class="fa-solid fa-location-dot text-yellow"></i> ${sess.city || 'Taubaté - SP'}</span>
            <span><i class="fa-solid fa-users text-green"></i> <strong>${sess.leadCount}</strong> leads</span>
            <span><i class="fa-regular fa-clock"></i> ${dateStr}</span>
          </div>
        </div>
        <div class="session-actions-right">
          ${!isCurrentActive ? `
            <button class="btn-session-load" onclick="loadSessionById('${sess.id}')" title="Carregar esta sessão no CRM">
              <i class="fa-solid fa-play"></i> Carregar
            </button>
          ` : `
            <button class="btn-session-action" onclick="saveCurrentAsSession('${sess.id}', '${sess.name.replace(/'/g, "\\'")}')" title="Atualizar dados desta sessão ativa">
              <i class="fa-solid fa-rotate text-blue"></i> Atualizar
            </button>
          `}
          <button class="btn-session-action" onclick="exportSessionById('${sess.id}', 'csv')" title="Baixar planilha CSV desta sessão">
            <i class="fa-solid fa-file-csv"></i> CSV
          </button>
          <button class="btn-session-action" onclick="exportSessionById('${sess.id}', 'json')" title="Baixar arquivo JSON desta sessão">
            <i class="fa-solid fa-file-code"></i> JSON
          </button>
          <button class="btn-session-action delete-btn" onclick="deleteSessionById('${sess.id}', '${sess.name.replace(/'/g, "\\'")}')" title="Excluir sessão">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:15px;">Erro ao carregar sessões: ${err.message}</div>`;
  }
}

async function saveCurrentAsSession(existingId = null, existingName = null) {
  const input = document.getElementById('new-session-name-input');
  const name = existingName || (input ? input.value.trim() : '');

  if (!name) {
    showToast('Informe um nome para a sessão (ex: Academias Taubaté).');
    return;
  }

  const niche = allLeads[0] ? allLeads[0].niche : 'Geral';
  const city = allLeads[0] ? allLeads[0].city : 'Taubaté - SP';

  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: existingId,
        name,
        niche,
        city
      })
    });

    const data = await res.json();
    if (data.success) {
      activeSessionMeta = data.session;
      updateActiveSessionHeaderUI();
      showToast(`💾 Sessão "${data.session.name}" salva com sucesso! (${allLeads.length} leads)`);
      loadSessionsList();
    } else {
      showToast('Erro ao salvar sessão: ' + (data.error || 'Erro desconhecido'));
    }
  } catch (e) {
    showToast('Erro de conexão ao salvar sessão: ' + e.message);
  }
}

async function loadSessionById(id) {
  try {
    showToast('Carregando sessão selecionada...');
    const res = await fetch(`/api/sessions/${id}/load`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      activeSessionMeta = data.session;
      updateActiveSessionHeaderUI();
      allLeads = data.leads || [];
      selectedLeadIds.clear();
      applyFiltersAndRender();
      updateSmartCounters();
      closeSessionsModal();
      showToast(`🚀 Sessão "${data.session.name}" carregada! (${data.leadCount} leads)`);
    } else {
      showToast('Erro ao carregar sessão: ' + (data.error || 'Erro desconhecido'));
    }
  } catch (e) {
    showToast('Erro ao carregar sessão: ' + e.message);
  }
}

async function deleteSessionById(id, name) {
  if (!confirm(`Tem certeza que deseja excluir a sessão "${name}"? Os leads dela serão removidos do histórico de sessões.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast(`🗑️ Sessão "${name}" excluída.`);
      loadSessionsList();
    } else {
      showToast('Erro ao excluir sessão.');
    }
  } catch (e) {
    showToast('Erro ao excluir sessão: ' + e.message);
  }
}

function exportSessionById(id, format) {
  window.location.href = `/api/sessions/${id}/export-${format}`;
}

function exportCurrentSessionFile(format) {
  if (activeSessionMeta && activeSessionMeta.id) {
    window.location.href = `/api/sessions/${activeSessionMeta.id}/export-${format}`;
  } else {
    window.location.href = `/api/export-${format}`;
  }
}

async function confirmDeleteCurrentTable() {
  const leadCount = allLeads.length;
  if (leadCount === 0) {
    showToast('A tabela de leads já está vazia.');
    return;
  }

  const sessName = activeSessionMeta && activeSessionMeta.name ? activeSessionMeta.name : 'atual';
  const confirmed = confirm(`⚠️ Tem certeza que deseja excluir esta tabela com ${leadCount} leads ("${sessName}")?\n\nTodos os leads serão limpos da tela e um backup de segurança será salvo automaticamente.`);
  if (!confirmed) return;

  try {
    const res = await fetch('/api/leads/clear-table', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteSession: false })
    });
    const data = await res.json();
    if (data.success) {
      allLeads = [];
      selectedLeadIds.clear();
      localStorage.removeItem('mapscrapter_leads_cache');
      localStorage.setItem('mapscrapter_user_cleared', 'true');
      activeSessionMeta = { id: null, name: 'Tabela Vazia' };
      updateActiveSessionHeaderUI();
      applyLeadsFilters();
      updateTabCounts();
      showToast('🗑️ Tabela de leads excluída com sucesso! Backup salvo.');
    } else {
      showToast('Erro ao excluir tabela: ' + (data.error || 'Erro desconhecido'));
    }
  } catch (e) {
    showToast('Erro de conexão: ' + e.message);
  }
}

function openSupportWhatsApp() {
  window.open('https://wa.me/5511999999999?text=Ol%C3%A1%2C%20preciso%20de%20suporte%20no%20Kaptar', '_blank');
}

// TOAST HELPER
let toastTimeout = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toast-text');
  toastText.innerText = message;
  toast.classList.remove('hidden');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

// ==========================================
// CONTACT, EXPORT & RETORNAR CONTATO HELPERS
// ==========================================

function copyContactNumber(num) {
  if (!num) return;
  navigator.clipboard.writeText(num).then(() => {
    showToast(`📋 Número ${num} copiado para a área de transferência!`);
  }).catch(() => {
    showToast(`Número: ${num}`);
  });
}

async function toggleRetornarContato(id) {
  const lead = allLeads.find(l => l.id === id);
  if (!lead) return;
  const newStatus = lead.status === 'Retornar Contato' ? 'Novo' : 'Retornar Contato';
  await updateLeadStatus(id, newStatus);
  showToast(newStatus === 'Retornar Contato' ? '⏰ Lead agendado para Retornar Contato!' : '🔵 Lead retornado para Novo');
}

async function searchContactForLead(id) {
  const lead = allLeads.find(l => l.id === id);
  if (!lead) return;
  const query = encodeURIComponent(`${lead.name} ${lead.city || 'Taubaté'} telefone whatsapp`);
  const googleSearchUrl = `https://www.google.com/search?q=${query}`;
  showToast(`🔍 Abrindo pesquisa no Google para conferir o telefone oficial de "${lead.name}"...`);
  window.open(googleSearchUrl, '_blank');
}

function exportLeadsCSV() {
  window.location.href = '/api/export-csv';
  showToast('📥 Baixando arquivo CSV completo de leads (com links Google e Maps)...');
}

function exportLeadsJSON() {
  window.location.href = '/api/export-json';
  showToast('📥 Baixando arquivo JSON de backup da sessão...');
}

function exportLeadsTSV() {
  window.location.href = '/api/export-tsv';
  showToast('📥 Baixando arquivo TSV para Google Planilhas...');
}

// Copiar Tabela de Leads para colar no Google Sheets via Ctrl+V
async function copyTableForGoogleSheets() {
  if (!allLeads || allLeads.length === 0) {
    showToast('Nenhum lead disponível para copiar.');
    return;
  }

  const headers = [
    'Empresa', 'Nicho', 'Telefone', 'WhatsApp Raw', 'É Zap', 'Link WhatsApp',
    'Melhor Canal', 'Nota Google', 'Avaliações', 'Site', 'Instagram',
    'Tipo', 'Status', 'Score', 'Endereço', 'Cidade', 'Busca Google', 'Google Maps'
  ];

  let tsv = headers.join('\t') + '\n';
  allLeads.forEach(l => {
    const isZap = (l.isMobile || l.isWhatsapp) ? 'Sim' : 'Não';
    const waLink = l.whatsappLink || (l.rawPhone ? `https://wa.me/${l.rawPhone.startsWith('55') ? l.rawPhone : '55' + l.rawPhone}` : '');
    const googleSearch = `https://www.google.com/search?q=${encodeURIComponent((l.name || '') + ' ' + (l.city || 'Taubaté'))}`;
    const maps = l.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((l.name || '') + ' ' + (l.address || l.city || 'Taubaté'))}`;

    const row = [
      l.name || '',
      l.niche || '',
      l.phone || l.number || '',
      l.rawPhone || '',
      isZap,
      waLink,
      l.bestContactChannel || '',
      l.rating || '',
      l.reviewCount || 0,
      l.website || '',
      l.instagram || '',
      l.type || '',
      l.status || '',
      l.score || '',
      l.address || '',
      l.city || '',
      googleSearch,
      maps
    ].map(v => ('' + v).replace(/\t/g, ' ').replace(/\r?\n/g, ' '));

    tsv += row.join('\t') + '\n';
  });

  try {
    await navigator.clipboard.writeText(tsv);
    showToast(`📋 ${allLeads.length} leads copiados! Abra o Google Planilhas e aperte Ctrl+V.`);
  } catch (err) {
    showToast('Erro ao copiar dados para a área de transferência: ' + err.message);
  }
}

// Modal para Webhook / Sincronização Externa (Google Sheets Apps Script / Zapier / Make / Form)
function openSyncWebhookModal() {
  const modal = document.getElementById('webhook-export-modal');
  if (modal) {
    modal.classList.remove('hidden');
    const input = document.getElementById('webhook-url-input');
    const saved = localStorage.getItem('mapscrapter_webhook_url');
    if (input && saved) input.value = saved;
    const countEl = document.getElementById('webhook-leads-count');
    if (countEl) countEl.innerText = allLeads.length;
  }
}

function closeSyncWebhookModal() {
  const modal = document.getElementById('webhook-export-modal');
  if (modal) modal.classList.add('hidden');
}

async function sendLeadsToWebhook() {
  const input = document.getElementById('webhook-url-input');
  const url = input ? input.value.trim() : '';

  if (!url || !url.startsWith('http')) {
    showToast('Informe uma URL de Webhook válida (ex: Google Apps Script ou Make/Zapier).');
    return;
  }

  localStorage.setItem('mapscrapter_webhook_url', url);

  const btn = document.getElementById('btn-send-webhook');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Enviando...`;
  }

  showToast('🚀 Enviando leads para o Google Sheets / Webhook...');

  try {
    const res = await fetch('/api/export/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl: url })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Dados exportados com sucesso!');
      closeSyncWebhookModal();
    } else {
      showToast('Erro: ' + (data.error || 'Falha no envio'));
    }
  } catch (e) {
    showToast('Erro de conexão ao enviar: ' + e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Enviar Dados Agora`;
    }
  }
}
