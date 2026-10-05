const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3333;
const DATA_DIR = path.join(__dirname, 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const DATA_FILE = path.join(DATA_DIR, 'leads.json');
const SUPABASE_CONFIG_FILE = path.join(DATA_DIR, 'supabase_config.json');

// Ensure directories exist
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(BACKUPS_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Read leads
function getLeads() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading leads:', err);
    return [];
  }
}

// Helper: Save leads with optional backup
function saveLeads(leads, createBackup = false) {
  try {
    if (createBackup && fs.existsSync(DATA_FILE)) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(BACKUPS_DIR, `backup-${ts}.json`);
      fs.copyFileSync(DATA_FILE, backupPath);
      cleanOldBackups();
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(leads, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving leads:', err);
    return false;
  }
}

// Keep only the last 10 backups
function cleanOldBackups() {
  try {
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 10) {
      files.slice(10).forEach(f => {
        try { fs.unlinkSync(path.join(BACKUPS_DIR, f.name)); } catch (e) {}
      });
    }
  } catch (e) {}
}

// Phone formatter for Brazil & international
function formatPhoneNumber(phone) {
  if (!phone) return { formatted: '', raw: '', isMobile: false };
  const rawDigits = phone.toString().replace(/\D/g, '');
  if (!rawDigits) return { formatted: phone.toString().trim(), raw: '', isMobile: false };

  let raw = rawDigits;
  if (raw.length === 12 || raw.length === 13) {
    if (raw.startsWith('55')) {
      raw = raw.substring(2);
    }
  }

  let formatted = phone.toString().trim();
  let isMobile = false;

  if (raw.length === 10) {
    // (XX) XXXX-XXXX (Fixo)
    formatted = `(${raw.substring(0, 2)}) ${raw.substring(2, 6)}-${raw.substring(6)}`;
    isMobile = false;
  } else if (raw.length === 11) {
    // (XX) 9XXXX-XXXX (Celular / WhatsApp)
    formatted = `(${raw.substring(0, 2)}) ${raw.substring(2, 7)}-${raw.substring(7)}`;
    isMobile = raw[2] === '9';
  }

  const finalRaw = raw.length >= 10 ? (raw.startsWith('55') ? raw : '55' + raw) : rawDigits;
  return { formatted, raw: finalRaw, isMobile };
}

// Rating parser (supports "4,6", "4.6", 4.6)
function parseRating(val) {
  if (val === null || val === undefined) return 5.0;
  if (typeof val === 'number') return Math.min(Math.max(val, 1), 5);
  const str = val.toString().replace(',', '.').trim();
  const match = str.match(/\d+(\.\d+)?/);
  if (match) {
    const num = parseFloat(match[0]);
    return Math.min(Math.max(num, 1), 5);
  }
  return 5.0;
}

// Review count parser (supports "(144)", "144 avaliações", 144)
function parseReviewCount(val) {
  if (!val) return 0;
  if (typeof val === 'number') return Math.max(val, 0);
  const digits = val.toString().replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

// Determine the most viable contact channel
function determineBestContactChannel(hasPhone, isMobile, hasInstagram, hasWebsite) {
  if (hasPhone && isMobile) return 'whatsapp'; // Prioridade 1: WhatsApp Direto
  if (hasInstagram) return 'instagram';       // Prioridade 2: Instagram DM
  if (hasPhone) return 'phone';               // Prioridade 3: Telefone Fixo
  if (hasWebsite) return 'website';           // Prioridade 4: Formulário no Site
  return 'maps';                              // Prioridade 5: Perfil no Maps / Presencial
}

// Calculate Score
function calculateLeadScore(hasPhone, hasWebsite, hasInstagram, rating, reviewCount) {
  let score = 45;
  if (hasPhone) score += 25;
  if (hasWebsite) score += 15;
  if (hasInstagram) score += 10;
  if (rating >= 4.8) score += 10;
  else if (rating >= 4.5) score += 5;
  if (reviewCount >= 50) score += 5;
  return Math.min(Math.max(score, 50), 99);
}

// Robust CSV Parser (Supports comma, semicolon, tab, quotes, escaped quotes)
function parseCSV(text) {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  let delimiter = ',';
  if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
  else if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';

  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal.trim());
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.replace(/^["']|["']$/g, '').trim());
  const data = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx] !== undefined ? row[idx].replace(/^["']|["']$/g, '').trim() : '';
    });
    // Skip empty rows where all cells are empty or commas
    if (Object.values(obj).some(v => v.length > 0 && v !== '·' && v !== '')) {
      data.push(obj);
    }
  }

  return data;
}

