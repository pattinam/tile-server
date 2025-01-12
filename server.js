require('dotenv').config(); // Load environment variables
const express = require('express');
const MBTiles = require('@mapbox/mbtiles');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');

const app = express();
const port = process.env.PORT || 8000; // Port from environment variables (.env file in root of the repo)

// Set up CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(','); // origins from environment variables

const corsOptions = {
    origin: '*',
    methods: 'GET,HEAD,OPTIONS',
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(helmet()); // Adding security headers

// Configure winston for logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.simple()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'server.log' })
    ]
});

// Global error handlers
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    // Gracefully shut down if needed
});

process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection:', err);
    // Gracefully shut down if needed
});

// Initialize MBTiles
const mbtilesPath = path.join(__dirname, 'out.mbtiles');
let tileServer;

new MBTiles(`${mbtilesPath}?mode=ro`, (err, mbtiles) => {
    if (err) {
        logger.error('Error loading MBTiles:', err);
        process.exit(1);
    }
    tileServer = mbtiles;
    logger.info('MBTiles loaded successfully');
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
                logger.error('Error serving tile:', err);
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
            logger.error('Error loading metadata:', err);
            res.status(500).send('Error loading metadata');
            return;
        }
        res.json(info);
    });
});

// Error handling middleware for async errors
app.use((err, req, res, next) => {
    logger.error('Server error:', err);
    res.status(500).send('Internal Server Error');
});

const server = app.listen(port, () => {
    logger.info(`Tile server running at http://localhost:${port}`);
});

// Graceful shutdown handling
const gracefulShutdown = () => {
    logger.info('Received shutdown signal. Closing server...');
    server.close(() => {
        logger.info('HTTP server closed');
        if (tileServer) {
            tileServer.close(() => {
                logger.info('Closed tile server connection');
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    });

    // Force close if graceful shutdown fails
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

// Attach shutdown handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);