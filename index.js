const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Prevent browser caching so edits show immediately
app.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  next();
});

const DATA_FILE = path.join(__dirname, 'data.json');

const defaultData = {
  masterRedirect: 'https://gooqlc.com/111z',
  dividerTitle: 'CUSTOM LINKS',
  top: [
    { id: '1', title: 'Google', url: 'https://google.com' },
    { id: '2', title: 'Predict and Peek', url: 'https://www.icloud.com/shortcuts/' }
  ],
  custom: [
    { id: '3', title: 'Inject', url: 'https://example.com' },
    { id: '4', title: 'Contact Peek', url: 'https://example.com' }
  ]
};

function getPortalData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    return defaultData;
  }
}

function savePortalData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Serve static assets from public/
app.use(express.static(path.join(__dirname, 'public')));

// Spectator Page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin Dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API: Get complete config
app.get('/api/portal', (req, res) => {
  res.status(200).json({ success: true, ...getPortalData() });
});

// API: Save full configuration from Admin UI
app.post('/api/save', (req, res) => {
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
});

// API: Quick update for a single link (supports Shortcuts)
app.all('/api/update-link', (req, res) => {
  const id = req.body?.id || req.query?.id;
  const newTitle = req.body?.title || req.query?.title;
  const newUrl = req.body?.url || req.query?.url;

  if (!id) {
    return res.status(400).json({ success: false, error: 'Missing button id' });
  }

  const data = getPortalData();
  const target = [...data.top, ...data.custom].find(item => item.id === String(id));

  if (!target) {
    return res.status(404).json({ success: false, error: 'Link ID not found' });
  }

  if (newTitle) target.title = newTitle;
  if (newUrl) target.url = newUrl;

  savePortalData(data);
  return res.status(200).json({ success: true, updated: target });
});

// API: Fast master redirect update (supports Shortcuts)
app.all('/api/set-redirect', (req, res) => {
  const newUrl = req.body?.url || req.query?.url;
  if (!newUrl) {
    return res.status(400).json({ success: false, error: 'Missing url parameter' });
  }

  const data = getPortalData();
  data.masterRedirect = newUrl;
  savePortalData(data);

  return res.status(200).json({ success: true, masterRedirect: data.masterRedirect });
});

// API: Add new link
app.all('/api/add-link', (req, res) => {
  const title = req.body?.title || req.query?.title || 'New Link';
  const url = req.body?.url || req.query?.url || 'https://google.com';
  const section = req.body?.section || req.query?.section || 'custom';

  const data = getPortalData();
  const newId = String(Date.now()).slice(-4);
  const newLink = { id: newId, title, url };

  if (section === 'top') {
    data.top.push(newLink);
  } else {
    data.custom.push(newLink);
  }

  savePortalData(data);
  return res.status(200).json({ success: true, added: newLink, data });
});

// API: Delete link
app.all('/api/delete-link', (req, res) => {
  const id = req.body?.id || req.query?.id;
  if (!id) {
    return res.status(400).json({ success: false, error: 'Missing id' });
  }

  const data = getPortalData();
  data.top = data.top.filter(item => item.id !== String(id));
  data.custom = data.custom.filter(item => item.id !== String(id));

  savePortalData(data);
  return res.status(200).json({ success: true, message: `Deleted link ${id}` });
});

// Direct bounce route
app.get('/go', (req, res) => {
  const data = getPortalData();
  res.redirect(302, data.masterRedirect);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