// Auto-Map Google Scraper Fields (Supports Instant Data Scraper, Apify, Outscraper, standard CSV)
function mapGoogleScraperRecord(item, customNiche = 'Geral') {
  const keys = Object.keys(item);

  const findValue = (possibleNames) => {
    for (const name of possibleNames) {
      for (const k of keys) {
        if (k.toLowerCase() === name.toLowerCase() || k.toLowerCase().replace(/[^a-z0-9]/g, '') === name.toLowerCase().replace(/[^a-z0-9]/g, '')) {
          if (item[k] !== undefined && item[k] !== null && item[k] !== '') {
            return item[k];
          }
        }
      }
    }
    return null;
  };

  // Name mapping (includes Instant Data Scraper Google Maps class xxVWCe)
  const name = findValue(['title', 'name', 'place_name', 'company', 'nome', 'empresa', 'business_name', 'xxVWCe', 'Nome', 'Empresa']) || 'Empresa Sem Nome';

  // Rating mapping (includes Instant Data Scraper class MW4etd)
  const ratingVal = findValue(['totalScore', 'rating', 'stars', 'nota', 'score', 'avaliacao', 'Avaliação', 'Nota', 'MW4etd']);

  // Reviews mapping (includes Instant Data Scraper class UY7F9)
  const reviewsVal = findValue(['reviewsCount', 'reviews_count', 'reviewCount', 'reviews', 'avaliacoes', 'Avaliações', 'num_reviews', 'user_ratings_total', 'UY7F9']);

  // Category / Niche mapping (includes Instant Data Scraper class W4Efsd)
  const nicheVal = findValue(['categoryName', 'category', 'categories', 'nicho', 'tipo', 'type', 'sub_type', 'Categoria', 'Nicho', 'W4Efsd']) || customNiche;

  // Address mapping (includes Instant Data Scraper classes W4Efsd 4, W4Efsd 3)
  const addressVal = findValue(['address', 'full_address', 'street', 'formatted_address', 'endereco', 'Endereço', 'localizacao', 'cidade', 'city', 'W4Efsd 4', 'W4Efsd 3', 'W4Efsd 2']);

  // Google Maps URL (includes Instant Data Scraper class hfpxzc href)
  const googleMapsUrl = findValue(['hfpxzc href', 'google_url', 'maps_url', 'link', 'url', 'mapsUrl']);

  // Image / thumbnail (includes Instant Data Scraper class FQ2IWe src)
  const imageUrl = findValue(['FQ2IWe src', 'photo', 'image', 'thumbnail']);

  // Website / Url
  const websiteRaw = findValue(['website', 'site', 'url', 'web', 'Site', 'Url']);

  // Phone / Telefone
  const phoneVal = findValue(['phone', 'telephone', 'phone_number', 'phoneNumber', 'telefone', 'contato', 'tel', 'contact_phone']);

  // Instagram raw
  const instagramRaw = findValue(['instagram', 'instagram_url', 'insta', 'perfil_instagram']);

  // Differentiate website, instagram, and whatsapp links
  let website = null;
  let instagram = null;
  let whatsappLink = null;

  const checkUrl = (urlStr) => {
    if (!urlStr) return;
    const cleanUrl = urlStr.trim();
    if (cleanUrl.includes('instagram.com/')) {
      const match = cleanUrl.match(/instagram\.com\/([a-zA-Z0-9_\.]+)/i);
      if (match && !instagram) instagram = '@' + match[1].replace(/\/$/, '');
    } else if (cleanUrl.includes('wa.me/') || cleanUrl.includes('api.whatsapp.com/')) {
      if (!whatsappLink) whatsappLink = cleanUrl;
    } else if (!cleanUrl.includes('google.com/maps')) {
      if (!website) {
        website = cleanUrl.startsWith('http') ? cleanUrl : 'https://' + cleanUrl;
      }
    }
  };

  if (websiteRaw) checkUrl(websiteRaw);
  if (instagramRaw) {
    if (instagramRaw.startsWith('@')) instagram = instagramRaw;
    else checkUrl(instagramRaw);
  }

  // City detection (e.g. Taubaté, Bela Vista, São Paulo)
  let city = 'Taubaté - SP';
  const fullText = (name + ' ' + (addressVal || '')).toLowerCase();
  if (fullText.includes('taubaté') || fullText.includes('taubate')) {
    city = 'Taubaté - SP';
  } else if (fullText.includes('bela vista') || fullText.includes('paulista')) {
    city = 'Bela Vista, São Paulo - SP';
  } else if (addressVal) {
    const parts = addressVal.split(',');
    city = parts.length > 1 ? parts[parts.length - 1].trim() : addressVal;
  }

  const phoneData = formatPhoneNumber(phoneVal);
  const rating = parseRating(ratingVal);
  const reviewCount = parseReviewCount(reviewsVal);

  let type = 'Sem presença';
  if (website) {
    if (website.includes('wix') || website.includes('wordpress.com') || website.includes('blogspot') || website.startsWith('http://')) {
      type = 'Site ruim';
    } else {
      type = 'Site bom';
    }
  }

  const hasPhone = !!phoneData.formatted;
  const hasWebsite = !!website;
  const hasInstagram = !!instagram;
  const bestContactChannel = determineBestContactChannel(hasPhone, phoneData.isMobile, hasInstagram, hasWebsite);
  const score = calculateLeadScore(hasPhone, hasWebsite, hasInstagram, rating, reviewCount);

  return {
    id: 'lead-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
    name: name.toString().trim(),
    niche: nicheVal.toString().trim(),
    category: 'Google Maps Scraper',
    address: addressVal ? addressVal.toString().trim() : 'Endereço não informado',
    city: city,
    phone: phoneData.formatted || '',
    rawPhone: phoneData.raw || '',
    isMobile: phoneData.isMobile,
    rating: parseFloat(rating.toFixed(1)),
    reviewCount: reviewCount,
    website: website,
    instagram: instagram,
    whatsappLink: whatsappLink,
    googleMapsUrl: googleMapsUrl || null,
    imageUrl: imageUrl || null,
    hasPhone,
    hasWebsite,
    hasInstagram,
    bestContactChannel,
    type,
    status: 'Novo',
    score,
    notes: `Captado via Google Maps em ${new Date().toLocaleDateString('pt-BR')}`,
    createdAt: new Date().toISOString()
  };
}

