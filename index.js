const express = require('express');
const app = express();

app.use(express.json({ limit: '10mb' }));

let latestSubmission = {
    personal_info_b64: null,
    phone_number_b64: null,
    timestamp: null
};

app.post('/api/submit', (req, res) => {
    try {
        const { personal_info_b64, phone_number_b64 } = req.body;
        if (!personal_info_b64 || !phone_number_b64) {
            return res.status(400).json({ success: false, error: 'Missing fields' });
        }
        latestSubmission = { personal_info_b64, phone_number_b64, timestamp: Date.now() };
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
        timestamp: latestSubmission.timestamp
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
