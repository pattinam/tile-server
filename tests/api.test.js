// tests/api.test.js
const axios = require('axios');
const assert = require('assert');

const BASE_URL = 'http://localhost:8000';

async function runTests() {
    console.log('Starting API tests...');
    
    try {
        // Test 1: Health Check
        console.log('\nTesting health endpoint...');
        const healthResponse = await axios.get(`${BASE_URL}/health`);
        assert.strictEqual(healthResponse.status, 200);
        assert.strictEqual(healthResponse.data, 'OK');
        console.log('✅ Health check passed');

        // Test 2: Metadata endpoint
        console.log('\nTesting metadata endpoint...');
        const metadataResponse = await axios.get(`${BASE_URL}/metadata`);
        assert.strictEqual(metadataResponse.status, 200);
        assert(metadataResponse.data, 'Metadata should not be empty');
        console.log('✅ Metadata check passed');

        // Test 3: Vector tile request
        console.log('\nTesting tile endpoint...');
        const tileResponse = await axios.get(`${BASE_URL}/tiles/0/0/0.mvt`, {
            responseType: 'arraybuffer'
        });
        assert(tileResponse.status === 200 || tileResponse.status === 204);
        if (tileResponse.status === 200) {
            assert(tileResponse.headers['content-type'] === 'application/x-protobuf');
        }
        console.log('✅ Tile request check passed');

        // Test 4: CORS headers
        console.log('\nTesting CORS headers...');
        const corsResponse = await axios.get(`${BASE_URL}/tiles/0/0/0.mvt`, {
            headers: {
                'Origin': 'http://pattinam.in'
            }
        });
        assert(corsResponse.headers['access-control-allow-origin']);
        console.log('✅ CORS headers check passed');

        // Test 5: Cache headers
        console.log('\nTesting cache headers...');
        const cacheResponse = await axios.get(`${BASE_URL}/tiles/0/0/0.mvt`);
        assert(cacheResponse.headers['cache-control']);
        console.log('✅ Cache headers check passed');

        console.log('\n🎉 All tests passed successfully!');
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        process.exit(1);
    }
}

runTests();