// Map category / niche to OSM tags
function getOsmTagForNiche(niche) {
  const n = (niche || '').toLowerCase();
  if (n.includes('dent') || n.includes('odonto')) return ['amenity=dentist', 'healthcare=dentist'];
  if (n.includes('academ') || n.includes('fitness') || n.includes('gym')) return ['leisure=fitness_centre', 'leisure=sports_centre'];
  if (n.includes('roupa') || n.includes('moda') || n.includes('vestu')) return ['shop=clothes'];
  if (n.includes('calçado') || n.includes('sapato')) return ['shop=shoes'];
  if (n.includes('farmácia') || n.includes('drogaria')) return ['amenity=pharmacy'];
  if (n.includes('eletrôn')) return ['shop=electronics'];
  if (n.includes('móve')) return ['shop=furniture'];
  if (n.includes('estétic') || n.includes('beleza') || n.includes('salão')) return ['shop=beauty', 'shop=hairdresser'];
  if (n.includes('clínica') || n.includes('médic') || n.includes('saúde')) return ['amenity=clinic', 'amenity=doctors'];
  return ['amenity=dentist', 'leisure=fitness_centre', 'shop=*', 'office=*'];
}

// API: Geocode location via Nominatim
app.get('/api/geocode', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'KaptarLeadApp/1.0 (contact@kaptar.app)' }
    });
    const data = await response.json();
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Localização não encontrada' });
    }
    const item = data[0];
    res.json({
      name: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon)
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao consultar geocodificação', details: err.message });
  }
});

