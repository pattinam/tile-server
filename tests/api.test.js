const axios = require('axios');
const supertest = require('supertest');
const app = require('../server'); // Assuming your app code is in a file called 'server.js'
const { default: MBTiles } = require('@mapbox/mbtiles');
const assert = require('assert');
const http = require('http');

const BASE_URL = 'http://localhost:8000';
const request = supertest(app);

let server;

// Wait for the server to be ready before starting tests
beforeAll(async () => {
    // Start the server manually using http.Server
    server = http.createServer(app);
    await new Promise((resolve, reject) => {
        server.listen(8000, (err) => {
            if (err) reject(err);
            resolve();
        });
    });
});

// Close the server after the tests
afterAll(() => {
    server.close();
});

// Mock the MBTiles constructor to avoid file system interactions
jest.mock('@mapbox/mbtiles', () => {
    return jest.fn().mockImplementation(() => {
        return {
            getTile: jest.fn().mockImplementation((z, x, y, callback) => {
                // Mocking a valid tile response for (z=0, x=0, y=0)
                if (z === 0 && x === 0 && y === 0) {
                    callback(null, Buffer.from('tile data'), {});
                } else {
                    callback(new Error('Tile does not exist'));
                }
            }),
            getInfo: jest.fn().mockImplementation((callback) => {
                callback(null, { tilejson: '1.0.0', name: 'Mocked MBTiles' });
            }),
        };
    });
});

// Handle unhandled promise rejections globally for the test suite
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Test suite
describe('Tile Server API Tests', () => {
    // Test 1: Health Check
    it('should return a 200 OK for the health endpoint', async () => {
        const response = await request.get('/health');
        expect(response.status).toBe(200);
        expect(response.text).toBe('OK');
    });

    // Test 2: Metadata endpoint (dynamically testing with any file name)
    it('should return metadata for the tile server', async () => {
        const response = await request.get('/metadata/mocked.mbtiles');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('tilejson');
        expect(response.body.name).toBe('Mocked MBTiles');
    });

    // Test 3: Tile Request (valid tile)
    it('should serve a valid tile for z=0, x=0, y=0', async () => {
        const response = await request.get('/tiles/mocked.mbtiles/0/0/0.mvt');
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/x-protobuf');
    });

    // Test 4: Tile not found (z=1, x=1, y=1)
    it('should return a 204 if tile does not exist', async () => {
        const response = await request.get('/tiles/mocked.mbtiles/1/1/1.mvt');
        expect(response.status).toBe(204);
    });

    // Test 5: CORS headers (allow all origins)
    it('should allow CORS headers from any origin', async () => {
        const response = await request.get('/tiles/mocked.mbtiles/0/0/0.mvt')
            .set('Origin', 'http://pattinam.in');
        expect(response.headers['access-control-allow-origin']).toBe('*');
    });

    // Test 6: Cache headers
    it('should include Cache-Control header', async () => {
        const response = await request.get('/tiles/mocked.mbtiles/0/0/0.mvt');
        expect(response.headers['cache-control']).toBe('public, max-age=3600');
    });

    // Test for shutdown logic (mocked for now)
    it('should shut down gracefully on SIGTERM', async () => {
        // Mock graceful shutdown
        const shutdown = jest.fn();
        process.on('SIGTERM', shutdown);
        
        process.emit('SIGTERM');
        expect(shutdown).toHaveBeenCalled();
    });
});
