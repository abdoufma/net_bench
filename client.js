const https = require('https');
const http = require('http');
const crypto = require('crypto');

class NetworkSpeedTester {
    constructor(serverUrl) {
        this.serverUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
        this.httpModule = serverUrl.startsWith('https') ? https : http;
    }

    // Test latency with multiple pings
    async testLatency(samples = 5) {
        console.log(`Testing latency with ${samples} samples...`);
        const latencies = [];

        for (let i = 0; i < samples; i++) {
            try {
                const startTime = Date.now();
                await this.makeRequest('/api/ping');
                const endTime = Date.now();
                const latency = endTime - startTime;
                latencies.push(latency);
                
                console.log(`Ping ${i + 1}: ${latency}ms`);
                
                // Small delay between pings
                if (i < samples - 1) {
                    await this.sleep(100);
                }
            } catch (error) {
                console.error(`Ping ${i + 1} failed:`, error.message);
            }
        }

        if (latencies.length === 0) {
            throw new Error('All ping attempts failed');
        }

        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const minLatency = Math.min(...latencies);
        const maxLatency = Math.max(...latencies);

        return {
            average: Math.round(avgLatency),
            min: minLatency,
            max: maxLatency,
            n_samples: samples
        };
    }

    // Test download speed
    async testDownloadSpeed(sizeKB = 1000) {
        console.log(`Testing download speed with ${sizeKB}KB...`);
        
        const startTime = Date.now();
        const response = await this.makeRequest(`/api/download/${sizeKB}`);
        const endTime = Date.now();
        
        const transferTime = endTime - startTime;
        const sizeBytes = sizeKB * 1024;
        const speedBps = sizeBytes / (transferTime / 1000); // bytes per second
        const speedKbps = (speedBps * 8) / 1000; // kilobits per second
        const speedMbps = speedKbps / 1000; // megabits per second

        return {
            sizeKB,
            transferTime,
            speedBps: Math.round(speedBps),
            speedKbps: Math.round(speedKbps),
            speedMbps: Math.round(speedMbps * 100) / 100
        };
    }

    // Test upload speed
    async testUploadSpeed(sizeKB = 1000) {
        console.log(`Testing upload speed with ${sizeKB}KB...`);
        
        // Generate test data
        const sizeBytes = sizeKB * 1024;
        const testData = crypto.randomBytes(sizeBytes).toString('base64');
        
        const payload = {
            data: testData,
            timestamp: Date.now(),
            size: sizeKB
        };

        const startTime = Date.now();
        const response = await this.makeRequest('/api/upload', 'POST', payload);
        const endTime = Date.now();
        
        const transferTime = endTime - startTime;
        const speedBps = sizeBytes / (transferTime / 1000);
        const speedKbps = (speedBps * 8) / 1000;
        const speedMbps = speedKbps / 1000;

        return {
            sizeKB,
            transferTime,
            speedBps: Math.round(speedBps),
            speedKbps: Math.round(speedKbps),
            speedMbps: Math.round(speedMbps * 100) / 100,
            serverProcessingTime: response.transferTime
        };
    }

    // Get network information
    async getNetworkInfo() {
        return await this.makeRequest('/api/network-info');
    }

    // Run comprehensive speed test
    async runFullTest(options = {}) {
        const {
            latencySamples = 5,
            downloadSizeKB = 1000,
            uploadSizeKB = 1000,
            testDownload = true,
            testUpload = true,
            testLatency = true
        } = options;

        console.log(`\n=== Network Speed Test ===`);
        console.log(`Server: ${this.serverUrl}`);
        console.log(`Time: ${new Date().toISOString()}\n`);

        const results = {
            serverUrl: this.serverUrl,
            timestamp: new Date().toISOString(),
            tests: {}
        };

        try {
            // Test latency
            if (testLatency){
                console.log('1. Testing Latency...');
                results.tests.latency = await this.testLatency(latencySamples);
                console.log(`  Average: ${results.tests.latency.average}ms (min: ${results.tests.latency.min}ms, max: ${results.tests.latency.max}ms)\n`);
            }

            // Test download speed
            if (testDownload) {
                console.log('2. Testing Download Speed...');
                results.tests.download = await this.testDownloadSpeed(downloadSizeKB);
                console.log(`   Speed: ${results.tests.download.speedMbps} Mbps (${results.tests.download.speedKbps} Kbps)\n`);
            }

            // Test upload speed
            if (testUpload) {
                console.log('3. Testing Upload Speed...');
                results.tests.upload = await this.testUploadSpeed(uploadSizeKB);
                console.log(`   Speed: ${results.tests.upload.speedMbps} Mbps (${results.tests.upload.speedKbps} Kbps)\n`);
            }

            // Get network info
            console.log('4. Getting Network Info...');
            results.networkInfo = await this.getNetworkInfo();
            console.log(`   Client IP: ${results.networkInfo.clientIP}\n`);

        } catch (error) {
            console.error('Test failed:', error.message);
            results.error = error.message;
        }

        return results;
    }

    // Helper method to make HTTP requests
    makeRequest(path, method = 'GET', data = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(this.serverUrl + path);
            // console.log(`Making request to `, url.origin);
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                }
            };

            if (data && method === 'POST') {
                const postData = JSON.stringify(data);
                options.headers['Content-Length'] = Buffer.byteLength(postData);
            }

            const req = this.httpModule.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseData);
                        resolve(parsed);
                    } catch (error) {
                        reject(new Error(`Invalid JSON response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            // 120 seconds timeout
            req.setTimeout(120_000, () => { 
                req.destroy("Request timeout'");
                reject(new Error('Request timed out'));
            });

            if (data && method === 'POST') {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    // Helper method for delays
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node speed-test-client.js <server-url> [options]');
        console.log('');
        console.log('Example: node speed-test-client.js http://192.168.1.100:3001');
        console.log('');
        console.log('Options:');
        console.log('  --download-size <KB>   Size for download test (default: 1000)');
        console.log('  --upload-size <KB>     Size for upload test (default: 1000)');
        console.log('  --ping-count <count>   Number of ping samples (default: 5)');
        console.log('  --no-download          Skip download test');
        console.log('  --no-upload            Skip upload test');
        process.exit(1);
    }

    const serverUrl = args[0];
    // console.log({serverUrl})
    
    // Parse command line options
    const options = {
        downloadSizeKB: 1000,
        uploadSizeKB: 1000,
        latencySamples: 5,
        testDownload: true,
        testUpload: true
    };

    for (let i = 1; i < args.length; i++) {
        switch (args[i]) {
            case '--download-size':
                options.downloadSizeKB = parseInt(args[++i]);
                break;
            case '--upload-size':
                options.uploadSizeKB = parseInt(args[++i]);
                break;
            case '--ping-count':
                options.latencySamples = parseInt(args[++i]);
                break;
            case '--no-download':
                options.testDownload = false;
                break;
            case '--no-upload':
                options.testUpload = false;
            case '--no-latency':
                options.testLatency = false;
                break;
        }
    }

    // Run the test
    const tester = new NetworkSpeedTester(serverUrl);
    
    tester.runFullTest(options)
        .then(results => {
            console.log('=== Test Complete ===');
            console.log(JSON.stringify(results, null, 2));
        })
        .catch(error => {
            console.error('Test failed:', error.message);
            process.exit(1);
        });
}

module.exports = NetworkSpeedTester;