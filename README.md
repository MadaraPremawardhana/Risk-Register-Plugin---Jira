# 🛡️ RiskRadar — Jira Risk Analyzer Chrome Extension

Automated AI-powered risk analysis and risk register for Jira tasks, built with Claude AI.

---

## ✨ Features

- **AI Risk Analysis** — Claude analyzes Jira tasks and generates structured risk assessments
- **Likelihood × Impact Scoring** — 1–5 scale with visual score bars
- **Risk Identification** — Up to 4 specific risks per task
- **Mitigation Strategies** — Actionable recommendations
- **Risk Register** — Persistent store of all analyzed tasks with filters
- **CSV Export** — One-click export for reporting
- **In-page Risk Badge** — Visual risk indicator overlaid on Jira issue pages
- **Multiple Frameworks** — Standard, ISO 31000, and PMBOK

---

## 📦 Installation

### Step 1: Get the extension files
Download or clone this folder (`jira-risk-analyzer/`).

### Step 2: Create icons
You need icon files at `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`.  
You can use any simple PNG icons or generate them from a tool like https://realfavicongenerator.net

### Step 3: Load in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer Mode** (top-right toggle)
3. Click **Load Unpacked**
4. Select the `jira-risk-analyzer/` folder
5. The extension will appear in your toolbar

### Step 4: Configure
1. Click the RiskRadar icon in your Chrome toolbar
2. Go to **Settings** (⚙ Config)
3. Enter your **Anthropic API key** (get one at https://console.anthropic.com)
4. Choose your preferred AI model
5. Click **Save Configuration**

---

## 🚀 Usage

### Analyzing a Task
1. Navigate to any Jira issue page (`*.atlassian.net/browse/PROJ-123`)
2. Click the RiskRadar extension icon
3. The current task will be detected automatically
4. Click **⚡ Analyze Risk with AI**
5. Review the risk assessment
6. Click **+ Save to Risk Register** to keep it

### Risk Register
- Click the **Risk Register** tab to see all saved risks
- Filter by risk level (Critical / High / Medium / Low)
- Click any entry to expand details
- Use **⬇ Export CSV** for reporting

### In-Page Badge
Once a task is saved, a risk badge automatically appears when you visit that Jira issue.

---

## 🔧 Configuration Options

| Setting | Description |
|---------|-------------|
| Anthropic API Key | Your secret key from console.anthropic.com |
| AI Model | Sonnet 4.6 (recommended), Haiku 4.5 (faster), Opus 4.6 (most capable) |
| Risk Framework | Standard, ISO 31000, or PMBOK |

---

## 🏗️ File Structure

```
jira-risk-analyzer/
├── manifest.json          # Extension manifest (MV3)
├── popup.html             # Main popup UI
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── src/
    ├── popup.js           # Popup logic + AI calls
    ├── content.js         # In-page risk badge
    ├── content.css        # Content styles
    └── background.js      # Service worker
```

---

## 🔒 Privacy & Security

- Your Anthropic API key is stored locally in Chrome's encrypted storage
- Task data is only sent to Anthropic's API for analysis
- The risk register is stored locally in Chrome — no external servers
- No analytics or telemetry

---

## 🛠️ Customization

**Add more risk frameworks:**  
Edit the `prompt` in `src/popup.js` inside `callClaudeAPI()` to add your own risk methodology.

**Change the scoring scale:**  
Modify the risk level mapping in the prompt (currently: 1-4=low, 5-9=medium, 10-14=high, 15-25=critical).

**Adjust what data is extracted:**  
Edit the `extractJiraTask()` function in `src/popup.js` to capture additional Jira fields.

---

## 🐛 Troubleshooting

**"No Jira task detected"**  
Make sure you're on an issue page URL like `https://yourcompany.atlassian.net/browse/PROJ-123`

**API errors**  
- Verify your API key is correct and has credits
- Check that your organization allows API access from extensions

**Task data missing**  
Jira's DOM can vary. The extension uses multiple selectors to handle different Jira versions. If fields are missing, the AI will still analyze based on what's available.