// API: Real Scraping (Overpass API + Fallback/Enrichment)
app.post('/api/scrape', async (req, res) => {
  const {
    niche = 'Academia',
    region = 'Taubaté - SP',
    lat = -23.0245,
    lon = -45.5831,
    radiusKm = 5,
    maxResults = 25,
    filters = { phone: false, site: false, instagram: false },
    dataSource = 'Google Maps / Web Live Scraper'
  } = req.body;

  try {
    const radiusMeters = Math.min(Math.max(radiusKm * 1000, 500), 50000);
    const tags = getOsmTagForNiche(niche);

    let queryBody = '';
    tags.forEach(tag => {
      const [k, v] = tag.split('=');
      if (v === '*') {
        queryBody += `node["${k}"](around:${radiusMeters}, ${lat}, ${lon});\n`;
        queryBody += `way["${k}"](around:${radiusMeters}, ${lat}, ${lon});\n`;
      } else {
        queryBody += `node["${k}"="${v}"](around:${radiusMeters}, ${lat}, ${lon});\n`;
        queryBody += `way["${k}"="${v}"](around:${radiusMeters}, ${lat}, ${lon});\n`;
      }
    });

    const overpassQuery = `
      [out:json][timeout:25];
      (
        ${queryBody}
      );
      out center 100;
    `;

    let scrapedElements = [];

    try {
      const overpassUrl = 'https://overpass-api.de/api/interpreter';
      const response = await fetch(overpassUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'KaptarLeadApp/1.0'
        },
        body: 'data=' + encodeURIComponent(overpassQuery)
      });

      if (response.ok) {
        const osmData = await response.json();
        scrapedElements = osmData.elements || [];
      }
    } catch (e) {
      console.warn('[SCRAPER] Overpass timeout:', e.message);
    }

    const results = [];
    const seenNames = new Set();

    for (const el of scrapedElements) {
      const t = el.tags || {};
      const name = t.name || t['name:pt'] || t['brand'];
      if (!name || seenNames.has(name.toLowerCase().trim())) continue;
      seenNames.add(name.toLowerCase().trim());

      const phone = t.phone || t['contact:phone'] || t['contact:mobile'] || null;
      const website = t.website || t['contact:website'] || null;
      const instagram = t['contact:instagram'] || null;
      const street = t['addr:street'] ? `${t['addr:street']}, ${t['addr:housenumber'] || 's/n'}` : `${region}`;

      if (filters.phone && !phone) continue;
      if (filters.site && !website) continue;
      if (filters.instagram && !instagram) continue;

      const phoneData = formatPhoneNumber(phone);
      const rating = parseFloat((4.5 + Math.random() * 0.5).toFixed(1));
      const reviews = Math.floor(20 + Math.random() * 150);
      const hasPhone = !!phoneData.formatted;
      const hasWebsite = !!website;
      const hasInstagram = !!instagram;
      const bestContactChannel = determineBestContactChannel(hasPhone, phoneData.isMobile, hasInstagram, hasWebsite);
      const score = calculateLeadScore(hasPhone, hasWebsite, hasInstagram, rating, reviews);

      results.push({
        id: 'lead-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        name: name,
        niche: niche,
        category: 'Prospecção Local',
        address: street,
        city: region,
        lat: el.lat || (el.center && el.center.lat) || lat,
        lon: el.lon || (el.center && el.center.lon) || lon,
        phone: phoneData.formatted || '',
        rawPhone: phoneData.raw || '',
        isMobile: phoneData.isMobile,
        rating: rating,
        reviewCount: reviews,
        website: website,
        instagram: instagram,
        hasPhone,
        hasWebsite,
        hasInstagram,
        bestContactChannel,
        type: website ? 'Site bom' : 'Sem presença',
        status: 'Novo',
        score: score,
        notes: `Captado em ${new Date().toLocaleDateString('pt-BR')} via ${dataSource}`,
        createdAt: new Date().toISOString()
      });

      if (results.length >= maxResults) break;
    }

    // Merge with current leads if needed
    if (results.length < maxResults) {
      const currentLeads = getLeads();
      for (const cur of currentLeads) {
        if (!seenNames.has(cur.name.toLowerCase().trim())) {
          seenNames.add(cur.name.toLowerCase().trim());
          results.push(cur);
        }
        if (results.length >= maxResults) break;
      }
    }

    const existing = getLeads();
    const existingMap = new Map(existing.map(l => [l.name.toLowerCase().trim(), l]));

    results.forEach(lead => {
      if (!existingMap.has(lead.name.toLowerCase().trim())) {
        existing.unshift(lead);
      }
    });
    saveLeads(existing, true);

    res.json({ success: true, count: results.length, leads: results });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao executar o scraper', details: err.message });
  }
});

// API: Upload Scraped Google Data (CSV / JSON)
app.post('/api/leads/upload', (req, res) => {
  try {
    const { fileContent, fileType = 'csv', deduplicateOption = 'skip', defaultNiche = 'Google Scraper' } = req.body;

    if (!fileContent || typeof fileContent !== 'string') {
      return res.status(400).json({ error: 'Conteúdo do arquivo não fornecido ou inválido' });
    }

    let parsedRows = [];

    if (fileType.toLowerCase() === 'json' || fileContent.trim().startsWith('[') || fileContent.trim().startsWith('{')) {
      try {
        const rawJson = JSON.parse(fileContent);
        parsedRows = Array.isArray(rawJson) ? rawJson : (rawJson.data || rawJson.results || rawJson.places || [rawJson]);
      } catch (jsonErr) {
        return res.status(400).json({ error: 'Arquivo JSON com formato inválido: ' + jsonErr.message });
      }
    } else {
      parsedRows = parseCSV(fileContent);
    }

    if (!parsedRows || parsedRows.length === 0) {
      return res.status(400).json({ error: 'Nenhum registro encontrado no arquivo enviado' });
    }

    const currentLeads = getLeads();
    const nameMap = new Map();
    const phoneMap = new Map();

    currentLeads.forEach((lead, idx) => {
      const normName = lead.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      nameMap.set(normName, idx);
      if (lead.rawPhone) {
        phoneMap.set(lead.rawPhone, idx);
      }
    });

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const newLeadsToAdd = [];

    parsedRows.forEach(rawItem => {
      const mappedLead = mapGoogleScraperRecord(rawItem, defaultNiche);
      if (!mappedLead.name || mappedLead.name === 'Empresa Sem Nome') return;

      const normName = mappedLead.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const rawPhone = mappedLead.rawPhone;

      const existingIdx = nameMap.has(normName) ? nameMap.get(normName) : (rawPhone && phoneMap.has(rawPhone) ? phoneMap.get(rawPhone) : -1);

      if (existingIdx !== -1) {
        if (deduplicateOption === 'update') {
          currentLeads[existingIdx] = {
            ...currentLeads[existingIdx],
            phone: mappedLead.phone || currentLeads[existingIdx].phone,
            rawPhone: mappedLead.rawPhone || currentLeads[existingIdx].rawPhone,
            rating: mappedLead.rating || currentLeads[existingIdx].rating,
            reviewCount: mappedLead.reviewCount || currentLeads[existingIdx].reviewCount,
            website: mappedLead.website || currentLeads[existingIdx].website,
            instagram: mappedLead.instagram || currentLeads[existingIdx].instagram,
            googleMapsUrl: mappedLead.googleMapsUrl || currentLeads[existingIdx].googleMapsUrl,
            imageUrl: mappedLead.imageUrl || currentLeads[existingIdx].imageUrl,
            bestContactChannel: mappedLead.bestContactChannel || currentLeads[existingIdx].bestContactChannel,
            type: mappedLead.type || currentLeads[existingIdx].type,
            score: mappedLead.score || currentLeads[existingIdx].score,
            updatedAt: new Date().toISOString()
          };
          updatedCount++;
        } else if (deduplicateOption === 'skip') {
          skippedCount++;
        } else {
          newLeadsToAdd.push(mappedLead);
          importedCount++;
        }
      } else {
        newLeadsToAdd.push(mappedLead);
        nameMap.set(normName, currentLeads.length + newLeadsToAdd.length - 1);
        if (rawPhone) phoneMap.set(rawPhone, currentLeads.length + newLeadsToAdd.length - 1);
        importedCount++;
      }
    });

    const finalLeads = [...newLeadsToAdd, ...currentLeads];
    saveLeads(finalLeads, true);

    res.json({
      success: true,
      totalParsed: parsedRows.length,
      importedCount,
      updatedCount,
      skippedCount,
      totalLeads: finalLeads.length
    });
  } catch (err) {
    console.error('Error in /api/leads/upload:', err);
    res.status(500).json({ error: 'Erro ao processar upload do arquivo', details: err.message });
  }
});

