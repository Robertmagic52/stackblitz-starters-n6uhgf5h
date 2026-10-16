const express = require('express');
const app = express();

// Increase JSON body size limit to 10MB for images
app.use(express.json({ limit: '10mb' }));

// In-memory store for the latest submission 
// (Note: If your server restarts, this resets. For permanent storage, connect a database later)
let latestSubmission = {
    personal_info_b64: null,
    phone_number_b64: null,
    timestamp: null
};

// 1. Shortcut A: POST endpoint to receive and store the Base64 screenshots
app.post('/api/submit', (req, res) => {
    try {
        const { personal_info_b64, phone_number_b64 } = req.body;

        if (!personal_info_b64 || !phone_number_b64) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required base64 fields' 
            });
        }

        // Save into memory
        latestSubmission = {
            personal_info_b64,
            phone_number_b64,
            timestamp: Date.now()
        };

        console.log('--- Base64 Screenshots Received & Stored ---');
        return res.status(200).json({ 
            success: true, 
            message: 'Base64 strings successfully stored on server!' 
        });

    } catch (error) {
        console.error('Error saving data:', error);
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});

// 2. Shortcut B: GET endpoint to fetch the stored Base64 screenshots
app.get('/api/latest', (req, res) => {
    if (!latestSubmission.personal_info_b64 || !latestSubmission.phone_number_b64) {
        return res.status(404).json({ 
            success: false, 
            error: 'No screenshots found on server yet.' 
        });
    }

    console.log('--- Base64 Screenshots Fetched by Shortcut B ---');
    return res.status(200).json({
        success: true,
        personal_info_b64: latestSubmission.personal_info_b64,
        phone_number_b64: latestSubmission.phone_number_b64,
        timestamp: latestSubmission.timestamp
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});
