// server.js
const express = require('express');
const MBTiles = require('@mapbox/mbtiles');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 8000;

// Set up CORS to allow front-end access
const allowedOrigins = [
    'http://144.126.254.165',
    'http://144.126.254.165:80',
    'http://pattinam.in:80',
    'https://pattinam.in:443',
    'http://pattinam.in',
    'https://pattinam.in',
    'http://172.28.238.244',
    'http://localhost'
];

const corsOptions = {
    origin: "*"
};

app.use(cors(corsOptions));

// Global error handlers
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Optionally notify your error tracking service here
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    // Optionally notify your error tracking service here
});

// Initialize MBTiles
const mbtilesPath = path.join(__dirname, 'output.mbtiles');
let tileServer;

new MBTiles(`${mbtilesPath}?mode=ro`, (err, mbtiles) => {
    if (err) {
        console.error('Error loading MBTiles:', err);
        process.exit(1);
    }
    tileServer = mbtiles;
    console.log('MBTiles loaded successfully');
});

// Health check endpoint
app.get('/health', (req, res) => {
    if (tileServer) {
        res.status(200).send('OK');
    } else {
        res.status(503).send('Tile server not initialized');
    }
});

// Serve tiles
app.get('/tiles/:z/:x/:y.mvt', (req, res) => {
    const { z, x, y } = req.params;
    
    if (!tileServer) {
        res.status(503).send('Tile server not initialized');
        return;
    }

    tileServer.getTile(z, x, y, (err, tile, headers) => {
        if (err) {
            if (err.message.includes('Tile does not exist')) {
                res.status(204).end();
            } else {
                console.error('Error serving tile:', err);
                res.status(500).send('Error loading tile');
            }
            return;
        }

        // Set comprehensive response headers
        res.set({
            'Content-Type': 'application/x-protobuf',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600',
            'X-Content-Type-Options': 'nosniff'
        });
        
        if (headers) {
            for (const [key, value] of Object.entries(headers)) {
                res.set(key, value);
            }
        }

        res.send(tile);
    });
});

// Serve tile metadata
app.get('/metadata', (req, res) => {
    if (!tileServer) {
        res.status(503).send('Tile server not initialized');
        return;
    }

    tileServer.getInfo((err, info) => {
        if (err) {
            console.error('Error loading metadata:', err);
            res.status(500).send('Error loading metadata');
            return;
        }
        res.json(info);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).send('Internal Server Error');
});

const server = app.listen(port, () => {
    console.log(`Tile server running at http://localhost:${port}`);
});

// Graceful shutdown handling
const gracefulShutdown = () => {
    console.log('Received shutdown signal. Closing server...');
    server.close(() => {
        console.log('HTTP server closed');
        if (tileServer) {
            tileServer.close(() => {
                console.log('Closed tile server connection');
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    });

    // Force close if graceful shutdown fails
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

// Attach shutdown handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);