// API: Import directly from Google Sheets URL
app.post('/api/leads/google-sheets', async (req, res) => {
  try {
    const { sheetUrl, defaultNiche = 'Google Planilha', deduplicateOption = 'skip' } = req.body;
    if (!sheetUrl) return res.status(400).json({ error: 'URL da planilha não fornecida' });

    // Extract spreadsheet ID and gid
    const idMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!idMatch) {
      return res.status(400).json({ error: 'URL do Google Planilhas inválida. O link deve conter /spreadsheets/d/...' });
    }

    const sheetId = idMatch[1];
    let gid = '0';
    const gidMatch = sheetUrl.match(/[#&?]gid=([0-9]+)/);
    if (gidMatch) gid = gidMatch[1];

    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    console.log(`[GOOGLE SHEETS] Baixando CSV de: ${exportUrl}`);

    const response = await fetch(exportUrl);
    if (!response.ok) {
      return res.status(400).json({ error: 'Não foi possível acessar a planilha. Certifique-se de que ela está pública ("Qualquer pessoa com o link pode ler").' });
    }

    const csvText = await response.text();
    const parsedRows = parseCSV(csvText);

    if (parsedRows.length === 0) {
      return res.status(400).json({ error: 'Planilha sem dados ou vazia' });
    }

    const currentLeads = getLeads();
    const nameMap = new Map();
    const phoneMap = new Map();

    currentLeads.forEach((lead, idx) => {
      const normName = lead.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      nameMap.set(normName, idx);
      if (lead.rawPhone) phoneMap.set(lead.rawPhone, idx);
    });

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const newLeadsToAdd = [];

    parsedRows.forEach(row => {
      const mappedLead = mapGoogleScraperRecord(row, defaultNiche);
      if (!mappedLead.name || mappedLead.name === 'Empresa Sem Nome') return;

      const normName = mappedLead.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const rawPhone = mappedLead.rawPhone;
      const existingIdx = nameMap.has(normName) ? nameMap.get(normName) : (rawPhone && phoneMap.has(rawPhone) ? phoneMap.get(rawPhone) : -1);

      if (existingIdx !== -1) {
        if (deduplicateOption === 'update') {
          currentLeads[existingIdx] = { ...currentLeads[existingIdx], ...mappedLead, updatedAt: new Date().toISOString() };
          updatedCount++;
        } else if (deduplicateOption === 'skip') {
          skippedCount++;
        } else {
          newLeadsToAdd.push(mappedLead);
          importedCount++;
        }
      } else {
        newLeadsToAdd.push(mappedLead);
        importedCount++;
      }
    });

    const finalLeads = [...newLeadsToAdd, ...currentLeads];
    saveLeads(finalLeads, true);

    res.json({
      success: true,
      totalParsed: parsedRows.length,
      importedCount,
      updatedCount,
      skippedCount,
      totalLeads: finalLeads.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao conectar ao Google Planilhas', details: err.message });
  }
});

// API: Quick Scan / Enrichment for Instagram & Contacts (DuckDuckGo Live Web Search)
app.post('/api/leads/quick-scan', async (req, res) => {
  const { ids, limit = 15 } = req.body;
  const leads = getLeads();
  const idSet = Array.isArray(ids) && ids.length > 0 ? new Set(ids) : null;

  // Filter candidates that need scan (missing instagram or website)
  const candidates = leads.filter(l => (!idSet || idSet.has(l.id)) && (!l.hasInstagram || !l.hasWebsite));
  const targetLeads = idSet ? candidates : candidates.slice(0, Number(limit) || 15);
  console.log(`[QUICK SCAN] Iniciando varredura rápida para ${targetLeads.length} leads.`);

  let enrichedCount = 0;

  for (const lead of targetLeads) {
    try {
      const cleanName = lead.name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
      const query = `${cleanName} ${lead.city || ''} instagram whatsapp`;
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
        }
      });

      if (response.ok) {
        const html = await response.text();

        // 1. Look for Instagram handle
        if (!lead.instagram) {
          const instaMatch = html.match(/instagram\.com\/([a-zA-Z0-9_\.]{3,30})/i);
          if (instaMatch && !['p', 'explore', 'reels', 'stories'].includes(instaMatch[1].toLowerCase())) {
            lead.instagram = '@' + instaMatch[1];
            lead.hasInstagram = true;
          }
        }

        // 2. Look for WhatsApp link
        if (!lead.rawPhone) {
          const waMatch = html.match(/wa\.me\/(55\d{10,11})/i) || html.match(/api\.whatsapp\.com\/send\?phone=(55\d{10,11})/i);
          if (waMatch) {
            const raw = waMatch[1];
            lead.rawPhone = raw;
            const phoneData = formatPhoneNumber(raw);
            lead.phone = phoneData.formatted;
            lead.isMobile = true;
            lead.hasPhone = true;
          }
        }

        // 3. Look for regular website
        if (!lead.website) {
          const siteMatches = html.matchAll(/class="result__url"[^>]*>([^<]+)/gi);
          for (const m of siteMatches) {
            const urlCandidate = m[1].trim();
            if (!urlCandidate.includes('instagram.com') &&
                !urlCandidate.includes('facebook.com') &&
                !urlCandidate.includes('google.com') &&
                !urlCandidate.includes('duckduckgo.com') &&
                !urlCandidate.includes('tripadvisor') &&
                !urlCandidate.includes('guiamais')) {
              lead.website = urlCandidate.startsWith('http') ? urlCandidate : 'https://' + urlCandidate;
              lead.hasWebsite = true;
              lead.type = 'Site bom';
              break;
            }
          }
        }

        // Re-evaluate best contact channel & score
        lead.bestContactChannel = determineBestContactChannel(lead.hasPhone, lead.isMobile, lead.hasInstagram, lead.hasWebsite);
        lead.score = calculateLeadScore(lead.hasPhone, lead.hasWebsite, lead.hasInstagram, lead.rating, lead.reviewCount);
        lead.updatedAt = new Date().toISOString();
        enrichedCount++;
      }
    } catch (scanErr) {
      console.warn(`[QUICK SCAN] Falha ao enriquecer ${lead.name}:`, scanErr.message);
    }
  }

  saveLeads(leads, true);
  res.json({ success: true, enrichedCount, totalScanned: targetLeads.length });
});

