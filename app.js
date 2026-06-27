/* ==========================================================================
   ELEMENTAL EMPIRE — ARCHIVAL LOGIC ENGINE v2
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ====================================================================
     1. GLOBAL STATE
     ==================================================================== */
  let xmlDatabase   = null;
  let activeTab     = 'home';
  let activeTimelineFilter = 'all';
  let currentLockdownState = 'green';

  // Auth
  let isLoggedIn    = false;
  let adminRole     = null;
  let loggedInUser  = null;
  let usersList     = [];
  // Password hashes removed – authentication now handled server-side.

  // Edit mode
  let isWidgetEditMode   = false;
  let currentEditingWidgets = [];
  let leaveModalTarget   = null;
  let inlineEditCallback = null;

  /* ====================================================================
     2. DOM REFERENCES
     ==================================================================== */
  const viewTitle       = document.getElementById('view-title');
  const viewSubtitle    = document.getElementById('view-subtitle');
  const contentViewport = document.getElementById('contentViewport');
  const sidebar         = document.getElementById('sidebar');
  const menuToggleBtn   = document.getElementById('menuToggleBtn');
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');
  const statMembers     = document.getElementById('stat-members');
  const statFounded     = document.getElementById('stat-founded');
  const statEra         = document.getElementById('stat-era');
  const metaDiscordEl   = document.getElementById('meta-discord');
  const metaYoutubeEl   = document.getElementById('meta-youtube');
  const floatingEditBtn = document.getElementById('floating-edit-btn');
  const leaveModal      = document.getElementById('leave-modal');
  const lightboxEl      = document.getElementById('lightbox');
  const inlineEditModal = document.getElementById('inline-edit-modal');

  /* ====================================================================
     3. INIT
     ==================================================================== */
  initParticles();
  setupSidebarToggle();
  setupIPBanner();
  setupLeaveModal();
  setupLightbox();
  setupFloatingEditBtn();
  setupInlineEditModal();

  // Handle secret url parameter admin access
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('admin') || urlParams.has('manage')) {
    localStorage.setItem('ee_admin_visible', 'true');
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Keyboard shortcut listener to toggle admin visibility: Ctrl + Shift + A
  window.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      if (localStorage.getItem('ee_admin_visible') === 'true') {
        localStorage.removeItem('ee_admin_visible');
        showToast('Admin access points hidden.');
        if (activeTab === 'admin') {
          activeTab = 'home';
        }
      } else {
        localStorage.setItem('ee_admin_visible', 'true');
        showToast('Admin access points unlocked!');
      }
      setupNavigation();
      renderActiveTab();
    }
  });

  loadDatabase().then(doc => {
    xmlDatabase = doc;
    updateMetaInfo();
    setupNavigation();
    renderActiveTab();
  });

  /* ====================================================================
     4. SIDEBAR TOGGLE
     ==================================================================== */
  function setupSidebarToggle() {
    menuToggleBtn?.addEventListener('click', () => sidebar.classList.add('show'));
    closeSidebarBtn?.addEventListener('click', () => sidebar.classList.remove('show'));
  }

  /* ====================================================================
     5. IP BANNER
     ==================================================================== */
  function setupIPBanner() {
    const btn = document.getElementById('copy-ip-btn');
    const badge = document.getElementById('ip-copied-badge');
    btn?.addEventListener('click', () => {
      const text = 'play.bendersmc.co';
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => showCopied(badge));
      } else {
        const el = Object.assign(document.createElement('textarea'), { value: text });
        document.body.appendChild(el); el.select(); document.execCommand('copy'); el.remove();
        showCopied(badge);
      }
    });
  }
  function showCopied(badge) {
    badge.classList.add('visible');
    setTimeout(() => badge.classList.remove('visible'), 2200);
    showToast('Server IP copied to clipboard!');
  }

  /* ====================================================================
     6. LEAVE CONFIRMATION MODAL
     ==================================================================== */
  function setupLeaveModal() {
    const wikiLink = document.getElementById('wiki-external-link');
    const cancelBtn = document.getElementById('leave-modal-cancel');
    const confirmBtn = document.getElementById('leave-modal-confirm');
    const urlEl = document.getElementById('leave-modal-url');

    wikiLink?.addEventListener('click', e => {
      e.preventDefault();
      leaveModalTarget = wikiLink.href;
      if (urlEl) urlEl.textContent = leaveModalTarget;
      leaveModal.classList.add('active');
    });
    cancelBtn?.addEventListener('click', () => leaveModal.classList.remove('active'));
    confirmBtn?.addEventListener('click', () => {
      if (leaveModalTarget) window.open(leaveModalTarget, '_blank');
      leaveModal.classList.remove('active');
    });
    leaveModal?.addEventListener('click', e => { if (e.target === leaveModal) leaveModal.classList.remove('active'); });
  }

  /* ====================================================================
     7. LIGHTBOX
     ==================================================================== */
  function setupLightbox() {
    document.getElementById('lightbox-close')?.addEventListener('click', closeLightbox);
    lightboxEl?.addEventListener('click', e => { if (e.target === lightboxEl) closeLightbox(); });
  }
  function openLightbox(url, caption) {
    const img = document.getElementById('lightbox-img');
    const cap = document.getElementById('lightbox-caption');
    if (img) img.src = url;
    if (cap) cap.textContent = caption || '';
    lightboxEl.classList.add('active');
  }
  function closeLightbox() { lightboxEl.classList.remove('active'); }

  /* ====================================================================
     8. FLOATING EDIT BUTTON
     ==================================================================== */
  function setupFloatingEditBtn() {
    floatingEditBtn?.addEventListener('click', () => {
      isWidgetEditMode ? exitWidgetEditMode() : enterWidgetEditMode();
    });
  }
  function updateFloatingEditBtn() {
    if (!floatingEditBtn) return;
    if (isLoggedIn && activeTab !== 'admin' && localStorage.getItem('ee_admin_visible') === 'true') {
      floatingEditBtn.style.display = 'flex';
      if (isWidgetEditMode) {
        floatingEditBtn.classList.add('active');
        floatingEditBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i><span>Save &amp; Exit Edit</span>';
      } else {
        floatingEditBtn.classList.remove('active');
        floatingEditBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i><span>Edit Page</span>';
      }
    } else {
      floatingEditBtn.style.display = 'none';
    }
  }
  function enterWidgetEditMode() {
    if (activeTab === 'admin') return;
    isWidgetEditMode = true;
    renderActiveTab();
    updateFloatingEditBtn();
    showToast('Edit mode active. Use controls to edit entries.');
  }
  function exitWidgetEditMode() {
    isWidgetEditMode = false;
    renderActiveTab();
    updateFloatingEditBtn();
  }

  /* ====================================================================
     9. INLINE EDIT MODAL (structural views)
     ==================================================================== */
  function setupInlineEditModal() {
    document.getElementById('inline-edit-close')?.addEventListener('click', closeInlineEditModal);
    document.getElementById('inline-edit-cancel')?.addEventListener('click', closeInlineEditModal);
    document.getElementById('inline-edit-save')?.addEventListener('click', () => {
      if (inlineEditCallback) inlineEditCallback();
      closeInlineEditModal();
    });
    inlineEditModal?.addEventListener('click', e => { if (e.target === inlineEditModal) closeInlineEditModal(); });
  }
  function openInlineEditModal(title, bodyHtml, onSave) {
    document.getElementById('inline-edit-title').textContent = title;
    document.getElementById('inline-edit-body').innerHTML = bodyHtml;
    inlineEditCallback = onSave;
    inlineEditModal.classList.add('active');
  }
  function closeInlineEditModal() {
    inlineEditModal.classList.remove('active');
    inlineEditCallback = null;
  }

  /* ====================================================================
     10. DATABASE CONTROLLER
     ==================================================================== */
// ====================================================================
// 10. DATABASE CONTROLLER
// ====================================================================
async function loadDatabase() {
  // Load static XML database from repository
  try {
    const res = await fetch(`database.xml?ts=${Date.now()}`);
    if (!res.ok) throw new Error('Failed to load database.xml');
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    if (doc.querySelector('parsererror')) throw new Error('XML parse error');
    localStorage.setItem('ee_xml_database', text);
    return doc;
  } catch (e) {
    console.error('Database load failed:', e);
    return generateFallbackXML();
  }
}

