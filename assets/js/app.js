// ============================================================
// CONFIG
// ============================================================
const SITE_URL = 'https://dawn-sunrays-checker.vercel.app';

const TIERS = [
  { name: 'Dawn Ascendant', min: 35, max: Infinity, key: 'Dawn Ascendant', nft: true, color: '#f97316' },
  { name: 'Solar Sentinel',  min: 30, max: 34, key: 'Solar Sentinel',  nft: true, color: '#d4a843' },
  { name: 'Keeper of the Flame', min: 25, max: 29, key: 'Keeper of the Flame', nft: true, color: '#cd7f32' },
  { name: 'Luminary',  min: 20, max: 24, key: 'Luminary',  nft: true, color: '#c87840' },
  { name: 'Architect', min: 15, max: 19, key: 'Architect', nft: true, color: '#6496c8' },
  { name: 'Beacon',    min: 10, max: 14, key: 'Beacon',    nft: true, color: '#5082b4' },
  { name: 'Trailblazer', min: 5, max: 9, key: 'Trailblazer', nft: true, color: '#3c6ea0' },
  { name: 'Newcomer',   min: 1, max: 4,  key: 'Newcomer',   nft: false, color: '#4a7a6a' },
];

function getTier(rays) {
  return TIERS.find(t => rays >= t.min && rays <= t.max) || TIERS[TIERS.length-1];
}

// ============================================================
// STATE
// ============================================================
let allUsers = [];
let weeklyData = {};
let allWeeks = [];
let currentWeekIndex = 0;
const PAGE_SIZE = 25;
let currentPage = 1;
let weeklyJsonData = null;
let currentCardUser = null;
let weeklyRefreshInterval = null;
let sunraysRefreshInterval = null;

// ============================================================
// INIT
// ============================================================
async function init() {
  await loadImages();
  buildTierGuide();
  setupSearch();
  
  // Start auto-refresh for all data
  startAutoRefresh();
  
  // Initial data load
  await loadAllData();
}

function startAutoRefresh() {
  // Initial loads
  loadWeeklyData();
  loadSunraysData();
  
  // Set up intervals for auto-refresh every 60 seconds
  weeklyRefreshInterval = setInterval(loadWeeklyData, 60000);
  sunraysRefreshInterval = setInterval(loadSunraysData, 60000);
}

async function loadAllData() {
  try {
    await Promise.all([
      loadSunraysData(),
      loadWeeklyData()
    ]);
  } catch (err) {
    console.warn('Data load error:', err);
    showError('lbBody', 'Failed to load data. Please refresh.');
  }
}

// ============================================================
// DATA FETCHING - COMPLETE DATA FROM JSON
// ============================================================
async function loadSunraysData() {
  try {
    const res = await fetch(`./all_sunrays.json?ts=${Date.now()}`);
    if (!res.ok) throw new Error('Failed to fetch sunrays data');
    const data = await res.json();
    
    // Process ALL users from JSON - no limits, no slicing
    const formattedData = data.map(u => ({
      discord_name: u['Discord Name'],
      sun_rays: u['Sun Rays']
    }));
    
    processSunraysData(formattedData);
    return data;
  } catch (e) {
    console.error('Sunrays data fetch failed:', e);
    showError('lbBody', 'Failed to load leaderboard data');
    return null;
  }
}

