# Quick Start Guide

## Requirements

- Node.js v22.18.0 or higher

## Server

The server is a simple Express server that listens on port PORT (default: 3001). It has the following endpoints:

- `GET /api/ping`: Latency test
- `GET /api/download/:sizeKB`: Download speed test
- `POST /api/upload`: Upload speed test
- `GET /api/network-info`: Network information
- `GET /api/health`: Health check

To start the server, simply run:

```bash
node server.js
```


## Client

The client is a simple Node.js application that makes requests to the server and prints the results.

```bash
node client.js [server-url] [options]
```

### Options

- `--download-size <KB>`: Size for download test (default: 1000)
- `--upload-size <KB>`: Size for upload test (default: 1000)
- `--ping-count <count>`: Number of ping samples (default: 5)
- `--no-download`: Skip download test
- `--no-upload`: Skip upload test
- `--no-latency`: Skip latency test

### Examples

```bash
node client.js http://10.10.10.200 --download-size 10240 --upload-size 10240
```

```bash
node client.js http://10.10.10.200 --no-download --no-upload --ping-count 10
```

```bash
node client.js http://10.10.10.200 --no-latency --no-download --upload-size 5120
```

```bash
node client.js http://10.10.10.200 --no-latency --no-upload --download-size 5120
```

```bash
node client.js http://10.10.10.200 --no-upload --no-download --ping-count 10
```


## Scripts

The project shorthands for the different client tests in the form of package.json scripts:

- `npm run start`: Run all tests
- `npm run start:10`: Run all tests with 10MB download and upload size
- `npm run upload`: Run upload test
- `npm run download`: Run download test
- `npm run latency`: Run latency test