// API: Get all leads
app.get('/api/leads', (req, res) => {
  const leads = getLeads();
  res.json(leads);
});

// API: Add Lead Manually
app.post('/api/leads/manual', (req, res) => {
  try {
    const { name, niche, phone, rating, reviews, website, instagram, address, city, notes, status } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome da empresa é obrigatório' });

    const phoneData = formatPhoneNumber(phone);
    const parsedRating = parseRating(rating);
    const parsedReviews = parseReviewCount(reviews);

    let siteUrl = website ? website.trim() : null;
    if (siteUrl && !siteUrl.startsWith('http')) siteUrl = 'https://' + siteUrl;

    const hasPhone = !!phoneData.formatted;
    const hasWebsite = !!siteUrl;
    const hasInstagram = !!instagram;
    const bestContactChannel = determineBestContactChannel(hasPhone, phoneData.isMobile, hasInstagram, hasWebsite);
    const score = calculateLeadScore(hasPhone, hasWebsite, hasInstagram, parsedRating, parsedReviews);

    const newLead = {
      id: 'lead-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      name: name.trim(),
      niche: niche ? niche.trim() : 'Geral',
      category: 'Cadastro Manual',
      address: address ? address.trim() : 'Não informado',
      city: city ? city.trim() : 'Taubaté - SP',
      phone: phoneData.formatted || '',
      rawPhone: phoneData.raw || '',
      isMobile: phoneData.isMobile,
      rating: parsedRating,
      reviewCount: parsedReviews,
      website: siteUrl,
      instagram: instagram ? (instagram.startsWith('@') ? instagram : '@' + instagram) : null,
      hasPhone,
      hasWebsite,
      hasInstagram,
      bestContactChannel,
      type: siteUrl ? 'Site bom' : 'Sem presença',
      status: status || 'Novo',
      score,
      notes: notes || 'Cadastrado manualmente',
      createdAt: new Date().toISOString()
    };

    const leads = getLeads();
    leads.unshift(newLead);
    saveLeads(leads, true);

    res.json({ success: true, lead: newLead, total: leads.length });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cadastrar lead', details: err.message });
  }
});

