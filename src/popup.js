// ── STATE ────────────────────────────────────────────────────────
let currentTask = null;
let currentAnalysis = null;
let activeFilter = 'all';

// ── INIT — wire all events here, no inline onclick anywhere ──────
document.addEventListener('DOMContentLoaded', async () => {
  // Tab buttons
  document.getElementById('tab-analyze').addEventListener('click', () => showTab('analyze'));
  document.getElementById('tab-register').addEventListener('click', () => showTab('register'));
  document.getElementById('tab-settings').addEventListener('click', () => showTab('settings'));
  document.getElementById('headerSettingsBtn').addEventListener('click', () => showTab('settings'));

  // Action buttons
  document.getElementById('analyzeBtn').addEventListener('click', analyzeTask);
  document.getElementById('saveBtn').addEventListener('click', saveToRegister);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('exportBtn').addEventListener('click', exportCSV);

  // Filter buttons (use event delegation on the row)
  document.getElementById('filterRow').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    const filter = btn.dataset.filter;
    activeFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderRegister();
  });

  await loadSettings();
  await detectCurrentTask();
  renderRegister();
});

// ── TAB NAVIGATION ───────────────────────────────────────────────
function showTab(tab) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'register') renderRegister();
}

// ── SETTINGS ─────────────────────────────────────────────────────
async function loadSettings() {
  const { apiKey, model, framework } = await chrome.storage.local.get(['apiKey', 'model', 'framework']);
  if (apiKey) document.getElementById('apiKey').value = apiKey;
  if (model) document.getElementById('modelSelect').value = model;
  if (framework) document.getElementById('frameworkSelect').value = framework;
  updateStatus(apiKey ? 'ready' : 'warn', apiKey ? 'Ready' : 'API key not configured — click ⚙ Config');
}

async function saveSettings() {
  const apiKey = document.getElementById('apiKey').value.trim();
  const model = document.getElementById('modelSelect').value;
  const framework = document.getElementById('frameworkSelect').value;
  await chrome.storage.local.set({ apiKey, model, framework });
  showAlert('settingsAlert', 'Settings saved!', 'success');
  updateStatus(apiKey ? 'ready' : 'warn', apiKey ? 'Ready' : 'API key not configured');
}

// ── STATUS ───────────────────────────────────────────────────────
function updateStatus(state, text) {
  const dot = document.getElementById('statusDot');
  dot.className = 'status-dot' + (state === 'warn' ? ' warn' : state === 'error' ? ' error' : '');
  document.getElementById('statusText').textContent = text;
}

function showAlert(id, msg, type) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = 'alert ' + (type === 'success' ? 'success' : 'error-msg');
  setTimeout(() => { el.className = 'alert'; }, 3000);
}

// ── TASK DETECTION ───────────────────────────────────────────────
async function detectCurrentTask() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url || '';

    if (!url.includes('atlassian.net')) {
      setNoTask('Navigate to a Jira issue page');
      return;
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractJiraTask
    });

    const task = result?.result;
    if (task?.key) {
      currentTask = task;
      renderTaskPreview(task);
      document.getElementById('analyzeBtn').disabled = false;
      updateStatus('ready', 'Detected: ' + task.key);
    } else {
      setNoTask('Open a specific Jira issue (e.g. /browse/PROJ-123)');
    }
  } catch (e) {
    setNoTask('Cannot access this tab');
  }
}

function setNoTask(reason) {
  updateStatus('warn', reason || 'No Jira task detected');
  document.getElementById('analyzeBtn').disabled = true;
}

function renderTaskPreview(task) {
  const TYPE_COLORS = { Bug: '#ff4d6d', Story: '#22c55e', Task: '#06b6d4', Epic: '#7c3aed', Subtask: '#f59e0b' };
  const color = TYPE_COLORS[task.type] || '#888899';
  document.getElementById('taskPreview').innerHTML =
    '<div class="task-preview-label">Current Task</div>' +
    '<div class="task-key">' + escapeHtml(task.key) + '</div>' +
    '<div class="task-title">' + escapeHtml(task.title || 'Untitled') + '</div>' +
    '<div class="task-meta">' +
      '<span class="badge" style="color:' + color + ';border-color:' + color + ';background:' + color + '22">' + escapeHtml(task.type || 'Task') + '</span>' +
      (task.priority ? '<span class="badge" style="color:var(--text-dim);border-color:var(--border)">P: ' + escapeHtml(task.priority) + '</span>' : '') +
      (task.storyPoints ? '<span class="badge" style="color:var(--accent3);border-color:var(--accent3)33">' + task.storyPoints + ' pts</span>' : '') +
      (task.labels?.[0] ? '<span class="badge" style="color:var(--accent2);border-color:var(--accent2)33">' + escapeHtml(task.labels[0]) + '</span>' : '') +
    '</div>';
}