// Authentication is now handled via the admin panel UI; Netlify Identity removed.
  function saveDatabase() {
    if (!xmlDatabase) return;
    localStorage.setItem('ee_xml_database', new XMLSerializer().serializeToString(xmlDatabase));
    showToast('Database saved.');
  }
  function resetDatabase() {
    if (confirm('Restore all data to default? Custom changes will be lost.')) {
      localStorage.removeItem('ee_xml_database'); window.location.reload();
    }
  }

  /* ====================================================================
     11. GITHUB PUBLISH
     ==================================================================== */
  async function publishToGitHub(pat, repo, branch) {
    try {
      const xmlStr = formatXml(new XMLSerializer().serializeToString(xmlDatabase));
      const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/database.xml`, {
        headers: { 'Authorization': `token ${pat}`, 'Accept': 'application/vnd.github.v3+json' }
      });
      const fileData = await getRes.json();
      const sha = fileData.sha;
      const content = btoa(unescape(encodeURIComponent(xmlStr)));
      const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/database.xml`, {
        method: 'PUT',
        headers: { 'Authorization': `token ${pat}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' },
        body: JSON.stringify({ message: `[EE Wiki] Auto-sync ${new Date().toISOString()}`, content, sha, branch })
      });
      if (putRes.ok) {
        showToast('Published to GitHub! Netlify redeploys in ~10s.');
        // Trigger automated status checks to trace the deployment progress
        [4000, 10000, 20000, 30000].forEach(delay => setTimeout(checkGitHubDeploymentStatus, delay));
      }
      else { const err = await putRes.json(); throw new Error(err.message); }
    } catch(err) { alert('GitHub Publish Failed: ' + err.message); }
  }

  async function checkGitHubDeploymentStatus() {
    const pat = document.getElementById('gh-pat')?.value || localStorage.getItem('ee_github_pat');
    const repo = document.getElementById('gh-repo')?.value || localStorage.getItem('ee_github_repo');
    const branch = document.getElementById('gh-branch')?.value || localStorage.getItem('ee_github_branch') || 'main';
    const netlifySiteId = document.getElementById('netlify-site-id')?.value || localStorage.getItem('ee_netlify_site_id') || '6fc44b2e-5a7c-4ba4-a7d8-f904bc099ffc';

    const container = document.getElementById('gh-status-container');
    const badge = document.getElementById('gh-status-badge');
    const details = document.getElementById('gh-status-details');
    if (!container || !badge || !details) return;

    container.style.display = 'block';
    badge.textContent = 'Checking…';
    badge.className = 'role-badge';
    badge.style.background = '#6b728022';
    badge.style.color = '#9ca3af';
    badge.style.borderColor = '#6b728055';

    let badgeHtml = '';
    if (netlifySiteId) {
      badgeHtml = `<div style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--border-color);"><strong style="display:block;margin-bottom:6px;font-size:10px;text-transform:uppercase;color:var(--accent);">Live Netlify Deployment:</strong><a href="https://elemental-empire.netlify.app/" target="_blank"><img src="https://api.netlify.com/api/v1/badges/${netlifySiteId}/deploy-status?r=${Math.random()}" alt="Netlify Deploy Status" style="display:block;max-width:120px;height:auto;"></a></div>`;
    }

    if (!pat || !repo) {
      badge.textContent = 'NETLIFY';
      badge.style.background = '#38bdf822';
      badge.style.color = '#38bdf8';
      badge.style.borderColor = '#38bdf855';
      details.innerHTML = `<strong>Netlify URL</strong>: <a href="https://elemental-empire.netlify.app/" target="_blank" style="color:var(--accent);text-decoration:underline;">https://elemental-empire.netlify.app/</a><br><strong>Status Check</strong>: GitHub Sync settings not configured.${badgeHtml}`;
      return;
    }

    try {
      // Query the combined commit status API which captures Netlify, Vercel, and GitHub Actions builds
      const res = await fetch(`https://api.github.com/repos/${repo}/commits/${branch}/status`, {
        headers: { 'Authorization': `token ${pat}`, 'Accept': 'application/vnd.github.v3+json' }
      });
      if (!res.ok) {
        throw new Error(`API returned status ${res.status}`);
      }
      const data = await res.json();
      
      // Look for a Netlify status check
      const netlifyStatus = data.statuses?.find(s => s.context && s.context.toLowerCase().includes('netlify'));
      
      const status = netlifyStatus ? netlifyStatus.state : data.state;
      const desc = netlifyStatus ? netlifyStatus.description : (data.statuses && data.statuses.length ? 'Combined repository status checks' : 'No deployments registered on GitHub yet.');

      badge.textContent = (status === 'success' ? 'Live' : status).toUpperCase();
      
      details.innerHTML = `<strong>Netlify URL</strong>: <a href="https://elemental-empire.netlify.app/" target="_blank" style="color:var(--accent);text-decoration:underline;">https://elemental-empire.netlify.app/</a><br><strong>Status Check</strong>: ${desc}${badgeHtml}`;

      if (status === 'success') {
        badge.style.background = '#10b98122';
        badge.style.color = '#10b981';
        badge.style.borderColor = '#10b98155';
      } else if (status === 'pending') {
        badge.style.background = '#f59e0b22';
        badge.style.color = '#f59e0b';
        badge.style.borderColor = '#f59e0b55';
      } else {
        badge.style.background = '#ef444422';
        badge.style.color = '#ef4444';
        badge.style.borderColor = '#ef444455';
      }
    } catch (err) {
      badge.textContent = 'Error';
      badge.style.background = '#ef444422';
      badge.style.color = '#ef4444';
      badge.style.borderColor = '#ef444455';
      details.innerHTML = `Could not fetch status: ${err.message}. Make sure your token (PAT) and repository name are correct.${badgeHtml}`;
    }
  }

  /* ====================================================================
     12. META INFO & LOCKDOWN
     ==================================================================== */
  function updateMetaInfo() {
    if (!xmlDatabase) return;
    const meta = xmlDatabase.querySelector('meta');
    if (!meta) return;
    if (statMembers) statMembers.textContent = meta.querySelector('members')?.textContent || '1,200+';
    if (statFounded) statFounded.textContent = meta.querySelector('founded')?.textContent || 'May 5, 2023';
    if (statEra)     statEra.textContent     = meta.querySelector('era')?.textContent     || 'Triumvirate Era';
    const disc = meta.querySelector('discord')?.textContent;
    const yt   = meta.querySelector('youtube')?.textContent;
    if (metaDiscordEl && disc) metaDiscordEl.href = disc;
    if (metaYoutubeEl && yt)   metaYoutubeEl.href = yt;
    applyLockdownState(meta.querySelector('lockdown_status')?.textContent || 'green', false);

    const security = meta.querySelector('security');
    if (security) {
      rootPassword     = security.querySelector('root_password')?.textContent     || 'Prachet@131';
      standardPassword = security.querySelector('standard_password')?.textContent || 'Admin@EE';
      usersList = [];
      security.querySelectorAll('users user').forEach(u => {
        usersList.push({
          username: u.querySelector('username')?.textContent || '',
          password: u.querySelector('password')?.textContent || '',
          role:     u.querySelector('role')?.textContent     || 'standard'
        });
      });
      if (!usersList.length) {
        usersList = [
          { username: 'admin', password: rootPassword, role: 'root' },
          { username: 'standard', password: standardPassword, role: 'standard' }
        ];
      }
    }
  }

  function applyLockdownState(state, save = false) {
    currentLockdownState = state || 'green';
    document.body.classList.remove('lockdown-green','lockdown-yellow','lockdown-red');
    document.body.classList.add(`lockdown-${currentLockdownState}`);
    const statSec = document.getElementById('stat-security');
    const noticeEl = document.getElementById('archival-notice-el');
    if (statSec) {
      statSec.className = 'stat-value';
      const map = { green:['Code Green','text-glow-green'], yellow:['Code Yellow','text-glow-yellow'], red:['Code Red','text-glow-red'] };
      const [txt, cls] = map[currentLockdownState] || map.green;
      statSec.textContent = txt; statSec.classList.add(cls);
    }
    if (noticeEl) {
      const icons = { green:'<i class="fa-solid fa-circle-check"></i>', yellow:'<i class="fa-solid fa-triangle-exclamation"></i>', red:'<i class="fa-solid fa-radiation"></i>' };
      const texts = { green:'System online • Code Green', yellow:'Caution active • Code Yellow', red:'LOCKDOWN ACTIVE • CODE RED' };
      const cls   = { green:'text-glow-green', yellow:'text-glow-yellow', red:'text-glow-red' };
      noticeEl.innerHTML = `<span class="${cls[currentLockdownState]}">${icons[currentLockdownState]} ${texts[currentLockdownState]}</span>`;
    }
    renderThreatAlertBanner();
    if (save && xmlDatabase) {
      setXmlField(xmlDatabase.querySelector('meta'), 'lockdown_status', currentLockdownState);
      saveDatabase();
    }
  }

  function renderThreatAlertBanner() {
    document.querySelector('.threat-alert-banner')?.remove();
    if (currentLockdownState === 'green') return;
    const wikiPage = document.querySelector('.wiki-page');
    if (!wikiPage) return;
    const banner = document.createElement('div');
    if (currentLockdownState === 'yellow') {
      banner.className = 'threat-alert-banner yellow-alert';
      banner.innerHTML = '<i class="fa-solid fa-triangle-exclamation threat-icon"></i><div class="threat-message"><h4>DEFENSIVE ALERT: CODE YELLOW</h4><p>Coordination restricted. Verification required for visitors.</p></div>';
    } else {
      banner.className = 'threat-alert-banner red-alert';
      banner.innerHTML = '<i class="fa-solid fa-radiation threat-icon"></i><div class="threat-message"><h4>EMERGENCY: CODE RED PROTOCOL</h4><p>All bases classified. Citizens retreat to fallback positions immediately.</p></div>';
    }
    wikiPage.insertBefore(banner, wikiPage.firstChild);
  }

  /* ====================================================================
     13. NAVIGATION
     ==================================================================== */
  function setupNavigation() {
    const navContainer = document.getElementById('sidebar-nav-links');
    if (!navContainer || !xmlDatabase) return;
    navContainer.innerHTML = '';
    const pages = Array.from(xmlDatabase.querySelectorAll('pages page'));

    function makeLink(id, label, icon, isAdmin = false, extraClass = '') {
      const li = document.createElement('li');
      const a  = document.createElement('a');
      a.href = '#';
      a.className = `nav-link ${activeTab === id ? 'active' : ''} ${isAdmin ? 'admin-nav-link' : ''} ${extraClass}`.trim();
      a.setAttribute('data-tab', id);
      const iEl  = isAdmin ? `<i class="${icon} text-glow-orange"></i>` : `<i class="${icon}"></i>`;
      const lEl  = isAdmin ? `<span class="text-glow-orange font-bold">${label}</span>` : `<span>${label}</span>`;
      a.innerHTML = iEl + lEl;
      a.addEventListener('click', e => {
        e.preventDefault();
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        a.classList.add('active');
        activeTab = id;
        sidebar?.classList.remove('show');
        isWidgetEditMode = false;
        renderActiveTab();
        updateFloatingEditBtn();
      });
      li.appendChild(a);

      // Sub-pages
      const subs = pages.filter(p => p.getAttribute('parent') === id);
      if (subs.length > 0) {
        const subUl = document.createElement('ul');
        subUl.className = 'nav-sub-list';
        subs.forEach(sp => {
          const spId    = sp.getAttribute('id');
          const spTitle = sp.querySelector('title')?.textContent || spId;
          const spIcon  = sp.getAttribute('icon') || 'fa-solid fa-file-lines';
          subUl.appendChild(makeLink(spId, spTitle, spIcon, false, 'nav-sub-link'));
        });
        li.appendChild(subUl);
      }
      return li;
    }

    const coreIds = ['home','history','allies','protocols'];
    const structIds = ['timeline','leaders','bases','wars','players'];

    const addCore = (id, label, icon) => {
      const page = pages.find(p => p.getAttribute('id') === id);
      navContainer.appendChild(makeLink(id, label, page?.getAttribute('icon') || icon));
    };

    addCore('home',      'Home Overview',      'fa-solid fa-house-chimney');
    addCore('history',   'Empire History',     'fa-solid fa-book-bookmark');
    navContainer.appendChild(makeLink('timeline', 'Chronology Timeline', 'fa-solid fa-timeline'));
    navContainer.appendChild(makeLink('leaders',  'Sovereign Authority', 'fa-solid fa-user-shield'));
    navContainer.appendChild(makeLink('bases',    'Strongholds',         'fa-solid fa-fort-awesome'));
    navContainer.appendChild(makeLink('wars',     'Wars & Campaigns',    'fa-solid fa-shield-halved'));
    addCore('allies',    'Allies & Diplomacy', 'fa-solid fa-handshake');
    addCore('protocols', 'Laws & Protocols',   'fa-solid fa-scale-balanced');
    navContainer.appendChild(makeLink('players',  'Player Database',     'fa-solid fa-users'));

    // Custom pages (no parent, not core/structural)
    pages.forEach(p => {
      const id = p.getAttribute('id'); const parent = p.getAttribute('parent');
      if (!coreIds.includes(id) && !structIds.includes(id) && !parent) {
        navContainer.appendChild(makeLink(id, p.querySelector('title')?.textContent || id, p.getAttribute('icon') || 'fa-solid fa-file-lines'));
      }
    });

    if (localStorage.getItem('ee_admin_visible') === 'true') {
      const sep = document.createElement('li'); sep.className = 'nav-separator';
      navContainer.appendChild(sep);
      navContainer.appendChild(makeLink('admin', 'Admin Console', 'fa-solid fa-gears', true));
    }
  }

  /* ====================================================================
     14. VIEW ROUTER
     ==================================================================== */
  function renderActiveTab() {
    if (!xmlDatabase) return;
    if (activeTab === 'admin' && localStorage.getItem('ee_admin_visible') !== 'true') {
      activeTab = 'home';
      setupNavigation();
    }
    contentViewport.scrollTop = 0;

    const structuralViews = { home: renderHomeView, timeline: renderTimelineView, leaders: renderLeadersView, bases: renderBasesView, wars: renderWarsView, allies: renderAlliesView, protocols: renderProtocolsView, history: renderHistoryView, players: renderPlayersView, admin: renderAdminView };

    if (structuralViews[activeTab]) {
      structuralViews[activeTab]();
    } else if (xmlDatabase.querySelector(`page[id="${activeTab}"]`)) {
      renderCustomPageView(activeTab);
    } else {
      renderHomeView();
    }

    renderThreatAlertBanner();
    updateFloatingEditBtn();
  }

  /* ====================================================================
     15. STRUCTURAL VIEW RENDERERS
     ==================================================================== */

  // ---- HOME ----
  function renderHomeView() {
    viewTitle.textContent = 'Empire Archives';
    viewSubtitle.textContent = 'Chronicles and records of the Elemental Empire';
    const page = xmlDatabase.querySelector('page[id="home"]');
    const title = page?.querySelector('title')?.textContent || 'Welcome to the Elemental Empire';
    const subtitle = page?.querySelector('subtitle')?.textContent || '"Loyalty Before Power"';
    const content = page?.querySelector('content')?.textContent || '<p>Loading chronicles...</p>';
    const widgetsNode = page?.querySelector('widgets');
    const body = (widgetsNode?.querySelectorAll('widget').length > 0) ? renderWidgetsLayout(widgetsNode) : content;

    contentViewport.innerHTML = `
      <div class="wiki-page">
        <div class="welcome-banner"><h1>${title}</h1><p class="tagline">${subtitle}</p></div>
        <div class="wiki-content">${body}</div>
        ${isWidgetEditMode && adminRole === 'root' ? '<div class="add-entry-bar"><p style="color:var(--text-muted); font-size:12px;">Use Admin Console → Page Builder to edit the Home page widgets.</p></div>' : ''}
      </div>`;
    bindGalleryLightbox();
    bindWikiLinks();
  }

  // ---- TIMELINE ----
  function renderTimelineView() {
    viewTitle.textContent = 'Chronological Timeline';
    viewSubtitle.textContent = 'Complete history log and structural eras of the Empire';
    const events = Array.from(xmlDatabase.querySelectorAll('timeline event'));
    const filtered = events.filter(ev => activeTimelineFilter === 'all' || (ev.querySelector('era')?.textContent||'').toLowerCase() === activeTimelineFilter.toLowerCase());

    let html = `<div class="wiki-page">
      <div class="timeline-header">
        <h3 class="card-section-title" style="margin-bottom:0;">Empire Timeline Records</h3>
        <div class="timeline-filters">
          ${['all','Founding','Expansion','Wars','NewEra'].map(f =>
            `<button class="filter-btn ${activeTimelineFilter===f?'active':''}" data-filter="${f}">${f==='all'?'All':f==='NewEra'?'New Era':f}</button>`
          ).join('')}
        </div>
      </div>
      <div class="timeline-container">`;

    if (!filtered.length) {
      html += `<div class="timeline-node"><div class="node-card" style="text-align:center;color:var(--text-muted);">No events. Add via Admin Panel.</div></div>`;
    } else {
      filtered.forEach(ev => {
        const evIdx = events.indexOf(ev);
        html += `<div class="timeline-node" data-entry-index="${evIdx}">
          <div class="node-dot"></div>
          <div class="node-badge"><i class="fa-solid fa-calendar-days"></i><span>${ev.querySelector('date')?.textContent||'?'}</span><span style="opacity:.5;margin-left:6px;">| ${ev.querySelector('era')?.textContent||''}</span></div>
          <div class="node-card">
            <h4 class="node-title">${ev.querySelector('title')?.textContent||'Untitled'}</h4>
            <p class="node-desc">${ev.querySelector('desc')?.textContent||''}</p>
            ${isWidgetEditMode ? `<div class="entry-edit-controls" style="margin-top:10px;">
              <button class="entry-edit-btn" data-action="edit" data-index="${evIdx}" data-type="timeline"><i class="fa-solid fa-pen"></i> Edit</button>
              <button class="entry-delete-btn" data-action="delete" data-index="${evIdx}" data-type="timeline"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>` : ''}
          </div>
        </div>`;
      });
    }
    html += `</div>`;
    if (isWidgetEditMode) html += `<div class="add-entry-bar"><button class="btn btn-primary add-new-btn" data-type="timeline"><i class="fa-solid fa-plus"></i> Add Timeline Event</button></div>`;
    html += `</div>`;
    contentViewport.innerHTML = html;

    contentViewport.querySelectorAll('.filter-btn').forEach(btn => btn.addEventListener('click', () => { activeTimelineFilter = btn.getAttribute('data-filter'); renderTimelineView(); }));
    if (isWidgetEditMode) attachStructuralEditControls('timeline', events);
  }

  // ---- LEADERS ----
  function renderLeadersView() {
    viewTitle.textContent = 'Sovereign Authority';
    viewSubtitle.textContent = 'Emperors, founders, architects, and warbringers';
    const leaders = Array.from(xmlDatabase.querySelectorAll('leaders leader'));

    let html = `<div class="wiki-page"><h3 class="card-section-title" style="margin-bottom:24px;">The Empire Lineage</h3><div class="leadership-grid">`;
    leaders.forEach((leader, idx) => {
      const el = leader.querySelector('element')?.textContent || 'Fire';
      html += `<div class="leader-card card-element-${el} element-glow" data-entry-index="${idx}">
        <div class="card-header">
          <div class="card-avatar">${leader.querySelector('avatar')?.textContent||'👑'}</div>
          <div class="card-title-area"><h3>${leader.querySelector('name')?.textContent||'Leader'}</h3><span>${leader.querySelector('title')?.textContent||''}</span></div>
          <div class="element-badge">${el}</div>
        </div>
        <div class="card-body">
          <p class="stat-label" style="font-size:8px;margin-bottom:4px;">Reign Period</p>
          <p style="font-size:12px;font-weight:bold;margin-bottom:16px;">${leader.querySelector('reign')?.textContent||''}</p>
          <p class="card-section-title">Key Accomplishments</p>
          <ul class="achievements-list">${Array.from(leader.querySelectorAll('achievements achievement')).map(a=>`<li>${a.textContent}</li>`).join('')||'<li>No recorded achievements.</li>'}</ul>
          ${leader.querySelector('legacy')?.textContent ? `<div class="legacy-box">"${leader.querySelector('legacy').textContent}"</div>` : ''}
          ${isWidgetEditMode ? `<div class="entry-edit-controls" style="margin-top:12px;">
            <button class="entry-edit-btn" data-type="leader" data-index="${idx}"><i class="fa-solid fa-pen"></i> Edit</button>
            <button class="entry-delete-btn" data-type="leader" data-index="${idx}"><i class="fa-solid fa-trash"></i> Delete</button>
          </div>` : ''}
        </div>
      </div>`;
    });
    html += `</div>`;
    if (isWidgetEditMode) html += `<div class="add-entry-bar"><button class="btn btn-primary add-new-btn" data-type="leader"><i class="fa-solid fa-plus"></i> Add Leader</button></div>`;
    html += `</div>`;
    contentViewport.innerHTML = html;
    if (isWidgetEditMode) attachStructuralEditControls('leader', leaders);
  }

  // ---- BASES ----
  function renderBasesView() {
    viewTitle.textContent = 'Empire Strongholds';
    viewSubtitle.textContent = 'Historical cities, end fortresses, and capitals';
    if (currentLockdownState === 'red') {
      contentViewport.innerHTML = `<div class="wiki-page"><div class="redacted-security-block"><div class="redacted-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><h2 class="redacted-title">CLASSIFIED ARCHIVE</h2><p class="redacted-subtitle">Access restricted under CODE RED PROTOCOL.</p><div class="redacted-stamp">RED PROTOCOL ACTIVE</div></div></div>`; return;
    }
    const bases = Array.from(xmlDatabase.querySelectorAll('bases base'));
    const colors = ['Fire','Water','Earth','Air'];
    let html = `<div class="wiki-page"><h3 class="card-section-title" style="margin-bottom:24px;">Empire Defenses &amp; Cities</h3><div class="stronghold-grid">`;
    bases.forEach((base, idx) => {
      html += `<div class="stronghold-card card-element-${colors[idx%4]} element-glow" data-entry-index="${idx}">
        <div class="card-header">
          <div class="card-avatar"><i class="fa-solid fa-fort-awesome"></i></div>
          <div class="card-title-area"><h3>${base.querySelector('name')?.textContent||'Base'}</h3><span>${base.querySelector('era')?.textContent||''}</span></div>
        </div>
        <div class="card-body">
          <p class="stat-label" style="font-size:8px;margin-bottom:2px;">Location</p>
          <p style="font-size:13px;font-weight:bold;margin-bottom:14px;">${base.querySelector('location')?.textContent||''}</p>
          <p class="card-section-title">Structural Layout</p>
          <p style="font-size:12px;line-height:1.5;color:var(--text-muted);margin-bottom:14px;">${base.querySelector('features')?.textContent||''}</p>
          ${base.querySelector('legacy')?.textContent ? `<div class="legacy-box">"${base.querySelector('legacy').textContent}"</div>` : ''}
          ${isWidgetEditMode ? `<div class="entry-edit-controls" style="margin-top:12px;">
            <button class="entry-edit-btn" data-type="base" data-index="${idx}"><i class="fa-solid fa-pen"></i> Edit</button>
            <button class="entry-delete-btn" data-type="base" data-index="${idx}"><i class="fa-solid fa-trash"></i> Delete</button>
          </div>` : ''}
        </div>
      </div>`;
    });
    html += `</div>`;
    if (isWidgetEditMode) html += `<div class="add-entry-bar"><button class="btn btn-primary add-new-btn" data-type="base"><i class="fa-solid fa-plus"></i> Add Stronghold</button></div>`;
    html += `</div>`;
    contentViewport.innerHTML = html;
    if (isWidgetEditMode) attachStructuralEditControls('base', bases);
  }

  // ---- WARS ----
  function renderWarsView() {
    viewTitle.textContent = 'Wars and Campaigns';
    viewSubtitle.textContent = 'Military conflicts and Crusaders operations';
    const wars = Array.from(xmlDatabase.querySelectorAll('wars war'));
    let html = `<div class="wiki-page"><h3 class="card-section-title" style="margin-bottom:24px;">Military Archives</h3><div class="war-timeline">`;
    wars.forEach((war, idx) => {
      html += `<div class="war-card" data-entry-index="${idx}">
        <div class="war-card-header">
          <div class="war-title-group"><h3>${war.querySelector('name')?.textContent||''}</h3><p class="war-opponents">Opponent: ${war.querySelector('opponents')?.textContent||''}</p></div>
          <div class="war-date-badge">${war.querySelector('date')?.textContent||''}</div>
        </div>
        <div class="war-card-body">
          <p class="card-section-title" style="margin-bottom:10px;font-size:8px;">Key Engagements</p>
          <ul class="achievements-list" style="margin-bottom:16px;">${Array.from(war.querySelectorAll('events event')).map(ev=>`<li>${ev.textContent}</li>`).join('')||'<li>No engagements on record.</li>'}</ul>
          <div class="war-outcome-section"><i class="fa-solid fa-flag"></i><div class="war-outcome-text"><strong>Outcome:</strong> ${war.querySelector('outcome')?.textContent||''}</div></div>
          ${isWidgetEditMode ? `<div class="entry-edit-controls" style="margin-top:12px;">
            <button class="entry-edit-btn" data-type="war" data-index="${idx}"><i class="fa-solid fa-pen"></i> Edit</button>
            <button class="entry-delete-btn" data-type="war" data-index="${idx}"><i class="fa-solid fa-trash"></i> Delete</button>
          </div>` : ''}
        </div>
      </div>`;
    });
    html += `</div>`;
    if (isWidgetEditMode) html += `<div class="add-entry-bar"><button class="btn btn-primary add-new-btn" data-type="war"><i class="fa-solid fa-plus"></i> Add Campaign</button></div>`;
    html += `</div>`;
    contentViewport.innerHTML = html;
    if (isWidgetEditMode) attachStructuralEditControls('war', wars);
  }

  // ---- ALLIES / PROTOCOLS / HISTORY ----
  function renderAlliesView()    { viewTitle.textContent='Allies & Diplomacy'; viewSubtitle.textContent='Treaties, coalitions, and foreign registers'; renderCustomPageView('allies'); }
  function renderProtocolsView() { viewTitle.textContent='Senate & Laws'; viewSubtitle.textContent='Empire codes, constitution, and security protocols'; renderCustomPageView('protocols'); }
  function renderHistoryView()   { viewTitle.textContent='Empire History'; viewSubtitle.textContent='Chronicles and historical records'; renderCustomPageView('history'); }

  // ---- PLAYERS ----
  function renderPlayersView() {
    viewTitle.textContent = 'Player Database';
    viewSubtitle.textContent = 'Empire citizens, Discord roles, and profiles';
    const isRoot = isLoggedIn && adminRole === 'root';
    const players = Array.from(xmlDatabase.querySelectorAll('players player'));
    const roles   = Array.from(xmlDatabase.querySelectorAll('discord_roles role'))
      .sort((a,b) => parseInt(a.getAttribute('priority')||99) - parseInt(b.getAttribute('priority')||99));

    const getRoleBadge = (roleId) => {
      const role = roles.find(r => r.querySelector('discord_id')?.textContent === roleId);
      if (!role) return '';
      const name = role.querySelector('name')?.textContent || 'Member';
      const color = role.getAttribute('color') || '#6b7280';
      return `<span class="role-badge" style="background:${color}22;color:${color};border:1px solid ${color}55;">${name}</span>`;
    };

    let html = `<div class="wiki-page"><div class="players-header"><h3 class="card-section-title" style="margin-bottom:0;">Empire Citizens Registry</h3>${isRoot?'<button class="btn btn-primary" id="add-player-btn"><i class="fa-solid fa-user-plus"></i> Add Player</button>':''}</div>`;

    if (!players.length) {
      html += `<div class="empty-state"><i class="fa-solid fa-users-slash"></i><p>No players registered yet.${isRoot?' Use "Add Player" to register empire citizens.':''}</p></div>`;
    } else {
      html += `<div class="player-grid">`;
      players.forEach((player, idx) => {
        const discUser = player.querySelector('discord_username')?.textContent || player.querySelector('minecraft_username')?.textContent || 'Unknown';
        const roleId   = player.querySelector('highest_role_id')?.textContent || '';
        const roleName = player.querySelector('highest_role')?.textContent || 'Member';
        const notes    = player.querySelector('notes')?.textContent || '';
        
        // Generate a clean initials avatar with colored background
        const colors = ['#f59e0b', '#a855f7', '#ef4444', '#3b82f6', '#10b981', '#ec4899', '#06b6d4'];
        const colorIdx = Math.abs(discUser.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length;
        const avatarColor = colors[colorIdx];
        const initial = (discUser[0] || 'U').toUpperCase();

        html += `<div class="player-card" data-entry-index="${idx}">
          <div class="player-card-top">
            <div class="player-skin-placeholder" style="display:flex; background:${avatarColor}; color:#ffffff; font-weight:bold; font-size:24px; align-items:center; justify-content:center; width:52px; height:52px; border-radius:50%; border:2px solid rgba(255,255,255,0.1); margin-right:16px; flex-shrink:0;">
              ${initial}
            </div>
            <div class="player-info">
              <div class="player-name">${escHtml(discUser)}</div>
              ${getRoleBadge(roleId) || `<span class="role-badge" style="background:#6b728022;color:#9ca3af;border:1px solid #6b728055;">${roleName}</span>`}
            </div>
          </div>
          ${notes ? `<p class="player-notes">${notes}</p>` : ''}
          ${isRoot ? `<div class="entry-edit-controls" style="margin-top:10px;">
            <button class="entry-edit-btn" data-type="player" data-index="${idx}"><i class="fa-solid fa-pen"></i> Edit</button>
            <button class="entry-delete-btn" data-type="player" data-index="${idx}"><i class="fa-solid fa-trash"></i> Delete</button>
          </div>` : ''}
        </div>`;
      });
      html += `</div>`;
    }
    html += `</div>`;
    contentViewport.innerHTML = html;

    document.getElementById('add-player-btn')?.addEventListener('click', () => openPlayerForm(null, -1, players));
    contentViewport.querySelectorAll('.entry-edit-btn[data-type="player"]').forEach(btn => {
      btn.addEventListener('click', () => openPlayerForm(players[+btn.getAttribute('data-index')], +btn.getAttribute('data-index'), players));
    });
    contentViewport.querySelectorAll('.entry-delete-btn[data-type="player"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = +btn.getAttribute('data-index');
        const dName = players[idx]?.querySelector('discord_username')?.textContent || players[idx]?.querySelector('minecraft_username')?.textContent || 'User';
        if (confirm(`Delete "${dName}"?`)) { players[idx].remove(); saveDatabase(); renderPlayersView(); }
      });
    });
  }

  function openPlayerForm(playerNode, idx, players) {
    const dUser = playerNode?.querySelector('discord_username')?.textContent || playerNode?.querySelector('minecraft_username')?.textContent || '';
    const discId= playerNode?.querySelector('discord_id')?.textContent || '';
    const rId   = playerNode?.querySelector('highest_role_id')?.textContent || '';
    const notes = playerNode?.querySelector('notes')?.textContent || '';
    const roles = Array.from(xmlDatabase.querySelectorAll('discord_roles role'))
      .sort((a,b) => parseInt(a.getAttribute('priority')||99)-parseInt(b.getAttribute('priority')||99));
    const roleOpts = roles.map(r => {
      const id = r.querySelector('discord_id')?.textContent || '';
      const nm = r.querySelector('name')?.textContent || '';
      return `<option value="${id}" ${rId===id?'selected':''}>${nm}</option>`;
    }).join('');
    openInlineEditModal(idx===-1?'Add New Player':'Edit Player', `
      <div class="form-group"><label>Discord Username</label>
        <input type="text" class="form-control" id="ief-duser" value="${escHtml(dUser)}" placeholder="Steve">
      </div>
      <div class="form-row">
        <div class="form-group"><label>Discord User ID</label><input type="text" class="form-control" id="ief-discid" value="${escHtml(discId)}" placeholder="123456789012345678"></div>
        <div class="form-group"><label>Highest Discord Role</label><select class="form-control" id="ief-roleid"><option value="">-- Select --</option>${roleOpts}</select></div>
      </div>
      <div class="form-group"><label>Admin Notes</label><textarea class="form-control" id="ief-notes">${escHtml(notes)}</textarea></div>
    `, () => {
      const newDUser = document.getElementById('ief-duser').value.trim();
      const newDisc  = document.getElementById('ief-discid').value.trim();
      const newRoleId= document.getElementById('ief-roleid').value;
      const newNotes = document.getElementById('ief-notes').value;
      let roleName = '';
      xmlDatabase.querySelectorAll('discord_roles role').forEach(r => { if (r.querySelector('discord_id')?.textContent===newRoleId) roleName=r.querySelector('name')?.textContent||''; });

      let pContainer = xmlDatabase.querySelector('players');
      if (!pContainer) { pContainer=xmlDatabase.createElement('players'); xmlDatabase.querySelector('elemental_empire').appendChild(pContainer); }
      let node = playerNode;
      if (!node || idx===-1) { node=xmlDatabase.createElement('player'); node.setAttribute('id', newDisc || `player_${Date.now()}`); pContainer.appendChild(node); }
      
      const mcUserNode = node.querySelector('minecraft_username');
      if (mcUserNode) mcUserNode.remove();

      ['discord_username','discord_id','highest_role_id','highest_role','notes'].forEach((tag,i) => setXmlField(node,tag,[newDUser,newDisc,newRoleId,roleName,newNotes][i]));
      saveDatabase(); renderPlayersView(); showToast(`Player "${newDUser}" saved.`);
    });
  }

  // ---- CUSTOM PAGE ----
  function renderCustomPageView(pageId) {
    const page = xmlDatabase.querySelector(`page[id="${pageId}"]`);
    if (!page) { renderHomeView(); return; }
    const title    = page.querySelector('title')?.textContent || 'Page';
    const subtitle = page.querySelector('subtitle')?.textContent || '';
    viewTitle.textContent   = title;
    viewSubtitle.textContent = subtitle;

    const css = page.querySelector('custom_css')?.textContent || '';
    document.getElementById('custom-page-style')?.remove();
    if (css) {
      const s = Object.assign(document.createElement('style'),{id:'custom-page-style',textContent:css});
      document.head.appendChild(s);
    }

    const widgetsNode = page.querySelector('widgets');
    const hasWidgets  = widgetsNode?.querySelectorAll('widget').length > 0;
    const body = hasWidgets ? renderWidgetsLayout(widgetsNode) : (page.querySelector('content')?.textContent||'');
    contentViewport.innerHTML = `<div class="wiki-page"><div class="wiki-content">${body}</div></div>`;
    bindGalleryLightbox(); bindWikiLinks();

    const js = page.querySelector('custom_js')?.textContent||'';
    if (js) { try { setTimeout(new Function(js), 100); } catch(e){ console.error('Page JS error:',e); } }

    if (isWidgetEditMode) {
      currentEditingWidgets = [];
      if (widgetsNode) widgetsNode.querySelectorAll('widget').forEach(w => { const wd={type:w.getAttribute('type')}; loadWidgetData(w,wd); currentEditingWidgets.push(wd); });
      renderInlineWidgetEditor(pageId);
    }
  }

  /* ====================================================================
     16. STRUCTURAL EDIT CONTROLS ENGINE
     ==================================================================== */
  function attachStructuralEditControls(type, xmlNodes) {
    contentViewport.querySelectorAll(`.entry-edit-btn[data-type="${type}"]`).forEach(btn => {
      const idx = +btn.getAttribute('data-index');
      btn.addEventListener('click', () => openStructuralEditForm(type, xmlNodes[idx], idx));
    });
    contentViewport.querySelectorAll(`.entry-delete-btn[data-type="${type}"]`).forEach(btn => {
      const idx = +btn.getAttribute('data-index');
      btn.addEventListener('click', () => {
        const name = xmlNodes[idx]?.querySelector('name,title')?.textContent||'entry';
        if (confirm(`Delete "${name}"?`)) { xmlNodes[idx].remove(); saveDatabase(); renderActiveTab(); }
      });
    });
    contentViewport.querySelector(`.add-new-btn[data-type="${type}"]`)?.addEventListener('click', () => openStructuralEditForm(type, null, -1));
  }

  function openStructuralEditForm(type, xmlNode, idx) {
    let title = '', body = '';
    if (type === 'timeline') {
      title = idx===-1?'Add Timeline Event':'Edit Timeline Event';
      body = `
        <div class="form-group"><label>Event Date</label><input type="text" class="form-control" id="ief-date" value="${escHtml(xmlNode?.querySelector('date')?.textContent||'')}"></div>
        <div class="form-row">
          <div class="form-group"><label>Era</label><select class="form-control" id="ief-era">
            ${['Founding','Expansion','Wars','NewEra'].map(e=>`<option ${(xmlNode?.querySelector('era')?.textContent||''===e)?'selected':''} value="${e}">${e}</option>`).join('')}
          </select></div>
          <div class="form-group"><label>Title</label><input type="text" class="form-control" id="ief-title" value="${escHtml(xmlNode?.querySelector('title')?.textContent||'')}"></div>
        </div>
        <div class="form-group"><label>Description</label><textarea class="form-control" id="ief-desc">${escHtml(xmlNode?.querySelector('desc')?.textContent||'')}</textarea></div>`;
    } else if (type === 'leader') {
      title = idx===-1?'Add New Leader':'Edit Leader';
      body = `
        <div class="form-row">
          <div class="form-group"><label>Username</label><input type="text" class="form-control" id="ief-name" value="${escHtml(xmlNode?.querySelector('name')?.textContent||'')}"></div>
          <div class="form-group"><label>Symbol / Emoji</label><input type="text" class="form-control" id="ief-avatar" value="${escHtml(xmlNode?.querySelector('avatar')?.textContent||'👑')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Empire Title</label><input type="text" class="form-control" id="ief-title" value="${escHtml(xmlNode?.querySelector('title')?.textContent||'')}"></div>
          <div class="form-group"><label>Reign Period</label><input type="text" class="form-control" id="ief-reign" value="${escHtml(xmlNode?.querySelector('reign')?.textContent||'')}"></div>
        </div>
        <div class="form-group"><label>Element</label><select class="form-control" id="ief-element">
          ${['Fire','Water','Earth','Air'].map(e=>`<option ${(xmlNode?.querySelector('element')?.textContent||''===e)?'selected':''} value="${e}">${e}</option>`).join('')}
        </select></div>
        <div class="form-group"><label>Achievements (one per line)</label><textarea class="form-control" id="ief-achievements">${escHtml(Array.from(xmlNode?.querySelectorAll('achievements achievement')||[]).map(a=>a.textContent).join('\n'))}</textarea></div>
        <div class="form-group"><label>Legacy Quote</label><input type="text" class="form-control" id="ief-legacy" value="${escHtml(xmlNode?.querySelector('legacy')?.textContent||'')}"></div>`;
    } else if (type === 'base') {
      title = idx===-1?'Add New Stronghold':'Edit Stronghold';
      body = `
        <div class="form-row">
          <div class="form-group"><label>Name</label><input type="text" class="form-control" id="ief-name" value="${escHtml(xmlNode?.querySelector('name')?.textContent||'')}"></div>
          <div class="form-group"><label>Era</label><input type="text" class="form-control" id="ief-era" value="${escHtml(xmlNode?.querySelector('era')?.textContent||'')}"></div>
        </div>
        <div class="form-group"><label>Location / Warp</label><input type="text" class="form-control" id="ief-location" value="${escHtml(xmlNode?.querySelector('location')?.textContent||'')}"></div>
        <div class="form-group"><label>Features</label><textarea class="form-control" id="ief-features">${escHtml(xmlNode?.querySelector('features')?.textContent||'')}</textarea></div>
        <div class="form-group"><label>Legacy</label><input type="text" class="form-control" id="ief-legacy" value="${escHtml(xmlNode?.querySelector('legacy')?.textContent||'')}"></div>`;
    } else if (type === 'war') {
      title = idx===-1?'Add New Campaign':'Edit Campaign';
      body = `
        <div class="form-row">
          <div class="form-group"><label>Campaign Name</label><input type="text" class="form-control" id="ief-name" value="${escHtml(xmlNode?.querySelector('name')?.textContent||'')}"></div>
          <div class="form-group"><label>Date</label><input type="text" class="form-control" id="ief-date" value="${escHtml(xmlNode?.querySelector('date')?.textContent||'')}"></div>
        </div>
        <div class="form-group"><label>Opponents</label><input type="text" class="form-control" id="ief-opponents" value="${escHtml(xmlNode?.querySelector('opponents')?.textContent||'')}"></div>
        <div class="form-group"><label>Key Engagements (one per line)</label><textarea class="form-control" id="ief-events">${escHtml(Array.from(xmlNode?.querySelectorAll('events event')||[]).map(e=>e.textContent).join('\n'))}</textarea></div>
        <div class="form-group"><label>Outcome</label><textarea class="form-control" id="ief-outcome">${escHtml(xmlNode?.querySelector('outcome')?.textContent||'')}</textarea></div>`;
    }

    openInlineEditModal(title, body, () => {
      const g = id => document.getElementById(id)?.value || '';
      if (type === 'timeline') {
        let node = xmlNode || (() => { const n=xmlDatabase.createElement('event'); xmlDatabase.querySelector('timeline').appendChild(n); return n; })();
        ['date','era','title','desc'].forEach(f => setXmlField(node, f, g('ief-'+f)));
      } else if (type === 'leader') {
        let node = xmlNode || (() => { const n=xmlDatabase.createElement('leader'); n.setAttribute('id',g('ief-name').toLowerCase().replace(/[^a-z0-9]/g,'')); xmlDatabase.querySelector('leaders').appendChild(n); return n; })();
        ['name','title','reign','element','avatar','legacy'].forEach(f => setXmlField(node, f, g('ief-'+f)));
        let achNode = node.querySelector('achievements') || (() => { const n=xmlDatabase.createElement('achievements'); node.appendChild(n); return n; })();
        achNode.innerHTML = '';
        g('ief-achievements').split('\n').filter(a=>a.trim()).forEach(a => { const el=xmlDatabase.createElement('achievement'); el.textContent=a.trim(); achNode.appendChild(el); });
      } else if (type === 'base') {
        let node = xmlNode || (() => { const n=xmlDatabase.createElement('base'); n.setAttribute('id',g('ief-name').toLowerCase().replace(/[^a-z0-9]/g,'')); xmlDatabase.querySelector('bases').appendChild(n); return n; })();
        ['name','era','location','features','legacy'].forEach(f => setXmlField(node, f, g('ief-'+f)));
      } else if (type === 'war') {
        let node = xmlNode || (() => { const n=xmlDatabase.createElement('war'); n.setAttribute('id',g('ief-name').toLowerCase().replace(/[^a-z0-9]/g,'')); xmlDatabase.querySelector('wars').appendChild(n); return n; })();
        ['name','date','opponents','outcome'].forEach(f => setXmlField(node, f, g('ief-'+f)));
        let evNode = node.querySelector('events') || (() => { const n=xmlDatabase.createElement('events'); node.appendChild(n); return n; })();
        evNode.innerHTML = '';
        g('ief-events').split('\n').filter(e=>e.trim()).forEach(e => { const el=xmlDatabase.createElement('event'); el.textContent=e.trim(); evNode.appendChild(el); });
      }
      saveDatabase(); renderActiveTab(); showToast('Changes saved!');
    });
  }

  /* ====================================================================
     17. INLINE WIDGET EDITOR (custom pages)
     ==================================================================== */
  function renderInlineWidgetEditor(pageId) {
    const wikiContent = contentViewport.querySelector('.wiki-content');
    if (!wikiContent) return;
    wikiContent.innerHTML = `
      <div class="inline-widget-editor">
        <div class="iwe-toolbar">
          <span class="iwe-toolbar-label"><i class="fa-solid fa-cubes"></i> Visual Page Editor — ${pageId}</span>
          <div class="iwe-toolbar-actions">
            <button type="button" class="btn" id="iwe-toggle-shelf"><i class="fa-solid fa-plus"></i> Add Widget</button>
            <button type="button" class="btn btn-primary" id="iwe-save"><i class="fa-solid fa-floppy-disk"></i> Save</button>
            <button type="button" class="btn btn-danger" id="iwe-cancel"><i class="fa-solid fa-times"></i> Cancel</button>
          </div>
        </div>
        <div class="iwe-add-widget-panel" id="iwe-shelf" style="display:none;">
          <div class="shelf-items">
            ${[['heading','fa-heading','Heading'],['text','fa-align-left','WikiText'],['stats','fa-chart-simple','Stats Grid'],['discord','fa-brands fa-discord','Discord'],['youtube','fa-brands fa-youtube','YouTube'],['media','fa-photo-film','Image'],['gallery_images','fa-images','Image Gallery'],['gallery_videos','fa-film','Video Gallery'],['table','fa-table','Table'],['leaders_embed','fa-users-viewfinder','Leaders Embed'],['html','fa-code','Raw HTML'],['divider','fa-minus','Divider']].map(([t,i,l])=>`<button type="button" class="shelf-item iwe-add-btn" data-type="${t}"><i class="fa-solid ${i}"></i> ${l}</button>`).join('')}
          </div>
        </div>
        <div class="iwe-canvas" id="iwe-canvas"></div>
      </div>`;
    renderIweCards(pageId);
    setupIweListeners(pageId);
  }

  function renderIweCards(pageId) {
    const canvas = document.getElementById('iwe-canvas');
    if (!canvas) return;
    if (!currentEditingWidgets.length) { canvas.innerHTML = '<div class="canvas-empty-state"><i class="fa-solid fa-cubes"></i><p>No widgets. Click "Add Widget" above.</p></div>'; return; }
    canvas.innerHTML = '';
    currentEditingWidgets.forEach((w, i) => {
      const card = document.createElement('div');
      card.className = 'widget-card iwe-widget-card'; card.setAttribute('data-index', i); card.draggable = true;
      card.innerHTML = `<div class="widget-card-header"><div class="widget-title-area"><i class="fa-solid fa-grip-vertical iwe-drag-handle"></i><span>${w.type} widget</span></div><div class="widget-actions"><button type="button" class="widget-btn btn-up" title="Up"><i class="fa-solid fa-arrow-up"></i></button><button type="button" class="widget-btn btn-down" title="Down"><i class="fa-solid fa-arrow-down"></i></button><button type="button" class="widget-btn btn-delete" title="Delete"><i class="fa-solid fa-trash"></i></button></div></div><div class="widget-card-body">${buildIweWidgetBody(w)}</div>`;
      card.querySelector('.btn-up').onclick    = () => { readIweState(); if (i>0) { [currentEditingWidgets[i],currentEditingWidgets[i-1]]=[currentEditingWidgets[i-1],currentEditingWidgets[i]]; renderIweCards(pageId); } };
      card.querySelector('.btn-down').onclick  = () => { readIweState(); if (i<currentEditingWidgets.length-1) { [currentEditingWidgets[i],currentEditingWidgets[i+1]]=[currentEditingWidgets[i+1],currentEditingWidgets[i]]; renderIweCards(pageId); } };
      card.querySelector('.btn-delete').onclick= () => { if (confirm('Delete widget?')) { readIweState(); currentEditingWidgets.splice(i,1); renderIweCards(pageId); } };
      card.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', i); card.classList.add('dragging'); });
      card.addEventListener('dragend',   () => card.classList.remove('dragging'));
      card.addEventListener('dragover',  e => { e.preventDefault(); card.classList.add('drag-over'); });
      card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
      card.addEventListener('drop', e => { e.preventDefault(); card.classList.remove('drag-over'); const from=+e.dataTransfer.getData('text/plain'); if (from!==i){ readIweState(); const m=currentEditingWidgets.splice(from,1)[0]; currentEditingWidgets.splice(i,0,m); renderIweCards(pageId); } });
      canvas.appendChild(card);
    });
  }

  function buildIweWidgetBody(w) {
    const fg = (f,v,ph='') => `<div class="form-group" style="margin-bottom:0;"><label>${f}</label><input type="text" class="form-control widget-input" data-field="${v.split(':')[0]}" value="${escHtml(w[v.split(':')[1]||v.split(':')[0]]||'')}" placeholder="${ph}"></div>`;
    const ta = (f,field,ph='',h=80) => `<div class="form-group" style="margin-bottom:0;"><label>${f}</label><textarea class="form-control widget-input" data-field="${field}" style="height:${h}px;" placeholder="${ph}">${escHtml((()=>{if(field==='items')return(w.items||[]).map(item=>`${item.url}|${item.caption||''}`).join('\n');if(field==='stats')return(w.stats||[]).map(s=>`${s.value}|${s.label}`).join('\n');if(field==='table'){const h=(w.headers||[]).join('|');const r=(w.rows||[]).map(row=>row.join('|')).join('\n');return h+(r?'\n'+r:'');}return w[field]||'';})())}</textarea></div>`;
    switch(w.type) {
      case 'heading':  return `<div class="form-row" style="margin-bottom:0;">${fg('Heading Text','text:text','Section Title')}<div class="form-group" style="width:90px;margin-bottom:0;"><label>Size</label><select class="form-control widget-input" data-field="size">${['h2','h3','h4'].map(s=>`<option value="${s}" ${w.size===s?'selected':''}>${s.toUpperCase()}</option>`).join('')}</select></div></div>`;
      case 'text':     return ta('WikiText (bold, italic, [[links]])', 'content', "'''bold''' ''italic'' [[page|label]]");
      case 'stats':    return ta('Stats Grid (Value|Label per line)', 'stats', '1,200+|Citizens\nMay 2023|Founded');
      case 'discord':  return fg('Discord Invite URL','url:url','https://discord.gg/...');
      case 'youtube':  return fg('YouTube URL','url:url','https://youtube.com/...');
      case 'media':    return `<div class="form-row" style="margin-bottom:0;">${fg('Image URL','url:url')}<div class="form-group" style="flex:1;margin-bottom:0;"><label>Caption</label><input type="text" class="form-control widget-input" data-field="caption" value="${escHtml(w.caption||'')}"></div></div>`;
      case 'gallery_images': return ta('Image Gallery (URL|Caption per line)', 'items', 'https://img.url|Caption text', 90);
      case 'gallery_videos': return ta('Video Gallery (YouTube URL|Caption per line)', 'items', 'https://youtube.com/watch?v=...|Caption', 90);
      case 'table':    return ta('Table (first row = headers, cells separated by |)', 'table', 'Name|Role|Element\nSteve|Emperor|Fire', 90);
      case 'leaders_embed': return `<p style="font-size:11px;color:var(--text-muted);margin:0;"><i class="fa-solid fa-info-circle"></i> Leader cards populate dynamically from Empire database.</p>`;
      case 'html':     return ta('Raw HTML / CSS / JavaScript', 'code', '<div class="custom">...</div>', 100);
      case 'divider':  return `<p style="font-size:11px;color:var(--text-muted);margin:0;"><i class="fa-solid fa-minus"></i> Horizontal divider line.</p>`;
      default:         return `<p style="color:var(--text-muted);font-size:11px;">Unknown widget type: ${w.type}</p>`;
    }
  }

  function readIweState() {
    document.querySelectorAll('#iwe-canvas .iwe-widget-card').forEach(card => {
      const i = +card.getAttribute('data-index'); const w = currentEditingWidgets[i]; if (!w) return;
      card.querySelectorAll('.widget-input').forEach(inp => {
        const f = inp.getAttribute('data-field'), v = inp.value;
        if (f==='items') w.items = v.split('\n').filter(l=>l.trim()).map(l=>{const[url,caption]=l.split('|');return{url:(url||'').trim(),caption:(caption||'').trim()};});
        else if (f==='stats') w.stats = v.split('\n').filter(l=>l.includes('|')).map(l=>{const[val,lbl]=l.split('|');return{value:val.trim(),label:(lbl||'').trim()};});
        else if (f==='table') { const lines=v.split('\n').filter(l=>l.trim()); w.headers=(lines[0]||'').split('|').map(c=>c.trim()); w.rows=lines.slice(1).map(l=>l.split('|').map(c=>c.trim())); }
        else w[f] = v;
      });
    });
  }

  function setupIweListeners(pageId) {
    const shelf = document.getElementById('iwe-shelf');
    document.getElementById('iwe-toggle-shelf')?.addEventListener('click', () => { shelf.style.display = shelf.style.display==='none'?'block':'none'; });
    const defaults = { heading:{type:'heading',text:'New Section',size:'h3'}, text:{type:'text',content:'Write content here...'}, stats:{type:'stats',stats:[{value:'100%',label:'Loyalty'}]}, discord:{type:'discord',url:'https://discord.gg/...'}, youtube:{type:'youtube',url:'https://www.youtube.com/...'}, media:{type:'media',url:'',caption:''}, gallery_images:{type:'gallery_images',items:[{url:'',caption:''}]}, gallery_videos:{type:'gallery_videos',items:[{url:'',caption:''}]}, table:{type:'table',headers:['Column 1','Column 2'],rows:[['Cell 1','Cell 2']]}, leaders_embed:{type:'leaders_embed'}, html:{type:'html',code:'<div>Custom HTML</div>'}, divider:{type:'divider'} };
    document.querySelectorAll('.iwe-add-btn').forEach(btn => btn.addEventListener('click', () => { readIweState(); currentEditingWidgets.push(JSON.parse(JSON.stringify(defaults[btn.getAttribute('data-type')]||{type:btn.getAttribute('data-type')}))); shelf.style.display='none'; renderIweCards(pageId); }));
    document.getElementById('iwe-save')?.addEventListener('click', () => {
      readIweState();
      const page = xmlDatabase.querySelector(`page[id="${pageId}"]`);
      if (page) { saveWidgetsToPage(page, currentEditingWidgets); saveDatabase(); showToast('Page saved!'); isWidgetEditMode=false; renderActiveTab(); updateFloatingEditBtn(); }
    });
    document.getElementById('iwe-cancel')?.addEventListener('click', () => { if (confirm('Discard changes?')) { isWidgetEditMode=false; renderActiveTab(); updateFloatingEditBtn(); } });
  }

  /* ====================================================================
     18. WIDGET SYSTEM
     ==================================================================== */
  function loadWidgetData(w, wd) {
    const t = w.getAttribute('type');
    if (t==='heading')  { wd.text=w.querySelector('text')?.textContent||''; wd.size=w.querySelector('size')?.textContent||'h3'; }
    else if (t==='text')    wd.content = w.querySelector('content')?.textContent||'';
    else if (t==='stats')   wd.stats   = Array.from(w.querySelectorAll('stat')).map(s=>({value:s.querySelector('value')?.textContent||'',label:s.querySelector('label')?.textContent||''}));
    else if (t==='discord'||t==='youtube') wd.url = w.querySelector('url')?.textContent||'';
    else if (t==='media')   { wd.url=w.querySelector('url')?.textContent||''; wd.caption=w.querySelector('caption')?.textContent||''; }
    else if (t==='gallery_images'||t==='gallery_videos') wd.items = Array.from(w.querySelectorAll('item')).map(i=>({url:i.getAttribute('url')||'',caption:i.getAttribute('caption')||''}));
    else if (t==='table')   { wd.headers=Array.from(w.querySelectorAll('headers cell')).map(c=>c.textContent); wd.rows=Array.from(w.querySelectorAll('row')).map(r=>Array.from(r.querySelectorAll('cell')).map(c=>c.textContent)); }
    else if (t==='html')    wd.code = w.querySelector('code')?.textContent||'';
  }

  function saveWidgetsToPage(pageNode, widgets) {
    pageNode.querySelector('widgets')?.remove();
    if (!widgets.length) return;
    const wNode = xmlDatabase.createElement('widgets');
    widgets.forEach(w => {
      const wn = xmlDatabase.createElement('widget'); wn.setAttribute('type', w.type);
      const mk = (tag, val) => { const el=xmlDatabase.createElement(tag); el.textContent=val; return el; };
      if (w.type==='heading')  { wn.appendChild(mk('text',w.text||'')); wn.appendChild(mk('size',w.size||'h3')); }
      else if (w.type==='text')    wn.appendChild(mk('content',w.content||''));
      else if (w.type==='stats')   (w.stats||[]).forEach(s=>{ const sn=xmlDatabase.createElement('stat'); sn.appendChild(mk('value',s.value||'')); sn.appendChild(mk('label',s.label||'')); wn.appendChild(sn); });
      else if (w.type==='discord'||w.type==='youtube') wn.appendChild(mk('url',w.url||''));
      else if (w.type==='media')   { wn.appendChild(mk('url',w.url||'')); wn.appendChild(mk('caption',w.caption||'')); }
      else if (w.type==='gallery_images'||w.type==='gallery_videos') (w.items||[]).forEach(item=>{ const i=xmlDatabase.createElement('item'); i.setAttribute('url',item.url||''); i.setAttribute('caption',item.caption||''); wn.appendChild(i); });
      else if (w.type==='table')   { const hn=xmlDatabase.createElement('headers'); (w.headers||[]).forEach(h=>hn.appendChild(mk('cell',h))); wn.appendChild(hn); (w.rows||[]).forEach(row=>{ const rn=xmlDatabase.createElement('row'); row.forEach(c=>rn.appendChild(mk('cell',c))); wn.appendChild(rn); }); }
      else if (w.type==='html')    wn.appendChild(mk('code',w.code||''));
      wNode.appendChild(wn);
    });
    pageNode.appendChild(wNode);
  }

  function renderWidgetsLayout(widgetsNode) {
    return Array.from(widgetsNode.querySelectorAll('widget')).map(w => {
      const t = w.getAttribute('type');
      if (t==='heading') {
        const s=w.querySelector('size')?.textContent||'h3'; return `<${s} class="widget-heading">${w.querySelector('text')?.textContent||''}</${s}>`;
      } else if (t==='text') {
        return `<div class="widget-text">${parseWikiText(w.querySelector('content')?.textContent||'')}</div>`;
      } else if (t==='stats') {
        return `<div class="dyn-stats-grid">${Array.from(w.querySelectorAll('stat')).map(s=>`<div class="dyn-stat-card"><div class="dyn-stat-value">${s.querySelector('value')?.textContent||''}</div><div class="dyn-stat-label">${s.querySelector('label')?.textContent||''}</div></div>`).join('')}</div>`;
      } else if (t==='discord') {
        return `<div style="margin:20px 0;"><a href="${w.querySelector('url')?.textContent||'#'}" target="_blank" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:8px;"><i class="fa-brands fa-discord"></i> Join Discord Server</a></div>`;
      } else if (t==='youtube') {
        return `<div style="margin:20px 0;"><a href="${w.querySelector('url')?.textContent||'#'}" target="_blank" class="btn" style="border-color:#ef4444;color:#ef4444;display:inline-flex;align-items:center;gap:8px;"><i class="fa-brands fa-youtube"></i> Subscribe on YouTube</a></div>`;
      } else if (t==='media') {
        const url=w.querySelector('url')?.textContent||'', cap=w.querySelector('caption')?.textContent||'';
        return `<div class="media-widget-block"><img src="${url}" alt="${cap}" class="gallery-item-img" data-caption="${cap}" style="max-width:100%;border-radius:8px;cursor:pointer;">${cap?`<p class="media-caption">${cap}</p>`:''}</div>`;
      } else if (t==='gallery_images') {
        return `<div class="gallery-grid">${Array.from(w.querySelectorAll('item')).map(i=>`<div class="gallery-item"><img class="gallery-item-img" src="${i.getAttribute('url')||''}" data-caption="${i.getAttribute('caption')||''}" alt="${i.getAttribute('caption')||''}"><div class="gallery-caption">${i.getAttribute('caption')||''}</div></div>`).join('')}</div>`;
      } else if (t==='gallery_videos') {
        return `<div class="gallery-grid">${Array.from(w.querySelectorAll('item')).map(i=>{let url=i.getAttribute('url')||'';const ym=url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);if(ym)url=`https://www.youtube.com/embed/${ym[1]}`;return `<div class="gallery-video-item"><iframe src="${url}" frameborder="0" allowfullscreen loading="lazy" style="aspect-ratio:16/9;"></iframe><div class="gallery-caption">${i.getAttribute('caption')||''}</div></div>`;}).join('')}</div>`;
      } else if (t==='table') {
        const ths=Array.from(w.querySelectorAll('headers cell')); const rows=Array.from(w.querySelectorAll('row'));
        return `<div class="table-widget-container"><table class="wiki-table">${ths.length?`<thead><tr>${ths.map(h=>`<th>${h.textContent}</th>`).join('')}</tr></thead>`:''}<tbody>${rows.map(r=>`<tr>${Array.from(r.querySelectorAll('cell')).map(c=>`<td>${c.textContent}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      } else if (t==='leaders_embed') {
        return `<div class="leadership-grid">${Array.from(xmlDatabase.querySelectorAll('leaders leader')).map(l=>`<div class="leader-card card-element-${l.querySelector('element')?.textContent||'Fire'} element-glow" style="margin:0;"><div class="card-header"><div class="card-avatar">${l.querySelector('avatar')?.textContent||'👑'}</div><div class="card-title-area"><h3>${l.querySelector('name')?.textContent||''}</h3><span>${l.querySelector('title')?.textContent||''}</span></div></div></div>`).join('')}</div>`;
      } else if (t==='html') {
        return `<div class="custom-html-widget-block">${w.querySelector('code')?.textContent||''}</div>`;
      } else if (t==='divider') {
        return `<hr class="wiki-divider">`;
      }
      return '';
    }).join('');
  }

  /* ====================================================================
     19. WIKITEXT PARSER
     ==================================================================== */
  function parseWikiText(text) {
    if (!text) return '';
    let p = text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/'''(.*?)'''/g,'<strong>$1</strong>')
      .replace(/''(.*?)''/g,'<em>$1</em>')
      .replace(/^====\s*(.*?)\s*====/gm,'<h5 style="font-family:var(--font-display);margin-top:10px;">$1</h5>')
      .replace(/^===\s*(.*?)\s*===/gm,'<h4 style="font-family:var(--font-display);color:var(--text-main);margin-top:14px;">$1</h4>')
      .replace(/^==\s*(.*?)\s*==/gm,'<h3 style="font-family:var(--font-display);color:var(--accent);margin-top:20px;">$1</h3>')
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g,'<a href="#" class="wiki-internal-link" data-target="$1">$2</a>')
      .replace(/\[\[([^\]]+)\]\]/g,'<a href="#" class="wiki-internal-link" data-target="$1">$1</a>')
      .replace(/^\*\s*(.*)/gm,'<li style="margin-left:20px;margin-bottom:4px;">$1</li>')
      .replace(/\n/g,'<br>');
    setTimeout(bindWikiLinks, 100);
    return `<div>${p}</div>`;
  }

  function simulateLuaTemplate(luaCode) {
    const js = luaCode.replace(/function\s+(\w+)\s*\((.*?)\)/g,'function $1($2){').replace(/\bend\b/g,'}').replace(/local\s+(\w+)\s*=/g,'let $1 =').replace(/--/g,'//').replace(/\.\./g,'+');
    try { return new Function(`const mw={title:{getCurrentTitle:()=>({text:"${activeTab}"})}};${js}\nif(typeof buildPage==='function')return buildPage();return 'Define buildPage() to output HTML.';`)(); }
    catch(e) { return `<span style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Lua Error: ${e.message}</span>`; }
  }

  /* ====================================================================
     20. ADMIN VIEW
     ==================================================================== */
  function renderAdminView() {
    isWidgetEditMode = false; updateFloatingEditBtn();
    if (!isLoggedIn) { renderLoginForm(); return; }
    const isRoot = adminRole === 'root';
    viewTitle.textContent = 'Admin Control Console';
    viewSubtitle.textContent = 'On-the-spot content editor and security manager';

    contentViewport.innerHTML = `
      <div class="wiki-page" style="max-width:100%;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
          <div class="user-identity-badge role-${adminRole}"><i class="fa-solid fa-user-shield"></i> ${loggedInUser} — ${isRoot?'Root Administrator':'Standard Admin'}</div>
          <button class="btn btn-danger" id="admin-logout-btn" style="padding:6px 14px;font-size:11px;"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>
        </div>
        <div class="admin-container">
          <div class="admin-panel">
            <h3 class="admin-panel-title"><span>Dynamic Editor Tools</span><i class="fa-solid fa-pen-to-square"></i></h3>
            <div class="admin-security-widget">
              <h4 class="admin-security-title"><i class="fa-solid fa-shield-halved"></i><span>System Security Override</span></h4>
              <div class="security-btn-group">
                <button class="security-select-btn ${currentLockdownState==='green'?'active-green':''}" data-state="green"><i class="fa-solid fa-circle-check" style="font-size:16px;"></i><span>Code Green</span></button>
                <button class="security-select-btn ${currentLockdownState==='yellow'?'active-yellow':''}" data-state="yellow"><i class="fa-solid fa-triangle-exclamation" style="font-size:16px;"></i><span>Code Yellow</span></button>
                <button class="security-select-btn ${currentLockdownState==='red'?'active-red':''}" data-state="red"><i class="fa-solid fa-radiation" style="font-size:16px;"></i><span>Code Red</span></button>
              </div>
            </div>
            <div class="timeline-filters" style="margin-bottom:24px;padding:2px;flex-wrap:wrap;">
              <button class="filter-btn active" data-form="timeline">Event</button>
              ${isRoot?'<button class="filter-btn" data-form="leader">Leader</button>':''}
              <button class="filter-btn" data-form="base">Stronghold</button>
              <button class="filter-btn" data-form="war">Campaign</button>
              <button class="filter-btn" data-form="meta">Meta</button>
              <button class="filter-btn" data-form="builder">Page Builder</button>
              ${isRoot?'<button class="filter-btn" data-form="security">Security</button>':''}
            </div>
            ${buildAdminForms(isRoot)}
          </div>
          <div class="admin-panel">
            ${isRoot ? buildXmlEditor() : buildRestrictedPanel()}
          </div>
        </div>
      </div>`;

    setupAdminListeners(isRoot);
  }

  function renderLoginForm() {
    viewTitle.textContent = 'Empire Authentication';
    viewSubtitle.textContent = 'Administrative security gate';
    contentViewport.innerHTML = `
      <div class="wiki-page" style="display:flex;justify-content:center;align-items:center;min-height:480px;">
        <div class="login-card">
          <div class="login-header"><i class="fa-solid fa-lock login-lock-icon"></i><h2>Admin Console Login</h2><p>Enter credentials to access the management interface.</p></div>
          <div id="login-error" class="login-error-container"><i class="fa-solid fa-circle-exclamation"></i><span id="login-error-text">Invalid credentials.</span></div>
          <form id="loginForm" class="login-form">
            <div class="form-group"><label>Username</label><input type="text" id="login-username" class="form-control" placeholder="admin" required autocomplete="username"></div>
            <div class="form-group"><label>Password</label><input type="password" id="login-password" class="form-control" placeholder="••••••••" required autocomplete="current-password"></div>
            <button type="submit" class="btn btn-primary" style="width:100%;margin-top:10px;">Authorize Credentials</button>
          </form>
        </div>
      </div>`;
    document.getElementById('loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      const u = document.getElementById('login-username').value;
      const p = document.getElementById('login-password').value;
      const err = document.getElementById('login-error');
      const hashedInput = await sha256(p);
      const match = usersList.find(usr => usr.username===u && usr.password===hashedInput);
      if (match) { isLoggedIn=true; adminRole=match.role; loggedInUser=match.username; showToast(`Welcome, ${loggedInUser}.`); renderAdminView(); return; }
      if (u==='admin') {
        if (hashedInput===rootPassword)     { isLoggedIn=true; adminRole='root';     loggedInUser='admin'; showToast('Welcome, Arch-Empire Admin.'); renderAdminView(); return; }
        if (hashedInput===standardPassword) { isLoggedIn=true; adminRole='standard'; loggedInUser='admin'; showToast('Access Granted. Standard Admin.'); renderAdminView(); return; }
      }
      document.getElementById('login-error-text').textContent = 'Invalid username or password.';
      err.style.display='flex'; err.classList.remove('shake'); void err.offsetWidth; err.classList.add('shake');
    });
  }

  function buildAdminForms(isRoot) {
    const meta = xmlDatabase.querySelector('meta');
    return `
      <form id="form-timeline" class="admin-form">
        <div class="form-group"><label>Event Date</label><input type="text" class="form-control" id="ev-date" placeholder="May 5, 2023" required></div>
        <div class="form-row">
          <div class="form-group"><label>Era</label><select class="form-control" id="ev-era"><option value="Founding">Founding</option><option value="Expansion">Expansion</option><option value="Wars">Wars</option><option value="NewEra">New Era</option></select></div>
          <div class="form-group"><label>Title</label><input type="text" class="form-control" id="ev-title" required></div>
        </div>
        <div class="form-group"><label>Description</label><textarea class="form-control" id="ev-desc" required></textarea></div>
        <button type="submit" class="btn btn-primary" style="width:100%;">Commit Event</button>
      </form>
      ${isRoot?`<form id="form-leader" class="admin-form" style="display:none;">
        <div class="form-row">
          <div class="form-group"><label>Username</label><input type="text" class="form-control" id="ld-name" required></div>
          <div class="form-group"><label>Symbol</label><input type="text" class="form-control" id="ld-avatar" placeholder="🔥" required></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Element</label><select class="form-control" id="ld-element"><option>Fire</option><option>Water</option><option>Earth</option><option>Air</option></select></div>
          <div class="form-group"><label>Title</label><input type="text" class="form-control" id="ld-title" required></div>
        </div>
        <div class="form-group"><label>Reign Period</label><input type="text" class="form-control" id="ld-reign" required></div>
        <div class="form-group"><label>Achievements (one per line)</label><textarea class="form-control" id="ld-achievements" required></textarea></div>
        <div class="form-group"><label>Legacy Quote</label><input type="text" class="form-control" id="ld-legacy" required></div>
        <button type="submit" class="btn btn-primary" style="width:100%;">Commit Leader</button>
      </form>`:''}
      <form id="form-base" class="admin-form" style="display:none;">
        <div class="form-group"><label>Base Name</label><input type="text" class="form-control" id="bs-name" required></div>
        <div class="form-row">
          <div class="form-group"><label>Era</label><input type="text" class="form-control" id="bs-era" required></div>
          <div class="form-group"><label>Location</label><input type="text" class="form-control" id="bs-location" required></div>
        </div>
        <div class="form-group"><label>Features</label><textarea class="form-control" id="bs-features" required></textarea></div>
        <div class="form-group"><label>Legacy</label><input type="text" class="form-control" id="bs-legacy"></div>
        <button type="submit" class="btn btn-primary" style="width:100%;">Commit Stronghold</button>
      </form>
      <form id="form-war" class="admin-form" style="display:none;">
        <div class="form-row">
          <div class="form-group"><label>Campaign Name</label><input type="text" class="form-control" id="wr-name" required></div>
          <div class="form-group"><label>Date</label><input type="text" class="form-control" id="wr-date" required></div>
        </div>
        <div class="form-group"><label>Opponents</label><input type="text" class="form-control" id="wr-opponents" required></div>
        <div class="form-group"><label>Engagements (one per line)</label><textarea class="form-control" id="wr-events" required></textarea></div>
        <div class="form-group"><label>Outcome</label><textarea class="form-control" id="wr-outcome" required></textarea></div>
        <button type="submit" class="btn btn-primary" style="width:100%;">Commit Campaign</button>
      </form>
      <form id="form-meta" class="admin-form" style="display:none;">
        <div class="form-row">
          <div class="form-group"><label>Member Count</label><input type="text" class="form-control" id="mt-members" value="${meta?.querySelector('members')?.textContent||''}"></div>
          <div class="form-group"><label>Current Era</label><input type="text" class="form-control" id="mt-era" value="${meta?.querySelector('era')?.textContent||''}"></div>
        </div>
        <div class="form-group"><label>Discord URL ${!isRoot?'<small style="color:#f97316;">(Root Only)</small>':''}</label><input type="text" class="form-control" id="mt-discord" value="${meta?.querySelector('discord')?.textContent||''}" ${!isRoot?'disabled':''}></div>
        <div class="form-group"><label>YouTube URL</label><input type="text" class="form-control" id="mt-youtube" value="${meta?.querySelector('youtube')?.textContent||''}"></div>
        <button type="submit" class="btn btn-primary" style="width:100%;">Save Meta</button>
      </form>
      <div id="form-builder" class="admin-form" style="display:none;">
        ${buildPageBuilderForm(isRoot)}
      </div>
      ${isRoot?`<div id="form-security" class="admin-form" style="display:none;">${buildSecurityForm()}</div>`:''}`;
  }

  function buildPageBuilderForm(isRoot) {
    const pages = Array.from(xmlDatabase.querySelectorAll('pages page'));
    const pageOpts = pages.map(p => `<option value="${p.getAttribute('id')}">${p.querySelector('title')?.textContent||p.getAttribute('id')}</option>`).join('');
    const parentOpts = pages.map(p => `<option value="${p.getAttribute('id')}">${p.querySelector('title')?.textContent||p.getAttribute('id')}</option>`).join('');
    return `
      <div class="form-row" style="margin-bottom:16px;">
        <div class="form-group" style="flex:1;"><label>Select Page</label><select class="form-control" id="builder-page-sel">${pageOpts}${isRoot?'<option value="__new__">[Create New Page]</option>':''}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Page ID</label><input type="text" class="form-control" id="builder-id" readonly></div>
        <div class="form-group"><label>Icon Class</label><input type="text" class="form-control" id="builder-icon" placeholder="fa-solid fa-file"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Page Title</label><input type="text" class="form-control" id="builder-title"></div>
        <div class="form-group"><label>Subtitle</label><input type="text" class="form-control" id="builder-subtitle"></div>
      </div>
      <div class="form-group"><label>Parent Page (for sub-pages)</label><select class="form-control" id="builder-parent"><option value="">None (Top-level)</option>${parentOpts}</select></div>
      <div class="editor-panel-tabs" style="margin-top:16px;">
        <button type="button" class="editor-tab-btn active" data-panel="visual">Visual Builder</button>
        <button type="button" class="editor-tab-btn" data-panel="code">HTML / CSS / JS</button>
        <button type="button" class="editor-tab-btn" data-panel="sandbox">Wikitext &amp; Lua</button>
      </div>
      <div class="editor-container" id="builder-panel-visual">
        <div class="builder-layout">
          <div class="widgets-shelf">
            <div class="shelf-title">Insert Widgets</div>
            <div class="shelf-items">
              ${[['heading','fa-heading','Heading'],['text','fa-align-left','WikiText'],['stats','fa-chart-simple','Stats'],['discord','fa-brands fa-discord','Discord'],['youtube','fa-brands fa-youtube','YouTube'],['media','fa-photo-film','Image'],['gallery_images','fa-images','Image Gallery'],['gallery_videos','fa-film','Video Gallery'],['table','fa-table','Table'],['leaders','fa-users-viewfinder','Leaders'],['html','fa-code','HTML'],['divider','fa-minus','Divider']].map(([t,i,l])=>`<button type="button" class="shelf-item" id="add-widget-${t}"><i class="fa-solid ${i}"></i> ${l}</button>`).join('')}
            </div>
          </div>
          <div class="editor-canvas" id="builder-editor-canvas"><div class="canvas-empty-state"><i class="fa-solid fa-cubes"></i><p>No widgets yet.</p></div></div>
        </div>
      </div>
      <div class="editor-container" id="builder-panel-code" style="display:none;">
        <div class="form-group"><label>Raw HTML Content</label><textarea class="form-control xml-editor-area" id="builder-raw" style="height:100px;"></textarea></div>
        <div class="form-group"><label>Custom CSS</label><textarea class="form-control xml-editor-area" id="builder-css" style="height:80px;" placeholder=".my-class { color: var(--accent); }"></textarea></div>
        <div class="form-group"><label>Custom JavaScript</label><textarea class="form-control xml-editor-area" id="builder-js" style="height:80px;" placeholder="console.log('Page ready!');"></textarea></div>
      </div>
      <div class="editor-container" id="builder-panel-sandbox" style="display:none;">
        <div class="sandbox-split">
          <div>
            <div class="form-group"><label>Wikitext Sandbox</label><textarea class="form-control xml-editor-area" id="sb-wikitext" style="height:110px;" placeholder="== Heading ==\n'''bold''' and ''italic'' and [[home|Home link]]"></textarea><button type="button" class="btn" id="run-wikitext" style="width:100%;margin-top:6px;font-size:11px;">Parse Wikitext</button></div>
            <div class="form-group"><label>Lua Sandbox (simplified)</label><textarea class="form-control xml-editor-area" id="sb-lua" style="height:110px;font-family:monospace;" placeholder="function buildPage()\n  return '<h3>Hello</h3>'\nend"></textarea><button type="button" class="btn" id="run-lua" style="width:100%;margin-top:6px;font-size:11px;">Execute Lua</button></div>
          </div>
          <div class="sandbox-preview-pane"><div class="sandbox-preview-title"><span>Preview</span><i class="fa-solid fa-eye"></i></div><div id="sb-output" style="color:var(--text-main);">Run a parser to see output.</div></div>
        </div>
      </div>
      <div class="admin-actions" style="margin-top:16px;border-top:1px dashed var(--border-color);padding-top:16px;">
        <button type="button" class="btn btn-primary" id="builder-save" style="flex-grow:1;"><i class="fa-solid fa-save"></i> Save Page</button>
        ${isRoot?'<button type="button" class="btn btn-danger" id="builder-delete"><i class="fa-solid fa-trash"></i> Delete</button>':''}
      </div>`;
  }

  function buildSecurityForm() {
    return `
      <form id="form-sec-passwords">
        <h4 class="admin-meta-header" style="margin-top:0;">Legacy Fallback Passwords</h4>
        <div class="form-row">
          <div class="form-group"><label>Root Password</label><input type="password" class="form-control" id="sec-root-pass" value="••••••••" placeholder="Enter new password"></div>
          <div class="form-group"><label>Standard Password</label><input type="password" class="form-control" id="sec-std-pass" value="••••••••" placeholder="Enter new password"></div>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;margin-bottom:24px;">Update Passwords</button>
      </form>
      <h4 class="admin-meta-header">Admin User Registry</h4>
      <div class="user-console">
        <div class="user-table-container"><table class="user-table"><thead><tr><th>Username</th><th>Role</th><th>Action</th></tr></thead><tbody id="user-registry-tbody"></tbody></table></div>
        <form id="form-add-user" style="background:rgba(255,255,255,0.02);border:1px solid var(--border-color);padding:16px;border-radius:8px;margin-top:16px;">
          <h5 style="margin:0 0 12px;font-family:var(--font-display);font-size:10px;text-transform:uppercase;color:var(--accent);">Register New Admin</h5>
          <div class="form-row">
            <div class="form-group"><label>Username</label><input type="text" class="form-control" id="new-user-uname" required></div>
            <div class="form-group"><label>Password</label><input type="password" class="form-control" id="new-user-pass" required></div>
            <div class="form-group"><label>Role</label><select class="form-control" id="new-user-role"><option value="standard">Standard Admin</option><option value="root">Root Administrator</option></select></div>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;margin-top:10px;">Create Account</button>
        </form>
      </div>
      <h4 class="admin-meta-header" style="margin-top:28px;">Discord Role Registry</h4>
      <div class="user-console">
        <div class="user-table-container"><table class="user-table"><thead><tr><th>#</th><th>Role Name</th><th>Discord ID</th><th>Color</th><th></th></tr></thead><tbody id="role-registry-tbody"></tbody></table></div>
        <form id="form-add-role" style="background:rgba(255,255,255,0.02);border:1px solid var(--border-color);padding:16px;border-radius:8px;margin-top:16px;">
          <h5 style="margin:0 0 12px;font-family:var(--font-display);font-size:10px;text-transform:uppercase;color:var(--accent);">Add Discord Role</h5>
          <div class="form-row">
            <div class="form-group"><label>Role Name</label><input type="text" class="form-control" id="new-role-name" placeholder="e.g. Emperor" required></div>
            <div class="form-group"><label>Discord Role ID</label><input type="text" class="form-control" id="new-role-id" placeholder="Paste from Discord" required></div>
            <div class="form-group" style="max-width:80px;"><label>Color</label><input type="color" class="form-control" id="new-role-color" value="#f59e0b" style="height:42px;padding:2px;"></div>
            <div class="form-group" style="max-width:80px;"><label>Priority</label><input type="number" class="form-control" id="new-role-priority" value="1" min="1"></div>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;margin-top:10px;">Add Role</button>
        </form>
      </div>
      <h4 class="admin-meta-header" style="margin-top:28px;">GitHub &amp; Netlify Sync</h4>
      <div class="github-sync-panel">
        <p style="font-size:11px;color:var(--text-muted);margin-bottom:14px;">Publish database.xml directly to your GitHub repo to update the live site. Netlify will deploy changes automatically in ~10s.</p>
        <div class="form-group"><label>GitHub Personal Access Token (PAT)</label><input type="password" class="form-control" id="gh-pat" placeholder="ghp_xxxxxxxxxxxx" value="${localStorage.getItem('ee_github_pat')||''}"></div>
        <div class="form-row">
          <div class="form-group"><label>Repository (user/repo)</label><input type="text" class="form-control" id="gh-repo" placeholder="yourusername/elemental-empire" value="${localStorage.getItem('ee_github_repo')||''}"></div>
          <div class="form-group"><label>Branch</label><input type="text" class="form-control" id="gh-branch" placeholder="main" value="${localStorage.getItem('ee_github_branch')||'main'}"></div>
        </div>
        <div class="form-group"><label>Netlify Site ID (Optional for Status Badge)</label><input type="text" class="form-control" id="netlify-site-id" placeholder="e.g. 6fc44b2e-5a7c-4ba4-a7d8-f904bc099ffc" value="${localStorage.getItem('ee_netlify_site_id')||'6fc44b2e-5a7c-4ba4-a7d8-f904bc099ffc'}"></div>
        <div style="display:flex;gap:10px;">
          <button type="button" class="btn" id="gh-save-settings" style="flex:1;"><i class="fa-solid fa-floppy-disk"></i> Save Settings</button>
          <button type="button" class="btn github-publish-btn" id="gh-publish" style="flex:2;"><i class="fa-brands fa-github"></i> Publish to GitHub</button>
        </div>
        <div style="display:flex;gap:10px;margin-top:10px;">
          <button type="button" class="btn" id="gh-check-status" style="width:100%;"><i class="fa-solid fa-rotate"></i> Refresh Deployment Status</button>
        </div>
        <div id="gh-status-container" style="margin-top:14px;padding:12px;background:rgba(255,255,255,0.02);border:1px solid var(--border-color);border-radius:6px;display:none;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:11px;font-weight:bold;color:var(--text-muted);">Deployment Status:</span>
            <span id="gh-status-badge" class="role-badge" style="padding:2px 8px;border-radius:4px;font-size:10px;">Unknown</span>
          </div>
          <p id="gh-status-details" style="font-size:10px;color:var(--text-muted);margin:8px 0 0 0;line-height:1.4;"></p>
        </div>
      </div>`;
  }

  function buildXmlEditor() {
    return `<h3 class="admin-panel-title"><span>Direct XML Editor</span><i class="fa-solid fa-code"></i></h3>
      <div class="xml-terminal-container">
        <textarea class="form-control xml-editor-area" id="xmlTextarea" spellcheck="false">${escHtml(formatXml(new XMLSerializer().serializeToString(xmlDatabase)))}</textarea>
        <div class="admin-actions">
          <button class="btn btn-primary" id="apply-xml" style="flex-grow:1;"><i class="fa-solid fa-cloud-arrow-up"></i> Apply XML</button>
          <button class="btn" id="download-xml"><i class="fa-solid fa-download"></i> Download</button>
          <button class="btn btn-danger" id="reset-db-btn"><i class="fa-solid fa-rotate-left"></i> Revert</button>
        </div>
      </div>
      <p style="font-size:10px;color:var(--text-muted);margin-top:12px;line-height:1.5;"><i class="fa-solid fa-info-circle" style="color:var(--accent);"></i> Changes save to browser localStorage. Use Download or GitHub Sync to persist permanently.</p>`;
  }

  function buildRestrictedPanel() {
    return `<h3 class="admin-panel-title" style="color:var(--text-muted);"><span>Direct XML Editor</span><i class="fa-solid fa-lock" style="color:#f97316;"></i></h3><div class="restricted-overlay"><i class="fa-solid fa-shield-halved"></i><h4>Access Restricted</h4><p>Raw database manipulation is disabled for Standard Administrators.</p></div>`;
  }

  function setupAdminListeners(isRoot) {
    // Logout
    document.getElementById('admin-logout-btn')?.addEventListener('click', () => { isLoggedIn=false; adminRole=null; loggedInUser=null; showToast('Logged out.'); renderAdminView(); });

    // Lockdown buttons
    contentViewport.querySelectorAll('.security-select-btn').forEach(btn => btn.addEventListener('click', () => applyLockdownState(btn.getAttribute('data-state'), true)));

    // Form tab switching
    const allForms = ['timeline','base','war','meta','builder','leader','security'].map(n => document.getElementById(`form-${n}`)).filter(Boolean);
    contentViewport.querySelectorAll('[data-form]').forEach(btn => {
      btn.addEventListener('click', () => {
        contentViewport.querySelectorAll('[data-form]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = document.getElementById(`form-${btn.getAttribute('data-form')}`);
        allForms.forEach(f => f.style.display = 'none');
        if (target) { target.style.display = 'block'; if (btn.getAttribute('data-form')==='builder') loadPageEditor(); if (btn.getAttribute('data-form')==='security'&&isRoot) { renderUserRegistryTable(); renderRoleRegistryTable(); checkGitHubDeploymentStatus(); } }
      });
    });

    // Builder tab switching
    contentViewport.querySelectorAll('.editor-tab-btn[data-panel]').forEach(btn => {
      btn.addEventListener('click', () => {
        contentViewport.querySelectorAll('.editor-tab-btn[data-panel]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        contentViewport.querySelectorAll('.editor-container').forEach(p => p.style.display = 'none');
        document.getElementById(`builder-panel-${btn.getAttribute('data-panel')}`)?.setAttribute('style','display:block');
      });
    });

    // Sandbox
    document.getElementById('run-wikitext')?.addEventListener('click', () => { document.getElementById('sb-output').innerHTML = parseWikiText(document.getElementById('sb-wikitext').value||''); });
    document.getElementById('run-lua')?.addEventListener('click',      () => { document.getElementById('sb-output').innerHTML = simulateLuaTemplate(document.getElementById('sb-lua').value||''); });

    // Timeline form
    document.getElementById('form-timeline')?.addEventListener('submit', e => {
      e.preventDefault();
      const node = xmlDatabase.createElement('event');
      ['date','era','title','desc'].forEach(f => setXmlField(node, f, document.getElementById(`ev-${f}`)?.value||''));
      xmlDatabase.querySelector('timeline')?.appendChild(node);
      saveDatabase(); showToast('Event added.'); renderAdminView();
    });

    // Leader form
    if (isRoot) {
      document.getElementById('form-leader')?.addEventListener('submit', e => {
        e.preventDefault();
        const name = document.getElementById('ld-name').value;
        const node = xmlDatabase.createElement('leader');
        node.setAttribute('id', name.toLowerCase().replace(/[^a-z0-9]/g,''));
        ['name','avatar','element','title','reign','legacy'].forEach(f => setXmlField(node, f, document.getElementById(`ld-${f.replace('title','title').replace('legacy','legacy')}`)?.value||''));
        const achNode = xmlDatabase.createElement('achievements');
        (document.getElementById('ld-achievements')?.value||'').split('\n').filter(a=>a.trim()).forEach(a => { const el=xmlDatabase.createElement('achievement'); el.textContent=a.trim(); achNode.appendChild(el); });
        node.appendChild(achNode);
        xmlDatabase.querySelector('leaders')?.appendChild(node);
        saveDatabase(); showToast('Leader added.'); renderAdminView();
      });
    }

    // Base form
    document.getElementById('form-base')?.addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('bs-name').value;
      const node = xmlDatabase.createElement('base');
      node.setAttribute('id', name.toLowerCase().replace(/[^a-z0-9]/g,''));
      ['name','era','location','features','legacy'].forEach(f => setXmlField(node, f, document.getElementById(`bs-${f}`)?.value||''));
      xmlDatabase.querySelector('bases')?.appendChild(node);
      saveDatabase(); showToast('Stronghold added.'); renderAdminView();
    });

    // War form
    document.getElementById('form-war')?.addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('wr-name').value;
      const node = xmlDatabase.createElement('war');
      node.setAttribute('id', name.toLowerCase().replace(/[^a-z0-9]/g,''));
      ['name','date','opponents','outcome'].forEach(f => setXmlField(node, f, document.getElementById(`wr-${f}`)?.value||''));
      const evNode = xmlDatabase.createElement('events');
      (document.getElementById('wr-events')?.value||'').split('\n').filter(e=>e.trim()).forEach(ev => { const el=xmlDatabase.createElement('event'); el.textContent=ev.trim(); evNode.appendChild(el); });
      node.appendChild(evNode);
      xmlDatabase.querySelector('wars')?.appendChild(node);
      saveDatabase(); showToast('Campaign added.'); renderAdminView();
    });

    // Meta form
    document.getElementById('form-meta')?.addEventListener('submit', e => {
      e.preventDefault();
      const meta = xmlDatabase.querySelector('meta');
      if (meta) {
        setXmlField(meta, 'members', document.getElementById('mt-members')?.value||'');
        setXmlField(meta, 'era',     document.getElementById('mt-era')?.value||'');
        if (isRoot) setXmlField(meta, 'discord', document.getElementById('mt-discord')?.value||'');
        setXmlField(meta, 'youtube', document.getElementById('mt-youtube')?.value||'');
        saveDatabase(); updateMetaInfo(); showToast('Meta info updated.'); renderAdminView();
      }
    });

    // Page builder load
    const pageSel = document.getElementById('builder-page-sel');
    pageSel?.addEventListener('change', loadPageEditor);

    // Page builder widgets shelf
    setupAdminShelf();

    // Save page
    document.getElementById('builder-save')?.addEventListener('click', saveBuilderPage);
    document.getElementById('builder-delete')?.addEventListener('click', deleteBuilderPage);

    // Security listeners
    if (isRoot) {
      document.getElementById('form-sec-passwords')?.addEventListener('submit', async e => {
        e.preventDefault();
        const rootInput = document.getElementById('sec-root-pass').value;
        const stdInput = document.getElementById('sec-std-pass').value;
        
        let changed = false;
        if (rootInput !== '••••••••' && rootInput.trim() !== '') {
          rootPassword = await sha256(rootInput);
          changed = true;
        }
        if (stdInput !== '••••••••' && stdInput.trim() !== '') {
          standardPassword = await sha256(stdInput);
          changed = true;
        }

        if (changed) {
          let sec = xmlDatabase.querySelector('meta security');
          if (!sec) { sec = xmlDatabase.createElement('security'); xmlDatabase.querySelector('meta')?.appendChild(sec); }
          setXmlField(sec, 'root_password',     rootPassword);
          setXmlField(sec, 'standard_password', standardPassword);
          saveDatabase();
          showToast('Passwords updated (hashed).');
        } else {
          showToast('No changes made.');
        }
        renderAdminView();
      });
      document.getElementById('form-add-user')?.addEventListener('submit', async e => {
        e.preventDefault();
        const u = document.getElementById('new-user-uname').value.trim();
        const p = document.getElementById('new-user-pass').value;
        const r = document.getElementById('new-user-role').value;
        if (usersList.find(usr => usr.username.toLowerCase()===u.toLowerCase())) { alert('Username already exists.'); return; }
        const hashedPass = await sha256(p);
        usersList.push({username:u,password:hashedPass,role:r});
        saveUsersToXml(); saveDatabase(); showToast(`Admin "${u}" created.`);
        document.getElementById('new-user-uname').value = '';
        document.getElementById('new-user-pass').value  = '';
        renderUserRegistryTable();
      });
      document.getElementById('form-add-role')?.addEventListener('submit', e => {
        e.preventDefault();
        const nm  = document.getElementById('new-role-name').value.trim();
        const rid = document.getElementById('new-role-id').value.trim();
        const col = document.getElementById('new-role-color').value;
        const pri = document.getElementById('new-role-priority').value;
        let rNode = xmlDatabase.querySelector('discord_roles');
        if (!rNode) { rNode = xmlDatabase.createElement('discord_roles'); xmlDatabase.querySelector('elemental_empire').appendChild(rNode); }
        const roleEl = xmlDatabase.createElement('role');
        roleEl.setAttribute('priority', pri); roleEl.setAttribute('color', col);
        setXmlField(roleEl, 'name', nm); setXmlField(roleEl, 'discord_id', rid);
        rNode.appendChild(roleEl);
        saveDatabase(); showToast(`Role "${nm}" added.`);
        document.getElementById('new-role-name').value = ''; document.getElementById('new-role-id').value = '';
        renderRoleRegistryTable();
      });
      document.getElementById('gh-save-settings')?.addEventListener('click', () => {
        localStorage.setItem('ee_github_pat',    document.getElementById('gh-pat').value);
        localStorage.setItem('ee_github_repo',   document.getElementById('gh-repo').value);
        localStorage.setItem('ee_github_branch', document.getElementById('gh-branch').value);
        localStorage.setItem('ee_netlify_site_id', document.getElementById('netlify-site-id').value);
        showToast('GitHub & Netlify settings saved locally.');
        checkGitHubDeploymentStatus();
      });
      document.getElementById('gh-publish')?.addEventListener('click', async () => {
        const pat = document.getElementById('gh-pat').value, repo = document.getElementById('gh-repo').value, branch = document.getElementById('gh-branch').value||'main';
        if (!pat||!repo) { alert('Enter PAT and repository name first.'); return; }
        const btn = document.getElementById('gh-publish');
        btn.textContent = 'Publishing…'; btn.disabled = true;
        await publishToGitHub(pat, repo, branch);
        btn.innerHTML = '<i class="fa-brands fa-github"></i> Publish to GitHub'; btn.disabled = false;
      });
      document.getElementById('gh-check-status')?.addEventListener('click', checkGitHubDeploymentStatus);
      document.getElementById('apply-xml')?.addEventListener('click', () => {
        try {
          const doc = new DOMParser().parseFromString(document.getElementById('xmlTextarea').value, 'text/xml');
          if (doc.querySelector('parsererror')) throw new Error('Malformed XML');
          xmlDatabase = doc; saveDatabase(); updateMetaInfo(); showToast('XML applied.'); renderAdminView();
        } catch(e) { alert('XML Error: '+e.message); }
      });
      document.getElementById('download-xml')?.addEventListener('click', () => {
        const blob = new Blob([formatXml(new XMLSerializer().serializeToString(xmlDatabase))],{type:'text/xml'});
        const a = Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:'database.xml'});
        document.body.appendChild(a); a.click(); a.remove(); showToast('Downloading database.xml…');
      });
      document.getElementById('reset-db-btn')?.addEventListener('click', resetDatabase);
    }
  }

  /* ====================================================================
     21. PAGE BUILDER HELPERS
     ==================================================================== */
  function loadPageEditor() {
    const sel = document.getElementById('builder-page-sel'); if (!sel) return;
    const id  = sel.value;
    const idInp = document.getElementById('builder-id');
    const page  = id !== '__new__' ? xmlDatabase.querySelector(`page[id="${id}"]`) : null;
    if (idInp) idInp.value = id === '__new__' ? '' : id;
    if (id==='__new__') idInp?.removeAttribute('readonly'); else idInp?.setAttribute('readonly','true');
    document.getElementById('builder-title')?.setAttribute('value', page?.querySelector('title')?.textContent||'');
    document.getElementById('builder-title').value    = page?.querySelector('title')?.textContent||'';
    document.getElementById('builder-subtitle').value = page?.querySelector('subtitle')?.textContent||'';
    document.getElementById('builder-icon').value     = page?.getAttribute('icon')||'fa-solid fa-file';
    document.getElementById('builder-parent').value   = page?.getAttribute('parent')||'';
    document.getElementById('builder-raw').value      = page?.querySelector('content')?.textContent||'';
    document.getElementById('builder-css').value      = page?.querySelector('custom_css')?.textContent||'';
    document.getElementById('builder-js').value       = page?.querySelector('custom_js')?.textContent||'';
    const delBtn = document.getElementById('builder-delete');
    if (delBtn) delBtn.style.display = (!page || ['home','history','allies','protocols'].includes(id)) ? 'none' : 'block';

    currentEditingWidgets = [];
    page?.querySelector('widgets')?.querySelectorAll('widget').forEach(w => { const wd={type:w.getAttribute('type')}; loadWidgetData(w,wd); currentEditingWidgets.push(wd); });
    renderCanvasWidgets();
  }

  function setupAdminShelf() {
    const defs = { heading:{type:'heading',text:'New Section',size:'h3'}, text:{type:'text',content:'Write here...'}, stats:{type:'stats',stats:[{value:'100',label:'Stat'}]}, discord:{type:'discord',url:'https://discord.gg/'}, youtube:{type:'youtube',url:'https://youtube.com/'}, media:{type:'media',url:'',caption:''}, gallery_images:{type:'gallery_images',items:[{url:'',caption:''}]}, gallery_videos:{type:'gallery_videos',items:[{url:'',caption:''}]}, table:{type:'table',headers:['Column 1','Column 2'],rows:[['Cell 1','Cell 2']]}, leaders:{type:'leaders_embed'}, html:{type:'html',code:'<div></div>'}, divider:{type:'divider'} };
    Object.keys(defs).forEach(k => {
      document.getElementById(`add-widget-${k}`)?.addEventListener('click', () => { readCanvasState(); currentEditingWidgets.push(JSON.parse(JSON.stringify(defs[k]))); renderCanvasWidgets(); });
    });
  }

  function renderCanvasWidgets() {
    const canvas = document.getElementById('builder-editor-canvas'); if (!canvas) return;
    if (!currentEditingWidgets.length) { canvas.innerHTML = '<div class="canvas-empty-state"><i class="fa-solid fa-cubes"></i><p>No widgets. Click shelf to add.</p></div>'; return; }
    canvas.innerHTML = '';
    currentEditingWidgets.forEach((w, i) => {
      const card = document.createElement('div');
      card.className = 'widget-card'; card.setAttribute('data-index', i);
      card.innerHTML = `<div class="widget-card-header"><div class="widget-title-area"><span>${w.type} widget</span></div><div class="widget-actions"><button type="button" class="widget-btn btn-up"><i class="fa-solid fa-arrow-up"></i></button><button type="button" class="widget-btn btn-down"><i class="fa-solid fa-arrow-down"></i></button><button type="button" class="widget-btn btn-delete"><i class="fa-solid fa-trash"></i></button></div></div><div class="widget-card-body">${buildIweWidgetBody(w)}</div>`;
      card.querySelector('.btn-up').onclick    = () => { readCanvasState(); if(i>0){[currentEditingWidgets[i],currentEditingWidgets[i-1]]=[currentEditingWidgets[i-1],currentEditingWidgets[i]]; renderCanvasWidgets();} };
      card.querySelector('.btn-down').onclick  = () => { readCanvasState(); if(i<currentEditingWidgets.length-1){[currentEditingWidgets[i],currentEditingWidgets[i+1]]=[currentEditingWidgets[i+1],currentEditingWidgets[i]]; renderCanvasWidgets();} };
      card.querySelector('.btn-delete').onclick= () => { if(confirm('Delete widget?')){ readCanvasState(); currentEditingWidgets.splice(i,1); renderCanvasWidgets(); } };
      canvas.appendChild(card);
    });
  }

  function readCanvasState() {
    document.querySelectorAll('#builder-editor-canvas .widget-card').forEach(card => {
      const i=+card.getAttribute('data-index'), w=currentEditingWidgets[i]; if(!w) return;
      card.querySelectorAll('.widget-input').forEach(inp => {
        const f=inp.getAttribute('data-field'),v=inp.value;
        if(f==='items') w.items=v.split('\n').filter(l=>l.trim()).map(l=>{const[url,cap]=l.split('|');return{url:(url||'').trim(),caption:(cap||'').trim()};});
        else if(f==='stats') w.stats=v.split('\n').filter(l=>l.includes('|')).map(l=>{const[val,lbl]=l.split('|');return{value:val.trim(),label:(lbl||'').trim()};});
        else if(f==='table'){const lines=v.split('\n').filter(l=>l.trim());w.headers=(lines[0]||'').split('|').map(c=>c.trim());w.rows=lines.slice(1).map(l=>l.split('|').map(c=>c.trim()));}
        else w[f]=v;
      });
    });
  }

  function saveBuilderPage() {
    readCanvasState();
    const sel   = document.getElementById('builder-page-sel');
    const isNew = sel.value === '__new__';
    let pageId  = isNew ? (document.getElementById('builder-id')?.value||'').trim().toLowerCase().replace(/[^a-z0-9_-]/g,'') : sel.value;
    if (!pageId) { alert('Enter a valid Page ID.'); return; }
    const title = document.getElementById('builder-title')?.value||''; if (!title) { alert('Enter a page title.'); return; }
    if (isNew && xmlDatabase.querySelector(`page[id="${pageId}"]`)) { alert('Page ID already exists.'); return; }

    let pagesNode = xmlDatabase.querySelector('pages');
    if (!pagesNode) { pagesNode = xmlDatabase.createElement('pages'); xmlDatabase.querySelector('elemental_empire')?.appendChild(pagesNode); }
    let pageNode = isNew ? (() => { const n=xmlDatabase.createElement('page'); n.setAttribute('id',pageId); pagesNode.appendChild(n); return n; })() : xmlDatabase.querySelector(`page[id="${pageId}"]`);

    pageNode.setAttribute('icon', document.getElementById('builder-icon')?.value||'fa-solid fa-file');
    const parent = document.getElementById('builder-page-parent')?.value || document.getElementById('builder-parent')?.value || '';
    if (parent) pageNode.setAttribute('parent', parent); else pageNode.removeAttribute('parent');
    setXmlField(pageNode, 'title',      title);
    setXmlField(pageNode, 'subtitle',   document.getElementById('builder-subtitle')?.value||'');
    setXmlField(pageNode, 'content',    document.getElementById('builder-raw')?.value||'');
    setXmlField(pageNode, 'custom_css', document.getElementById('builder-css')?.value||'');
    setXmlField(pageNode, 'custom_js',  document.getElementById('builder-js')?.value||'');
    saveWidgetsToPage(pageNode, currentEditingWidgets);
    saveDatabase(); showToast(`Page "${title}" saved.`);
    if (isNew) { activeTab = pageId; }
    setupNavigation(); renderAdminView();
  }

  function deleteBuilderPage() {
    const id = document.getElementById('builder-page-sel')?.value;
    if (['home','history','allies','protocols'].includes(id)) { alert('Cannot delete core pages.'); return; }
    if (confirm(`Delete page "${id}" permanently?`)) {
      xmlDatabase.querySelector(`page[id="${id}"]`)?.remove();
      saveDatabase(); showToast(`Deleted "${id}".`); activeTab='home';
      setupNavigation(); renderAdminView();
    }
  }

  /* ====================================================================
     22. USER & ROLE REGISTRY TABLES
     ==================================================================== */
  function renderUserRegistryTable() {
    const tbody = document.getElementById('user-registry-tbody'); if (!tbody) return;
    tbody.innerHTML = '';
    usersList.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escHtml(u.username)}</td><td><span class="user-badge role-${u.role}">${u.role==='root'?'Root Admin':'Standard'}</span></td><td><button type="button" class="btn btn-danger delete-user-btn" data-username="${escHtml(u.username)}" style="padding:4px 8px;font-size:10px;" ${u.username===loggedInUser?'disabled':''}><i class="fa-solid fa-user-xmark"></i> Remove</button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.delete-user-btn:not([disabled])').forEach(btn => btn.addEventListener('click', () => {
      const un = btn.getAttribute('data-username');
      if (confirm(`Remove admin "${un}"?`)) { usersList=usersList.filter(u=>u.username!==un); saveUsersToXml(); saveDatabase(); showToast(`Removed "${un}".`); renderUserRegistryTable(); }
    }));
  }

  function saveUsersToXml() {
    let sec = xmlDatabase.querySelector('meta security');
    if (!sec) { sec=xmlDatabase.createElement('security'); xmlDatabase.querySelector('meta')?.appendChild(sec); }
    sec.querySelector('users')?.remove();
    const usersNode = xmlDatabase.createElement('users');
    usersList.forEach(u => { const un=xmlDatabase.createElement('user'); setXmlField(un,'username',u.username); setXmlField(un,'password',u.password); setXmlField(un,'role',u.role); usersNode.appendChild(un); });
    sec.appendChild(usersNode);
  }

  function renderRoleRegistryTable() {
    const tbody = document.getElementById('role-registry-tbody'); if (!tbody) return;
    const roles = Array.from(xmlDatabase.querySelectorAll('discord_roles role')).sort((a,b)=>parseInt(a.getAttribute('priority')||99)-parseInt(b.getAttribute('priority')||99));
    tbody.innerHTML = '';
    roles.forEach((role, idx) => {
      const nm  = role.querySelector('name')?.textContent||'';
      const rid = role.querySelector('discord_id')?.textContent||'';
      const col = role.getAttribute('color')||'#6b7280';
      const pri = role.getAttribute('priority')||'';
      const tr  = document.createElement('tr');
      tr.innerHTML = `<td>${pri}</td><td><span class="role-badge" style="background:${col}22;color:${col};border:1px solid ${col}55;">${escHtml(nm)}</span></td><td><code style="font-size:10px;">${escHtml(rid)}</code></td><td><span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${col};vertical-align:middle;"></span></td><td><button type="button" class="btn btn-danger del-role-btn" data-index="${idx}" style="padding:4px 8px;font-size:10px;"><i class="fa-solid fa-trash"></i></button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.del-role-btn').forEach(btn => btn.addEventListener('click', () => {
      const idx = +btn.getAttribute('data-index');
      if (confirm(`Delete role "${roles[idx]?.querySelector('name')?.textContent}"?`)) { roles[idx].remove(); saveDatabase(); showToast('Role removed.'); renderRoleRegistryTable(); }
    }));
  }

  /* ====================================================================
     23. HELPERS
     ==================================================================== */
  function setXmlField(node, tag, value) {
    if (!node) return;
    let el = node.querySelector(tag);
    if (!el) { el = xmlDatabase.createElement(tag); node.appendChild(el); }
    el.textContent = value;
  }

  function bindGalleryLightbox() {
    contentViewport.querySelectorAll('.gallery-item-img').forEach(img => {
      img.style.cursor = 'pointer';
      img.addEventListener('click', () => openLightbox(img.src, img.getAttribute('data-caption')));
    });
  }

  function bindWikiLinks() {
    contentViewport.querySelectorAll('.wiki-internal-link:not([data-bound])').forEach(l => {
      l.setAttribute('data-bound','true');
      l.addEventListener('click', e => { e.preventDefault(); activeTab=l.getAttribute('data-target'); setupNavigation(); renderActiveTab(); });
    });
  }

  function showToast(msg) {
    const t = document.getElementById('toast'); const m = document.getElementById('toast-message');
    if (!t||!m) return;
    m.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  }

  function formatXml(xml) {
    let f='', pad=0;
    xml.replace(/(>)(<)(\/*)/g,'$1\r\n$2$3').split('\r\n').forEach(node => {
      let indent=0;
      if (node.match(/.+<\/\w+>/)) indent=0;
      else if (node.match(/<\/\w/)) { if (pad!==0) pad--; }
      else if (node.match(/<\w[^>]*[^/]>/)) indent=1;
      f += '  '.repeat(pad) + node + '\r\n';
      pad += indent;
    });
    return f.trim();
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function generateFallbackXML() {
    return new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?><elemental_empire><meta><title>Elemental Empire</title><founded>May 5, 2023</founded><members>1,200+</members><era>Triumvirate</era><lockdown_status>green</lockdown_status><security><root_password>9dc7a8f5701f54f0722bc4d467b5082b46398bcb612b0a5835e00b63750a7249</root_password><standard_password>bf91904099df59fedea45e81b7e41614f64ddd696baa49b9e9f55976e443f0a5</standard_password></security></meta><pages><page id="home" icon="fa-solid fa-house-chimney"><title>Empire Archives</title><subtitle>"Loyalty Before Power"</subtitle><content>Database could not be loaded. Please reload.</content></page><page id="history" icon="fa-solid fa-book-bookmark"><title>Empire History</title></page><page id="allies" icon="fa-solid fa-handshake"><title>Allies</title></page><page id="protocols" icon="fa-solid fa-scale-balanced"><title>Protocols</title></page></pages><leaders></leaders><bases></bases><wars></wars><timeline></timeline><players></players><discord_roles></discord_roles></elemental_empire>`, 'text/xml');
  }

  /* ====================================================================
     24. PARTICLES SYSTEM
     ==================================================================== */
  function initParticles() {
    const canvas = document.getElementById('particleCanvas'); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    const mouse = {x:null,y:null,radius:150};

    window.addEventListener('mousemove', e => { mouse.x=e.x; mouse.y=e.y; });
    window.addEventListener('mouseout',  () => { mouse.x=null; mouse.y=null; });

    class Particle {
      constructor(x,y,vx,vy,size,color) { this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.size=this.baseSize=size; this.color=color; }
      getColor() {
        if (currentLockdownState==='yellow') return `rgba(255,${160+Math.random()*50|0},0,0.45)`;
        if (currentLockdownState==='red')    return `rgba(${220+Math.random()*35|0},${Math.random()*60|0},${Math.random()*20|0},0.55)`;
        return this.color;
      }
      draw() { ctx.beginPath(); ctx.arc(this.x,this.y,this.size,0,Math.PI*2); const c=this.getColor(); ctx.fillStyle=c; ctx.shadowColor=c; ctx.shadowBlur=10; ctx.fill(); ctx.shadowBlur=0; }
      update() {
        if (this.x<0||this.x>canvas.width)  this.vx=-this.vx;
        if (this.y<0||this.y>canvas.height) this.vy=-this.vy;
        const sm = currentLockdownState==='yellow'?1.8:currentLockdownState==='red'?3.5:1;
        this.x+=this.vx*sm; this.y+=this.vy*sm;
        if (mouse.x!==null) {
          const dx=mouse.x-this.x,dy=mouse.y-this.y,dist=Math.hypot(dx,dy);
          if (dist<mouse.radius) { const f=(mouse.radius-dist)/mouse.radius; this.x+=dx/dist*f*1.5; this.y+=dy/dist*f*1.5; this.size=this.baseSize*(1+f*0.8); }
          else if (this.size>this.baseSize) this.size-=0.1;
        } else if (this.size>this.baseSize) this.size-=0.1;
        this.draw();
      }
    }

    function create() {
      particles = [];
      const count = Math.min(Math.floor(canvas.width*canvas.height/18000), 85);
      const colors = ['rgba(239,68,68,0.25)','rgba(6,182,212,0.25)','rgba(16,185,129,0.25)','rgba(168,85,247,0.25)'];
      for (let k=0;k<count;k++) { const s=Math.random()*4+2; particles.push(new Particle(Math.random()*(canvas.width-s*2)+s,Math.random()*(canvas.height-s*2)+s,(Math.random()-.5)*.4,(Math.random()-.5)*.4,s,colors[k%colors.length])); }
    }

    function animate() { ctx.clearRect(0,0,canvas.width,canvas.height); particles.forEach(p=>p.update()); requestAnimationFrame(animate); }
    function resize() { canvas.width=window.innerWidth; canvas.height=window.innerHeight; create(); }
    window.addEventListener('resize', resize); resize(); animate();
  }

});
