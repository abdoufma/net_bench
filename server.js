const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for cross-origin requests
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Generate test data of specified size (in KB)
function generateTestData(sizeKB) {
    const sizeBytes = sizeKB * 1024;
    // Generate random data for more realistic network conditions
    return crypto.randomBytes(sizeBytes).toString('base64');
}

// Ping endpoint for latency testing
app.get('/api/ping', (req, res) => {
    res.json({ 
        timestamp: Date.now(),
        message: 'pong' 
    });
});

// Download speed test - server sends data to client
app.get('/api/download/:sizeKB', (req, res) => {
    const sizeKB = parseInt(req.params.sizeKB) || 100;
    
    // Limit size for safety (max 10MB)
    const maxSizeKB = 10240;
    const actualSize = Math.min(sizeKB, maxSizeKB);
    
    try {
        const testData = generateTestData(actualSize);
        
        res.json({
            size: actualSize,
            timestamp: Date.now(),
            data: testData
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to generate test data',
            message: error.message 
        });
    }
});

// Upload speed test - client sends data to server
app.post('/api/upload', (req, res) => {
    const receivedTimestamp = Date.now();
    const { data, timestamp, size } = req.body;
    
    if (!data || !timestamp || !size) {
        return res.status(400).json({ 
            error: 'Missing required fields: data, timestamp, size' 
        });
    }
    
    res.json({
        received: receivedTimestamp,
        clientTimestamp: timestamp,
        dataSize: size,
        transferTime: receivedTimestamp - timestamp
    });
});

// Network info endpoint
app.get('/api/network-info', (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    
    res.json({
        clientIP: clientIP,
        serverTime: Date.now(),
        headers: {
            'user-agent': req.headers['user-agent'],
            'connection': req.headers['connection'],
            'accept-encoding': req.headers['accept-encoding']
        }
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: Date.now()
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Speed test server running on port ${PORT}`);
    console.log(`Available endpoints:`);
    console.log(`  GET  /api/ping - Latency test`);
    console.log(`  GET  /api/download/:sizeKB - Download speed test`);
    console.log(`  POST /api/upload - Upload speed test`);
    console.log(`  GET  /api/network-info - Network information`);
    console.log(`  GET  /api/health - Health check`);
});

module.exports = app;