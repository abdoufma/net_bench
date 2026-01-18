import {Router, json} from 'express';
import cors from 'cors';
import crypto from 'crypto';

const SpeedTestRouter = Router();

// Enable CORS for cross-origin requests
SpeedTestRouter.use(cors());
SpeedTestRouter.use(json({ limit: '100mb' }));

// Generate test data of specified size (in KB)
function generateTestData(sizeKB) {
    const sizeBytes = sizeKB * 1024;
    // Generate random data for more realistic network conditions
    return crypto.randomBytes(sizeBytes).toString('base64');
}

// Ping endpoint for latency testing
SpeedTestRouter.get('/api/ping', (_, res) => {
    res.json({ 
        timestamp: Date.now(),
        message: 'pong' 
    });
});

// Download speed test - server sends data to client
SpeedTestRouter.get('/api/download/:sizeKB', (req, res) => {
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
SpeedTestRouter.post('/api/upload', (req, res) => {
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
SpeedTestRouter.get('/api/network-info', (req, res) => {
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
SpeedTestRouter.get('/api/health', (_, res) => {
    res.json({ 
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: Date.now()
    });
});


module.exports = SpeedTestRouter;