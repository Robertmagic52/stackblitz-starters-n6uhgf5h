const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json());

// Write to the OS temporary directory (the ONLY writable folder on Vercel)
const DATA_FILE = path.join(os.tmpdir(), 'portal-data.json');

// In-memory store (ensures endpoints never crash even if filesystem fails)
let memoryStore = {
  masterRedirect: 'https://www.apple.com',
  dividerTitle: 'CUSTOM LINKS',
  top: [
    { id: '1', title: 'Peek', url: 'https://www.icloud.com/shortcuts/' },
    { id: '2', title: 'Predict and Peek', url: 'https://www.icloud.com/shortcuts/' }
  ],
  custom: [
    { id: '3', title: 'Inject', url: 'https://example.com' },
    { id: '4', title: 'Contact Peek', url: 'https://example.com' }
  ]
};

// Safe Read
function getPortalData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
      memoryStore = JSON.parse(fileContent);
    }
  } catch (err) {
    console.warn('Could not read from disk, using memory store');
  }
  return memoryStore;
}

// Safe Write
function savePortalData(data) {
  memoryStore = data;
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn('Failed to write to /tmp, keeping in memory only:', err.message);
  }
}

// Spectator Page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Admin Page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Fetch current config
app.get('/api/portal', (req, res) => {
  res.status(200).json({ success: true, ...getPortalData() });
});

// Save whole layout from /admin
app.post('/api/save', (req, res) => {
  try {
    const { masterRedirect, dividerTitle, top, custom } = req.body;
    const current = getPortalData();

    const updated = {
      masterRedirect: masterRedirect || current.masterRedirect,
      dividerTitle: dividerTitle !== undefined ? dividerTitle : current.dividerTitle,
      top: Array.isArray(top) ? top : current.top,
      custom: Array.isArray(custom) ? custom : current.custom
    };

    savePortalData(updated);
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Quick shortcut update for single link
app.all('/api/update-link', (req, res) => {
  try {
    const id = req.body?.id || req.query?.id;
    const newTitle = req.body?.title || req.query?.title;
    const newUrl = req.body?.url || req.query?.url;

    const data = getPortalData();
    const target = [...data.top, ...data.custom].find(item => item.id === String(id));

    if (!target) {
      return res.status(404).json({ success: false, error: 'Link ID not found' });
    }

    if (newTitle) target.title = newTitle;
    if (newUrl) target.url = newUrl;

    savePortalData(data);
    return res.status(200).json({ success: true, updated: target });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Quick shortcut update for master redirect
app.all('/api/set-redirect', (req, res) => {
  try {
    const newUrl = req.body?.url || req.query?.url;
    if (!newUrl) {
      return res.status(400).json({ success: false, error: 'Missing url parameter' });
    }

    const data = getPortalData();
    data.masterRedirect = newUrl;
    savePortalData(data);

    return res.status(200).json({ success: true, masterRedirect: data.masterRedirect });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Instant Bounce
app.get('/go', (req, res) => {
  const data = getPortalData();
  res.redirect(302, data.masterRedirect);
});

const PORT