async function loadWeeklyData() {
  try {
    const res = await fetch(`./weekly_winners.json?ts=${Date.now()}`);
    if (!res.ok) throw new Error('Failed to fetch weekly data');
    const data = await res.json();
    
    // Only update if data changed
    const dataStr = JSON.stringify(data);
    const cachedStr = JSON.stringify(weeklyJsonData);
    
    if (dataStr !== cachedStr) {
      weeklyJsonData = data;
      const formattedData = data.map(w => ({
        date: w['Date'],
        discord_name: w['Discord Name'],
        type: w['Type'],
        sun_rays: w['Sun Rays'],
        notes: w['Notes']
      }));
      processWeeklyData(formattedData);
    }
    
    return data;
  } catch (e) {
    console.warn('Weekly data refresh failed:', e);
    return null;
  }
}

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.innerHTML = `
      <div class="error-state">
        <div class="error-state-icon">⚠️</div>
        <div class="error-state-title">Something went wrong</div>
        <div class="error-state-msg">${message}</div>
        <button class="retry-btn" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

// ============================================================
// IMAGES
// ============================================================
async function loadImages() {
  const logoPath = 'logo.png';
  const navLogo = document.getElementById('navLogo');
  const footerLogo = document.getElementById('footerLogo');
  if (navLogo) navLogo.src = logoPath;
  if (footerLogo) footerLogo.src = logoPath;
}

// ============================================================
// PROCESS SUNRAYS DATA - ALL USERS
// ============================================================
function processSunraysData(data) {
  if (!data || data.length === 0) {
    showError('lbBody', 'No data available');
    return;
  }
  
  // Process ALL users - no limits
  allUsers = data.map((u, i) => ({
    name: u.discord_name,
    rays: u.sun_rays,
    rank: i + 1,
    tier: getTier(u.sun_rays)
  }));
  
  const total = allUsers.length;
  const maxRays = allUsers[0]?.rays || 0;
  const nftHolders = allUsers.filter(u => u.rays >= 5).length;
  
  document.getElementById('statTotal').textContent = total.toLocaleString();
  document.getElementById('statMaxRays').textContent = maxRays.toLocaleString();
  document.getElementById('statNFT').textContent = nftHolders.toLocaleString();
  
  renderLeaderboard(currentPage);
  renderTierDistribution();
}

// ============================================================
// LEADERBOARD
// ============================================================
function renderLeaderboard(page) {
  currentPage = page;
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageUsers = allUsers.slice(start, end);
  
  const body = document.getElementById('lbBody');
  if (pageUsers.length === 0) {
    body.innerHTML = '<div class="loader">No data available</div>';
    return;
  }
  
  const medals = ['🥇','🥈','🥉'];
  body.innerHTML = pageUsers.map((u, i) => {
    const absRank = start + i + 1;
    let rankClass = '';
    if (absRank === 1) rankClass = 'top1';
    else if (absRank === 2) rankClass = 'top2';
    else if (absRank === 3) rankClass = 'top3';
    const medal = absRank <= 3 ? `<span class="lb-medal">${medals[absRank-1]}</span>` : '';
    const tierTag = `<span class="lb-tier-tag" style="background:${u.tier.color}18;color:${u.tier.color};border:1px solid ${u.tier.color}30">${u.tier.name}</span>`;
    return `
      <div class="lb-row">
        <div class="lb-rank ${rankClass}">${medal || '#'+absRank}</div>
        <div class="lb-name" title="${escHtml(u.name)}"><a href="https://discord.com/users/${escHtml(u.name)}" target="_blank" rel="noopener">${escHtml(u.name)}</a></div>
        ${tierTag}
        <div class="lb-rays">☀️ ${u.rays}</div>
      </div>
    `;
  }).join('');
  
  renderPagination();
}

function renderPagination() {
  const total = Math.ceil(allUsers.length / PAGE_SIZE);
  const pg = document.getElementById('pagination');
  if (total <= 1) { pg.innerHTML = ''; return; }
  
  let html = `<button class="page-btn" onclick="renderLeaderboard(${currentPage-1})" ${currentPage===1?'disabled':''}>‹</button>`;
  
  const maxVisible = 7;
  let startP = Math.max(1, currentPage - 3);
  let endP = Math.min(total, startP + maxVisible - 1);
  if (endP - startP < maxVisible - 1) startP = Math.max(1, endP - maxVisible + 1);
  
  if (startP > 1) html += `<button class="page-btn" onclick="renderLeaderboard(1)">1</button>${startP>2?'<span style="padding:0 4px;color:var(--muted)">…</span>':''}`;
  for (let i = startP; i <= endP; i++) {
    html += `<button class="page-btn ${i===currentPage?'active':''}" onclick="renderLeaderboard(${i})">${i}</button>`;
  }
  if (endP < total) html += `${endP<total-1?'<span style="padding:0 4px;color:var(--muted)">…</span>':''}<button class="page-btn" onclick="renderLeaderboard(${total})">${total}</button>`;
  html += `<button class="page-btn" onclick="renderLeaderboard(${currentPage+1})" ${currentPage===total?'disabled':''}>›</button>`;
  
  pg.innerHTML = html;
}

// ============================================================
// TIER DISTRIBUTION - FIXED IMAGE PATHS
// ============================================================
function renderTierDistribution() {
  const officialTiers = TIERS.filter(t => t.nft);
  const newcomer = TIERS.find(t => !t.nft);
  
  const carousel = document.getElementById('tierCarousel');
  
  let cardsHtml = '';
  
  officialTiers.forEach(tier => {
    const holders = allUsers.filter(u => u.rays >= tier.min && u.rays <= tier.max);
    const topUsers = holders.slice(0, 3);
    // Use tier.key directly - file names have spaces
    const imgPath = tier.key + '.jpg';
    cardsHtml += `
      <div class="tier-card" style="border-color:${tier.color}40">
        <div class="tier-img-wrap">
          <img src="${imgPath}" alt="${tier.name}" loading="lazy" onerror="this.onerror=null;this.src='';this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;background:linear-gradient(135deg,${tier.color}20,${tier.color}05);display:flex;align-items:center;justify-content:center;font-size:32px\\'>☀️</div>'">
        </div>
        <div class="tier-info">
          <div class="tier-name" style="color:${tier.color}">${tier.name}</div>
          <div class="tier-range">${tier.min}${tier.max===Infinity?'+':('–'+tier.max)} Sunrays</div>
          <div class="tier-count"><strong>${holders.length}</strong> holders</div>
          ${topUsers.length > 0 ? `<div class="tier-top-users">${topUsers.map(u=>`<div class="tier-user" title="${escHtml(u.name)}">⚡ ${escHtml(u.name)}</div>`).join('')}</div>` : ''}
        </div>
      </div>
    `;
  });
  
  const duplicatedCards = cardsHtml;
  carousel.innerHTML = cardsHtml + duplicatedCards;
  
  const newcomerHolders = allUsers.filter(u => u.rays >= newcomer.min && u.rays <= newcomer.max);
  document.getElementById('newcomerBanner').innerHTML = `
    <div class="newcomer-banner">
      <img class="newcomer-img" src="Newcomer.jpg" alt="Newcomer" onerror="this.style.display='none'">
      <div class="newcomer-info">
        <div class="newcomer-title">🌱 Newcomer — Community Tier</div>
        <div class="newcomer-note">Not an official NFT tier. Members with 1–4 sunrays are welcomed as Newcomers to the DAWN community. Keep participating to reach Trailblazer!</div>
      </div>
      <div class="newcomer-count">${newcomerHolders.length}<br><span style="font-size:12px;color:var(--muted)">members</span></div>
    </div>
  `;
}

// ============================================================
// WEEKLY WINNERS - FIXED DATE FORMAT
// ============================================================
function parseDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr.trim());
    if (isNaN(d.getTime())) return null;
    return d;
  } catch (e) {
    return null;
  }
}

function formatDateWithOrdinal(date) {
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const suffix = getOrdinalSuffix(day);
  return `${day}${suffix} ${month}`;
}

function getOrdinalSuffix(n) {
  if (n > 3 && n < 21) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function formatDateShort(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function processWeeklyData(data) {
  if (!data || data.length === 0) {
    document.getElementById('wwContent').innerHTML = '<div class="ww-empty">No weekly data available</div>';
    document.getElementById('weekLabel').textContent = 'No weeks available';
    document.getElementById('weekDateRange').textContent = '';
    document.getElementById('prevWeek').disabled = true;
    document.getElementById('nextWeek').disabled = true;
    return;
  }
  
  weeklyData = {};
  data.forEach(r => {
    const d = r.date ? r.date.trim() : '';
    if (d) {
      if (!weeklyData[d]) weeklyData[d] = [];
      weeklyData[d].push(r);
    }
  });
  
  // Get unique dates and sort chronologically
  const datesWithParsed = Object.keys(weeklyData)
    .map(d => ({ original: d, parsed: parseDate(d) }))
    .filter(d => d.parsed !== null)
    .sort((a, b) => a.parsed - b.parsed);
  
  allWeeks = datesWithParsed.map(d => d.original);
  
  document.getElementById('statWeeks').textContent = allWeeks.length;
  
  currentWeekIndex = allWeeks.length - 1;
  
  renderWeeklyWinners();
}

function changeWeek(dir) {
  const newIdx = currentWeekIndex + dir;
  if (newIdx < 0 || newIdx >= allWeeks.length) return;
  currentWeekIndex = newIdx;
  renderWeeklyWinners();
}

function renderWeeklyWinners() {
  if (allWeeks.length === 0) {
    document.getElementById('wwContent').innerHTML = '<div class="ww-empty">No weekly data available</div>';
    return;
  }
  
  const weekDateStr = allWeeks[currentWeekIndex];
  const entries = weeklyData[weekDateStr] || [];
  
  const currentDate = parseDate(weekDateStr);
  
  // Calculate week range: 7 days ending on the ceremony date
  // Week of Xth February: data from (X-6) to X
  let weekStart, weekEnd;
  if (currentDate) {
    weekEnd = new Date(currentDate);
    weekStart = new Date(currentDate);
    weekStart.setDate(weekStart.getDate() - 6);
  }
  
  // Week label - ceremony name
  const firstNote = entries[0]?.notes || '';
  const ceremonyMatch = firstNote.match(/Ceremony\s+(\d+)/i);
  const ceremonyNum = ceremonyMatch ? ceremonyMatch[1] : '';
  
  if (ceremonyNum) {
    document.getElementById('weekLabel').textContent = `Sunrise Ceremony #${ceremonyNum}`;
  } else {
    document.getElementById('weekLabel').textContent = weekDateStr;
  }
  
  // Date range display: "Week of 20th February" with range below
  if (currentDate && weekStart && weekEnd) {
    const weekOfText = `Week of ${formatDateWithOrdinal(currentDate)}`;
    const rangeText = `${formatDateShort(weekStart)} → ${formatDateShort(weekEnd)}`;
    document.getElementById('weekDateRange').innerHTML = `<div style="font-size:14px;color:var(--white);margin-bottom:4px">${weekOfText}</div><div style="font-size:12px;color:var(--muted)">${rangeText}</div>`;
  } else {
    document.getElementById('weekDateRange').textContent = weekDateStr;
  }
  
  document.getElementById('prevWeek').disabled = currentWeekIndex === 0;
  document.getElementById('nextWeek').disabled = currentWeekIndex === allWeeks.length - 1;
  
  if (entries.length === 0) {
    document.getElementById('wwContent').innerHTML = '<div class="ww-empty">No data for this week</div>';
    return;
  }
  
  const cats = {};
  entries.forEach(e => {
    const t = e.type ? e.type.trim() : 'Other';
    if (!cats[t]) cats[t] = [];
    cats[t].push(e);
  });
  
  let html = '<div class="ww-categories">';
  Object.entries(cats).sort(([a],[b]) => a.localeCompare(b)).forEach(([cat, winners]) => {
    html += `
      <div class="ww-cat">
        <div class="ww-cat-title">${escHtml(cat)}</div>
        <div class="ww-grid">
          ${winners.map(w => `
            <span class="ww-winner-tag">
              ☀️ <a href="https://discord.com/users/${escHtml(w.discord_name)}" target="_blank" rel="noopener">${escHtml(w.discord_name)}</a>
              ${w.sun_rays > 1 ? `<span class="ww-rays">+${w.sun_rays}</span>` : ''}
            </span>
          `).join('')}
        </div>
      </div>
    `;
  });
  html += '</div>';
  document.getElementById('wwContent').innerHTML = html;
}