// ── JIRA DOM EXTRACTION (injected into page — must be self-contained) ──
function extractJiraTask() {
  function first(selectors) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        const text = el?.innerText?.trim() || el?.textContent?.trim() || el?.getAttribute('aria-label')?.trim();
        if (text) return text;
      } catch {}
    }
    return '';
  }

  const key = location.pathname.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/)?.[1]
    || location.pathname.match(/\/issues\/([A-Z][A-Z0-9]+-\d+)/)?.[1]
    || first([
        '[data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]',
        '#issuekey-val',
      ]).match(/[A-Z][A-Z0-9]+-\d+/)?.[0]
    || '';

  const title = first([
    'h1[data-testid="issue.views.issue-base.foundation.summary.heading"]',
    '[data-testid*="summary"] h1',
    '[data-testid="issue-title"]',
    '#summary-val',
    'h1',
  ]);

  let description = '';
  const descEl = document.querySelector(
    '[data-testid="issue.views.issue-base.foundation.description.description"], ' +
    '[data-testid="issue-description"], #description-val, .description .user-content-block'
  );
  if (descEl) description = (descEl.innerText || descEl.textContent || '').trim();

  const type = first([
    '[data-testid="issue.views.issue-base.foundation.change-issue-type.type-icon"] img[alt]',
    '[data-testid*="issuetype"] span',
    '[data-testid*="issue-type"] span',
    '#type-val',
  ]);

  const priority = first([
    '[data-testid*="priority-field"] span',
    '[data-testid*="priority"] span',
    '#priority-val',
  ]);

  const storyPoints = first([
    '[data-testid*="story-point"] span',
    '#customfield_10016-val',
  ]);

  const labelNodes = document.querySelectorAll(
    '[data-testid*="label"] a, [data-testid*="labels"] span, .labels .label'
  );
  const labels = [...new Set([...labelNodes].map(n => n.textContent.trim()).filter(Boolean))].slice(0, 6);

  return { key, title: title.slice(0, 200), description: description.slice(0, 2000), type, priority, labels, storyPoints };
}

// ── AI ANALYSIS ──────────────────────────────────────────────────
async function analyzeTask() {
  const { apiKey, model, framework } = await chrome.storage.local.get(['apiKey', 'model', 'framework']);

  if (!apiKey) {
    showTab('settings');
    showAlert('settingsAlert', 'Enter your Anthropic API key first', 'error');
    return;
  }
  if (!currentTask) return;

  const btn = document.getElementById('analyzeBtn');
  btn.classList.add('loading');
  btn.disabled = true;
  document.getElementById('riskResult').classList.remove('visible');
  updateStatus('ready', 'Analyzing...');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'ANALYZE_RISK',
      payload: {
        apiKey,
        model: model || 'claude-sonnet-4-6',
        task: currentTask,
        framework: framework || 'standard'
      }
    });

    if (!response?.ok) throw new Error(response?.error || 'Unknown error');

    currentAnalysis = response.data;
    renderAnalysis(currentAnalysis);
    updateStatus('ready', 'Analysis complete');
  } catch (e) {
    updateStatus('error', e.message || 'Analysis failed');
    showTab('settings');
    showAlert('settingsAlert', e.message || 'Analysis failed — check API key', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ── RENDER ANALYSIS ──────────────────────────────────────────────
function renderAnalysis(a) {
  const COLORS = { critical: 'var(--critical)', high: 'var(--high)', medium: 'var(--medium)', low: 'var(--low)' };
  const color = COLORS[a.level] || 'var(--text)';

  document.getElementById('riskBadge').textContent = a.level.toUpperCase();
  document.getElementById('riskBadge').className = 'risk-badge ' + a.level;
  document.getElementById('riskScore').textContent = 'Score: ' + a.score + '/25';

  [['scoreL', 'fillL', a.likelihood], ['scoreI', 'fillI', a.impact]].forEach(([id, fill, val]) => {
    const el = document.getElementById(id);
    el.textContent = val;
    el.style.color = color;
    const bar = document.getElementById(fill);
    bar.style.width = (val / 5 * 100) + '%';
    bar.style.background = color;
  });

  document.getElementById('risksList').innerHTML =
    (a.risks || []).map(r => '<div class="risk-item">' + escapeHtml(r) + '</div>').join('');
  document.getElementById('mitigationsList').innerHTML =
    (a.mitigations || []).map(m => '<div class="mitigation-item">' + escapeHtml(m) + '</div>').join('');

  document.getElementById('riskResult').classList.add('visible');
}

// ── SAVE TO REGISTER ─────────────────────────────────────────────
async function saveToRegister() {
  if (!currentTask || !currentAnalysis) return;

  const { riskRegister = [] } = await chrome.storage.local.get('riskRegister');
  const entry = {
    ...currentTask,
    analysis: currentAnalysis,
    savedAt: new Date().toISOString(),
    id: currentTask.key + '_' + Date.now()
  };

  const idx = riskRegister.findIndex(r => r.key === currentTask.key);
  if (idx >= 0) riskRegister[idx] = entry;
  else riskRegister.unshift(entry);

  await chrome.storage.local.set({ riskRegister });

  const btn = document.getElementById('saveBtn');
  btn.textContent = '✓ Saved!';
  btn.style.cssText = 'color:var(--low);border-color:var(--low)';
  setTimeout(() => { btn.textContent = '+ Save to Risk Register'; btn.style.cssText = ''; }, 2000);
}

// ── RISK REGISTER ────────────────────────────────────────────────
async function renderRegister() {
  const { riskRegister = [] } = await chrome.storage.local.get('riskRegister');
  const container = document.getElementById('registerContainer');

  if (!riskRegister.length) {
    document.getElementById('summaryBar').style.display = 'none';
    document.getElementById('filterRow').style.display = 'none';
    container.innerHTML =
      '<div class="register-empty"><div class="empty-icon">📋</div>No risks saved yet.<br>' +
      '<span style="font-size:10px;opacity:.6">Analyze a task and save it here.</span></div>';
    return;
  }

  document.getElementById('summaryBar').style.display = 'grid';
  document.getElementById('filterRow').style.display = 'flex';
  document.getElementById('sumTotal').textContent = riskRegister.length;
  ['Critical', 'High', 'Medium'].forEach(l => {
    document.getElementById('sum' + l).textContent =
      riskRegister.filter(r => r.analysis.level === l.toLowerCase()).length;
  });

  const filtered = activeFilter === 'all'
    ? riskRegister
    : riskRegister.filter(r => r.analysis.level === activeFilter);

  if (!filtered.length) {
    container.innerHTML = '<div class="register-empty"><div class="empty-icon">🔍</div>No ' + activeFilter + ' risks found.</div>';
    return;
  }

  container.innerHTML = '<div class="register-list">' + filtered.map(renderRegisterItem).join('') + '</div>';

  // Wire up delete and expand buttons after rendering
  container.querySelectorAll('.register-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // Don't toggle if clicking delete
      if (e.target.closest('.delete-btn')) return;
      const id = item.dataset.id;
      const detail = document.getElementById('detail-' + id);
      if (detail) detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
    });
  });

  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteEntry(btn.dataset.id);
    });
  });
}