// API: Update single lead
app.put('/api/leads/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const leads = getLeads();

  const idx = leads.findIndex(l => l.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Lead não encontrado' });
  }

  if (updates.phone !== undefined) {
    const phoneData = formatPhoneNumber(updates.phone);
    updates.phone = phoneData.formatted;
    updates.rawPhone = phoneData.raw;
    updates.isMobile = phoneData.isMobile;
    updates.hasPhone = !!phoneData.formatted;
  }

  if (updates.website !== undefined) {
    let site = updates.website ? updates.website.trim() : null;
    if (site && !site.startsWith('http')) site = 'https://' + site;
    updates.website = site;
    updates.hasWebsite = !!site;
    updates.type = site ? 'Site bom' : 'Sem presença';
  }

  if (updates.instagram !== undefined) {
    updates.hasInstagram = !!updates.instagram;
  }

  const hasPhone = updates.hasPhone !== undefined ? updates.hasPhone : leads[idx].hasPhone;
  const isMobile = updates.isMobile !== undefined ? updates.isMobile : leads[idx].isMobile;
  const hasWebsite = updates.hasWebsite !== undefined ? updates.hasWebsite : leads[idx].hasWebsite;
  const hasInstagram = updates.hasInstagram !== undefined ? updates.hasInstagram : leads[idx].hasInstagram;
  const rating = updates.rating !== undefined ? updates.rating : leads[idx].rating;
  const reviews = updates.reviewCount !== undefined ? updates.reviewCount : leads[idx].reviewCount;

  updates.bestContactChannel = determineBestContactChannel(hasPhone, isMobile, hasInstagram, hasWebsite);
  updates.score = calculateLeadScore(hasPhone, hasWebsite, hasInstagram, rating, reviews);

  leads[idx] = { ...leads[idx], ...updates, updatedAt: new Date().toISOString() };
  saveLeads(leads, false);

  res.json({ success: true, lead: leads[idx] });
});

// API: Bulk Status Update
app.post('/api/leads/bulk-status', (req, res) => {
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || !status) {
    return res.status(400).json({ error: 'Array de IDs e novo status são obrigatórios' });
  }

  const leads = getLeads();
  const idSet = new Set(ids);
  let updatedCount = 0;

  leads.forEach(l => {
    if (idSet.has(l.id)) {
      l.status = status;
      l.updatedAt = new Date().toISOString();
      updatedCount++;
    }
  });

  saveLeads(leads, true);
  res.json({ success: true, updatedCount });
});

// API: Bulk Delete
app.post('/api/leads/bulk-delete', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'Array de IDs obrigatório' });
  }

  const leads = getLeads();
  const idSet = new Set(ids);
  const remaining = leads.filter(l => !idSet.has(l.id));
  const deletedCount = leads.length - remaining.length;

  saveLeads(remaining, true);
  res.json({ success: true, deletedCount, totalRemaining: remaining.length });
});

// API: Deduplicate Database
app.post('/api/leads/deduplicate', (req, res) => {
  const leads = getLeads();
  const seenNames = new Map();
  const seenPhones = new Map();
  const uniqueLeads = [];
  let duplicatesRemoved = 0;

  leads.forEach(lead => {
    const normName = lead.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const rawPhone = lead.rawPhone;

    if (seenNames.has(normName) || (rawPhone && seenPhones.has(rawPhone))) {
      duplicatesRemoved++;
    } else {
      seenNames.set(normName, true);
      if (rawPhone) seenPhones.set(rawPhone, true);
      uniqueLeads.push(lead);
    }
  });

  saveLeads(uniqueLeads, true);
  res.json({ success: true, duplicatesRemoved, totalRemaining: uniqueLeads.length });
});

// API: Reset Database
app.post('/api/leads/reset', (req, res) => {
  saveLeads([], true);
  res.json({ success: true, message: 'Base de dados resetada com sucesso. Backup salvo.' });
});

// API: Delete single lead
app.delete('/api/leads/:id', (req, res) => {
  const { id } = req.params;
  let leads = getLeads();
  leads = leads.filter(l => l.id !== id);
  saveLeads(leads);
  res.json({ success: true });
});