// ============================================================
// TIER GUIDE
// ============================================================
function buildTierGuide() {
  const list = document.getElementById('tierGuideList');
  if (!list) return;
  list.innerHTML = TIERS.map(t => `
    <div class="tlg-item">
      <div class="tlg-dot" style="background:${t.color}"></div>
      <div class="tlg-name">${t.name}</div>
      <div class="tlg-rays">${t.min}${t.max===Infinity?'+':t.max===4?'–4':('–'+t.max)} ☀️</div>
      ${t.nft ? '<span class="tlg-nft-badge">NFT</span>' : '<span class="tlg-nft-badge" style="color:var(--muted);background:rgba(100,100,100,0.1)">COMMUNITY</span>'}
    </div>
  `).join('');
}

// ============================================================
// SEARCH
// ============================================================
let searchTimeout;
let selectedAcIdx = -1;

function setupSearch() {
  const input = document.getElementById('searchInput');
  const acList = document.getElementById('acList');
  const clearBtn = document.getElementById('searchClear');
  
  if (!input) return;
  
  input.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const val = input.value.trim();
    if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
    
    if (!val) {
      acList.style.display = 'none';
      hideResult();
      return;
    }
    searchTimeout = setTimeout(() => updateAutocomplete(val), 120);
  });
  
  input.addEventListener('keydown', (e) => {
    const items = acList.querySelectorAll('.ac-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedAcIdx = Math.min(selectedAcIdx + 1, items.length - 1);
      updateAcActive(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedAcIdx = Math.max(selectedAcIdx - 1, -1);
      updateAcActive(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedAcIdx >= 0 && items[selectedAcIdx]) {
        items[selectedAcIdx].click();
      } else {
        searchUser(input.value.trim());
      }
    } else if (e.key === 'Escape') {
      acList.style.display = 'none';
    }
  });
  
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
      acList.style.display = 'none';
    }
  });
}