function renderRegisterItem(r) {
  const a = r.analysis;
  const date = new Date(r.savedAt).toLocaleDateString();
  return (
    '<div class="register-item ' + a.level + '" data-id="' + escapeHtml(r.id) + '">' +
      '<div class="register-item-header">' +
        '<div>' +
          '<div class="register-item-key">' + escapeHtml(r.key) + '</div>' +
          '<div class="register-item-title">' + escapeHtml(r.title || 'Untitled') + '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:flex-start;gap:6px">' +
          '<span class="risk-badge ' + a.level + '" style="font-size:9px;padding:2px 6px">' + a.level.toUpperCase() + '</span>' +
          '<button class="delete-btn" data-id="' + escapeHtml(r.id) + '">✕</button>' +
        '</div>' +
      '</div>' +
      '<div class="register-item-meta">' +
        '<div class="register-item-scores"><span>L:' + a.likelihood + '</span><span>I:' + a.impact + '</span><span>Score:' + a.score + '/25</span></div>' +
        '<div class="register-item-date">' + date + '</div>' +
      '</div>' +
      '<div id="detail-' + escapeHtml(r.id) + '" style="display:none;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">' +
        (a.risks || []).slice(0, 3).map(t => '<div style="font-size:10px;color:var(--text);margin-bottom:3px">▸ ' + escapeHtml(t) + '</div>').join('') +
        '<div style="font-size:10px;color:var(--text-dim);margin:5px 0 3px">Mitigations:</div>' +
        (a.mitigations || []).slice(0, 3).map(m => '<div style="font-size:10px;color:var(--low);margin-bottom:3px">✓ ' + escapeHtml(m) + '</div>').join('') +
      '</div>' +
    '</div>'
  );
}

async function deleteEntry(id) {
  const { riskRegister = [] } = await chrome.storage.local.get('riskRegister');
  await chrome.storage.local.set({ riskRegister: riskRegister.filter(r => r.id !== id) });
  renderRegister();
}

// ── CSV EXPORT ───────────────────────────────────────────────────
async function exportCSV() {
  const { riskRegister = [] } = await chrome.storage.local.get('riskRegister');
  if (!riskRegister.length) return;

  const q = s => '"' + String(s || '').replace(/"/g, '""') + '"';
  const headers = ['Key', 'Title', 'Type', 'Priority', 'Risk Level', 'Likelihood', 'Impact', 'Score', 'Risks', 'Mitigations', 'Summary', 'Date'];
  const rows = riskRegister.map(r => [
    r.key, q(r.title), r.type || '', r.priority || '',
    r.analysis.level, r.analysis.likelihood, r.analysis.impact, r.analysis.score,
    q((r.analysis.risks || []).join('; ')),
    q((r.analysis.mitigations || []).join('; ')),
    q(r.analysis.summary),
    new Date(r.savedAt).toLocaleDateString()
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const filename = 'risk-register-' + new Date().toISOString().slice(0, 10) + '.csv';

  try {
    await chrome.downloads.download({ url, filename });
  } catch {
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
  }
}

// ── UTILS ────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