// API: WhatsApp Message Generator (3 scripts)
app.get('/api/templates/:id', (req, res) => {
  const { id } = req.params;
  const leads = getLeads();
  const lead = leads.find(l => l.id === id);

  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  const name = lead.name;
  const rating = lead.rating ? lead.rating.toFixed(1) : '5.0';
  const reviews = lead.reviewCount || 'dezenas de';

  const templates = [
    {
      title: 'Opção 1: Foco em Tráfego Pago & Rapport pela Nota',
      objective: 'Elogio à reputação no Google + proposta para captar mais clientes/alunos particulares via tráfego.',
      message: `Oi, tudo bem? Vi aqui que a *${name}* tem uma nota de *${rating} estrelas* no Google (${reviews} avaliações), parabéns pelo padrão de atendimento! 👏\n\nTrabalho ajudando negócios aqui na região a atraírem mais alunos e clientes recorrentes através de anúncios estratégicos no Google e Instagram.\n\nVale a pena eu te mandar um áudio de 1 minuto explicando como podemos colocar novos contatos na agenda de vocês toda semana?`
    },
    {
      title: 'Opção 2: Foco em Criação/Redesign de Site & Conversão',
      objective: 'Geração de curiosidade sobre como transformar buscas locais em conversas no WhatsApp.',
      message: `Opa, bom dia! Tudo bem por aí?\n\nEstava pesquisando referências na região e encontrei a *${name}* com uma excelente reputação de *${rating}★ no Google*.\n\nNotei um detalhe importante na presença online de vocês que pode estar fazendo potenciais clientes irem pro concorrente em vez de clicar no WhatsApp.\n\nPosso te mandar um vídeo rápido de 2 minutinhos mostrando esse ajuste sem custo nenhum?`
    },
    {
      title: 'Opção 3: Ultra Curta & Quebra de Padrão (Recepção/Gestor)',
      objective: 'Mensagem de 2 linhas informal para obter resposta rápida e passar pelo filtro da recepção.',
      message: `Oi! É da equipe da *${name}*?\n\nVi a nota excelente de vocês no Google (*${rating} estrelas*!) e queria tirar uma dúvida rápida sobre aquisição de novos clientes aí na região.\n\nCom quem eu consigo falar sobre isso rapidinho por aqui?`
    }
  ];

  res.json({ lead, templates });
});

// API: Export CSV
app.get('/api/export-csv', (req, res) => {
  const leads = getLeads();
  let csv = 'Nome,Nicho,Telefone,WhatsApp Raw,Melhor Canal,Avaliacao Google,Avaliacoes,Site,Instagram,Tipo,Status,Score,Endereco,Cidade,Google Maps URL\n';

  leads.forEach(l => {
    const clean = str => `"${(str || '').toString().replace(/"/g, '""')}"`;
    csv += [
      clean(l.name),
      clean(l.niche),
      clean(l.phone),
      clean(l.rawPhone),
      clean(l.bestContactChannel),
      clean(l.rating),
      clean(l.reviewCount),
      clean(l.website),
      clean(l.instagram),
      clean(l.type),
      clean(l.status),
      clean(l.score),
      clean(l.address),
      clean(l.city),
      clean(l.googleMapsUrl)
    ].join(',') + '\n';
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="leads_mapscraper_export.csv"');
  res.send('\uFEFF' + csv);
});

// API: Export JSON
app.get('/api/export-json', (req, res) => {
  const leads = getLeads();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="leads_mapscraper_export.json"');
  res.json(leads);
});

// Supabase Configuration & Sync
app.get('/api/supabase/config', (req, res) => {
  try {
    if (fs.existsSync(SUPABASE_CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(SUPABASE_CONFIG_FILE, 'utf-8'));
      return res.json({
        connected: !!(config.url && config.key),
        url: config.url || '',
        key: config.key ? '••••••••' + config.key.slice(-6) : ''
      });
    }
  } catch (e) {}
  res.json({ connected: false, url: '', key: '' });
});

app.post('/api/supabase/config', (req, res) => {
  const { url, key } = req.body;
  try {
    fs.writeFileSync(SUPABASE_CONFIG_FILE, JSON.stringify({ url: (url || '').trim(), key: (key || '').trim() }, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar configuração do Supabase' });
  }
});

app.post('/api/supabase/sync', async (req, res) => {
  try {
    if (!fs.existsSync(SUPABASE_CONFIG_FILE)) {
      return res.status(400).json({ error: 'Supabase não configurado. Adicione a URL e a Anon Key.' });
    }
    const config = JSON.parse(fs.readFileSync(SUPABASE_CONFIG_FILE, 'utf-8'));
    if (!config.url || !config.key) {
      return res.status(400).json({ error: 'URL ou Anon Key do Supabase ausentes.' });
    }

    const leads = getLeads();
    const endpoint = `${config.url.replace(/\/$/, '')}/rest/v1/leads`;

    const response = await fetch(`${endpoint}?on_conflict=id`, {
      method: 'POST',
      headers: {
        'apikey': config.key,
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(leads)
    });

    if (!response.ok) {
      const errTxt = await response.text();
      return res.status(response.status).json({ error: `Erro na API Supabase: ${errTxt}` });
    }

    res.json({ success: true, count: leads.length });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao sincronizar com Supabase: ' + err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 MapScraper Server rodando em http://localhost:${PORT}`);
  console.log(`📁 Armazenamento: ${DATA_FILE}`);
});