function updateAcActive(items) {
  items.forEach((it, i) => {
    it.classList.toggle('active', i === selectedAcIdx);
  });
}

function updateAutocomplete(query) {
  const lq = query.toLowerCase();
  const matches = allUsers.filter(u => u.name.toLowerCase().includes(lq)).slice(0, 8);
  const acList = document.getElementById('acList');
  
  if (matches.length === 0) {
    acList.style.display = 'none';
    return;
  }
  
  selectedAcIdx = -1;
  acList.innerHTML = matches.map((u) => `
    <div class="ac-item" onclick="selectUser('${escHtml(u.name).replace(/'/g,"\\'")}')">
      <span class="ac-name">${highlightMatch(escHtml(u.name), query)}</span>
      <span class="ac-rays">☀️ ${u.rays}</span>
    </div>
  `).join('');
  acList.style.display = 'block';
}

function highlightMatch(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  return text.slice(0,idx) + '<strong style="color:var(--orange)">' + text.slice(idx, idx+query.length) + '</strong>' + text.slice(idx+query.length);
}

function selectUser(name) {
  document.getElementById('searchInput').value = name;
  document.getElementById('acList').style.display = 'none';
  document.getElementById('searchClear').style.display = 'block';
  searchUser(name);
}

function searchUser(name) {
  const lname = name.toLowerCase();
  const user = allUsers.find(u => u.name.toLowerCase() === lname);
  document.getElementById('acList').style.display = 'none';
  
  if (!user) {
    document.getElementById('resultCard').style.display = 'none';
    document.getElementById('noResult').style.display = 'block';
    return;
  }
  document.getElementById('noResult').style.display = 'none';
  renderUserCard(user);
}

