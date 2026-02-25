// Content script - runs on Jira pages
// Adds a floating risk badge to issue pages

(function() {
  'use strict';

  let badgeEl = null;

  // Check if we're on an issue page
  function isIssuePage() {
    return /\/browse\/[A-Z]+-\d+/.test(window.location.pathname) ||
           /\/jira\/.*\/issues\/[A-Z]+-\d+/.test(window.location.pathname);
  }

  // Extract issue key from URL
  function getIssueKey() {
    const match = window.location.pathname.match(/\/browse\/([A-Z]+-\d+)/) ||
                  window.location.pathname.match(/\/issues\/([A-Z]+-\d+)/);
    return match?.[1] || null;
  }

  async function checkAndShowBadge() {
    if (!isIssuePage()) return;

    const key = getIssueKey();
    if (!key) return;

    // Check if this issue is in risk register
    const { riskRegister = [] } = await chrome.storage.local.get('riskRegister');
    const entry = riskRegister.find(r => r.key === key);

    if (entry) {
      showRiskBadge(entry);
    } else {
      removeBadge();
    }
  }

  function showRiskBadge(entry) {
    removeBadge();

    const level = entry.analysis.level;
    const colors = {
      critical: { bg: '#ff3a3a', text: '#fff' },
      high: { bg: '#ff7a00', text: '#fff' },
      medium: { bg: '#f5c518', text: '#000' },
      low: { bg: '#22c55e', text: '#fff' }
    };
    const c = colors[level] || colors.low;

    badgeEl = document.createElement('div');
    badgeEl.id = 'jira-risk-badge';
    badgeEl.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        background: #0a0a0f;
        border: 2px solid ${c.bg};
        border-radius: 10px;
        padding: 10px 14px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        color: #e8e8f0;
        box-shadow: 0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px ${c.bg}44;
        cursor: pointer;
        min-width: 180px;
        transition: transform 0.2s;
      " onmouseenter="this.style.transform='scale(1.02)'" onmouseleave="this.style.transform='scale(1)'">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px">
          <span style="
            background: ${c.bg};
            color: ${c.text};
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 700;
            font-size: 10px;
            letter-spacing: 0.5px;
          ">⚠ ${level.toUpperCase()} RISK</span>
          <span style="color:#888899; font-size:10px">Score: ${entry.analysis.score}/25</span>
        </div>
        <div style="display:flex; gap:12px; font-size:10px; color:#888899">
          <span>Likelihood: <strong style="color:#e8e8f0">${entry.analysis.likelihood}/5</strong></span>
          <span>Impact: <strong style="color:#e8e8f0">${entry.analysis.impact}/5</strong></span>
        </div>
        ${entry.analysis.summary ? `<div style="margin-top:6px; font-size:10px; color:#888899; line-height:1.4; border-top: 1px solid #2a2a3a; padding-top: 6px">${entry.analysis.summary}</div>` : ''}
      </div>
    `;

    document.body.appendChild(badgeEl);
  }

  function removeBadge() {
    if (badgeEl) {
      badgeEl.remove();
      badgeEl = null;
    }
    const existing = document.getElementById('jira-risk-badge');
    if (existing) existing.remove();
  }

  // Watch for navigation changes (Jira uses SPA routing)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(checkAndShowBadge, 1000); // Wait for page to render
    }
  }).observe(document, { subtree: true, childList: true });

  // Initial check
  setTimeout(checkAndShowBadge, 1500);

  // Listen for storage changes (when user saves a risk)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.riskRegister) {
      checkAndShowBadge();
    }
  });
})();