function renderUserCard(user) {
  const card = document.getElementById('resultCard');
  card.style.display = 'block';
  currentCardUser = user;
  
  const tierIdx = TIERS.findIndex(t => t === user.tier);
  const prevTier = tierIdx > 0 ? TIERS[tierIdx - 1] : null;
  let progressHtml = '';
  if (prevTier) {
    const progress = Math.min(100, Math.round(((user.rays - user.tier.min) / (prevTier.min - user.tier.min)) * 100));
    progressHtml = `
      <div class="progress-section">
        <div class="progress-labels">
          <span>Progress to ${prevTier.name}</span>
          <span>${user.rays} / ${prevTier.min} ☀️</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
      </div>
    `;
  }
  
  let activityHtml = '';
  const userWins = [];
  Object.values(weeklyData).flat().forEach(w => {
    if (w.discord_name && w.discord_name.toLowerCase() === user.name.toLowerCase()) {
      userWins.push(w);
    }
  });
  
  if (userWins.length > 0) {
    const catCounts = {};
    userWins.forEach(w => {
      const t = w.type ? w.type.trim() : 'Other';
      catCounts[t] = (catCounts[t] || 0) + 1;
    });
    const topCats = Object.entries(catCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
    activityHtml = `
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px">Activity Breakdown</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${topCats.map(([cat,n]) => `<span style="font-size:11px;background:var(--bg2);border:1px solid var(--border);padding:3px 10px;border-radius:6px;transition:all 0.2s ease" onmouseover="this.style.borderColor='var(--orange)'" onmouseout="this.style.borderColor='var(--border)'">${escHtml(cat)} <span style="color:var(--orange)">×${n}</span></span>`).join('')}
        </div>
      </div>
    `;
  } else {
    activityHtml = `
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px">Activity Breakdown</div>
        <div style="font-size:13px;color:var(--muted)">No activity records found yet. Start participating in ceremonies to earn sunrays!</div>
      </div>
    `;
  }
  
  card.innerHTML = `
    <div class="rc-header">
      <div class="rc-username"><a href="https://discord.com/users/${escHtml(user.name)}" target="_blank" rel="noopener">${escHtml(user.name)}</a></div>
      <span class="rc-tier-badge" style="background:${user.tier.color}15;color:${user.tier.color};border:1px solid ${user.tier.color}30">
        ☀️ ${user.tier.name}
      </span>
    </div>
    <div class="rc-stats">
      <div class="rc-stat">
        <div class="rc-stat-val">${user.rays}</div>
        <div class="rc-stat-lbl">Sunrays</div>
      </div>
      <div class="rc-stat">
        <div class="rc-stat-val">#${user.rank}</div>
        <div class="rc-stat-lbl">Global Rank</div>
      </div>
      <div class="rc-stat">
        <div class="rc-stat-val">${Math.round((1 - (user.rank-1)/allUsers.length)*100)}%</div>
        <div class="rc-stat-lbl">Percentile</div>
      </div>
    </div>
    ${progressHtml}
    ${activityHtml}
    <div class="rc-share-btns">
      <button class="rc-share-btn primary" onclick="generateProfileCard()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        Generate Card
      </button>
      <a class="rc-share-btn" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out my DAWN Sunrays stats! ${user.rays} ☀️ | Rank #${user.rank} | ${user.tier.name}`)}&url=${encodeURIComponent(SITE_URL)}" target="_blank">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        Share on X
      </a>
    </div>
  `;
}

function hideResult() {
  document.getElementById('resultCard').style.display = 'none';
  document.getElementById('noResult').style.display = 'none';
  currentCardUser = null;
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').style.display = 'none';
  document.getElementById('acList').style.display = 'none';
  hideResult();
  document.getElementById('searchInput').focus();
}

// ============================================================
// PROFILE CARD GENERATOR - FIXED HEADER SPACING
// ============================================================
function generateProfileCard() {
  if (!currentCardUser) return;
  
  const canvas = document.getElementById('profileCanvas');
  const ctx = canvas.getContext('2d');
  const user = currentCardUser;
  
  const w = 800;
  const h = 450;
  
  ctx.clearRect(0, 0, w, h);
  
  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, '#0e0e0e');
  bgGrad.addColorStop(0.5, '#121212');
  bgGrad.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);
  
  // Decorative gradient orb
  const orbGrad = ctx.createRadialGradient(600, 100, 0, 600, 100, 300);
  orbGrad.addColorStop(0, 'rgba(249, 115, 22, 0.15)');
  orbGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.05)');
  orbGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = orbGrad;
  ctx.fillRect(0, 0, w, h);
  
  // Border
  ctx.strokeStyle = 'rgba(249, 115, 22, 0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
  
  // Inner glow border
  ctx.shadowColor = 'rgba(249, 115, 22, 0.2)';
  ctx.shadowBlur = 20;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.shadowBlur = 0;
  
  // Header bar
  ctx.fillStyle = 'rgba(249, 115, 22, 0.1)';
  ctx.fillRect(0, 0, w, 80);
  
  // Logo/Brand - FIXED: Better spacing and positioning
  // Draw sun icon
  ctx.font = '24px serif';
  ctx.fillStyle = '#f97316';
  ctx.textAlign = 'left';
  ctx.fillText('☀️', 30, 50);
  
  // DAWN text - positioned after sun icon
  ctx.font = 'bold 26px Syne, sans-serif';
  ctx.fillStyle = '#f97316';
  ctx.fillText('DAWN', 65, 50);
  
  // Sunrays Tracker text - with proper spacing from DAWN
  ctx.fillStyle = '#888';
  ctx.font = '500 13px Outfit, sans-serif';
  ctx.fillText('SUNRAYS TRACKER', 180, 50);
  
  // Username
  ctx.fillStyle = '#f5f0eb';
  ctx.font = 'bold 42px Syne, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(user.name, w / 2, 170);
  
  // Tier badge background
  const tierColor = user.tier.color;
  ctx.fillStyle = tierColor + '20';
  ctx.strokeStyle = tierColor + '50';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(w / 2 - 100, 195, 200, 36, 18);
  ctx.fill();
  ctx.stroke();
  
  // Tier text
  ctx.fillStyle = tierColor;
  ctx.font = '600 16px Outfit, sans-serif';
  ctx.fillText(`☀️ ${user.tier.name}`, w / 2, 220);
  
  // Stats section
  const statY = 300;
  const statSpacing = 200;
  const startX = w / 2 - statSpacing;
  
  const stats = [
    { label: 'SUNRAYS', value: user.rays.toString() },
    { label: 'GLOBAL RANK', value: `#${user.rank}` },
    { label: 'PERCENTILE', value: `${Math.round((1 - (user.rank-1)/allUsers.length)*100)}%` }
  ];
  
  stats.forEach((stat, i) => {
    const x = startX + i * statSpacing;
    
    ctx.fillStyle = 'rgba(22, 22, 22, 0.8)';
    ctx.strokeStyle = 'rgba(42, 42, 42, 0.8)';
    ctx.beginPath();
    ctx.roundRect(x - 70, statY - 50, 140, 100, 10);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 36px "DM Mono", monospace';
    ctx.fillText(stat.value, x, statY + 5);
    
    ctx.fillStyle = '#6b6b6b';
    ctx.font = '500 11px Outfit, sans-serif';
    ctx.fillText(stat.label, x, statY + 30);
  });
  
  // Footer
  ctx.fillStyle = 'rgba(249, 115, 22, 0.08)';
  ctx.fillRect(0, h - 50, w, 50);
  
  ctx.fillStyle = '#666';
  ctx.font = '500 12px Outfit, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('dawn-sunrays-checker.vercel.app', 30, h - 20);
  
  ctx.fillStyle = '#f97316';
  ctx.textAlign = 'right';
  ctx.fillText('created by bunnyy', w - 30, h - 20);
  
  document.getElementById('cardModal').classList.add('active');
}

function closeCardModal(event) {
  if (!event || event.target === document.getElementById('cardModal')) {
    document.getElementById('cardModal').classList.remove('active');
  }
}

function downloadCard() {
  const canvas = document.getElementById('profileCanvas');
  const link = document.createElement('a');
  link.download = `dawn-sunrays-${currentCardUser?.name || 'card'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function shareCard() {
  if (!currentCardUser) return;
  const user = currentCardUser;
  const text = encodeURIComponent(`Check out my DAWN Sunrays stats! ☀️ ${user.rays} sunrays | Rank #${user.rank} | ${user.tier.name}`);
  const url = encodeURIComponent(SITE_URL);
  window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
}

// ============================================================
// UTILS
// ============================================================
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function toggleNav() {
  document.getElementById('navLinks').classList.toggle('open');
}

function closeNav() {
  document.getElementById('navLinks').classList.remove('open');
}

// ============================================================
// START
// ============================================================
document.addEventListener('DOMContentLoaded', init);
