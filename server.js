require('dotenv').config();
const express = require('express');
const MBTiles = require('@mapbox/mbtiles');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const winstonDailyRotateFile = require('winston-daily-rotate-file'); // Import the log rotation transport
const fs = require('fs');

const app = express();
const port = process.env.PORT || 8000;

// Set up CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'];
const corsOptions = {
    origin: (origin, callback) => {
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS not allowed'), false);
        }
    },
    methods: 'GET,HEAD,OPTIONS',
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(helmet());

// Configure winston for logging
const logDir = process.env.LOG_DIR ? path.resolve(process.env.LOG_DIR) : path.join(__dirname, 'logs'); // Use .env value or default to './logs'
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir); // Create log directory if it doesn't exist
}

const logger = winston.createLogger({
    level: 'warn', // Only log warn, error, and critical logs
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.simple()
    ),
    transports: [
        // Console transport
        new winston.transports.Console(),

        // Daily rotate file transport
        new winstonDailyRotateFile({
            dirname: logDir,
            filename: 'server-%DATE%.log',
            datePattern: 'YYYY-MM-DD', // Rotate daily
            maxSize: '20m', // Max size of log file before rotation
            maxFiles: '14d', // Keep logs for 14 days
            zippedArchive: true, // Compress older logs
            level: 'warn' // Only log warn, error, and critical logs in file
        })
    ]
});

// Directory where MBTiles files are stored
const mbtilesDir = process.env.MBTILES_DIR ? path.resolve(process.env.MBTILES_DIR) : path.join(__dirname, 'tiles'); // Use .env value or default to './tiles'
let tileServers = {};

// Dynamically load all MBTiles files in the directory
fs.readdir(mbtilesDir, (err, files) => {
    if (err) {
        logger.error('Error reading MBTiles directory:', err);
        process.exit(1);
    }

    files.forEach((file) => {
        if (file.endsWith('.mbtiles')) {
            const mbtilesPath = path.join(mbtilesDir, file);
            new MBTiles(`${mbtilesPath}?mode=ro`, (err, mbtiles) => {
                if (err) {
                    logger.error(`Error loading MBTiles file ${file}:`, err);
                    return;
                }
                tileServers[file] = mbtiles;
                logger.info(`MBTiles file ${file} loaded successfully`);
            });
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    if (Object.keys(tileServers).length > 0) {
        logger.info('Health check passed');
        res.status(200).send('OK');
    } else {
        logger.warn('Health check failed: Tile server not initialized');
        res.status(503).send('Tile server not initialized');
    }
});

// Serve tiles from the dynamically loaded MBTiles files
app.get('/tiles/:file/:z/:x/:y.mvt', (req, res) => {
    const { file, z, x, y } = req.params;

    const tileServer = tileServers[`${file}.mbtiles`];
    if (!tileServer) {
        logger.warn(`Tile file ${file} not found for z:${z}, x:${x}, y:${y}`);
        return res.status(404).send('Tile file not found');
    }

    logger.info(`Serving tile from ${file} at z:${z}, x:${x}, y:${y}`);

    tileServer.getTile(z, x, y, (err, tile, headers) => {
        if (err) {
            if (err.message.includes('Tile does not exist')) {
                logger.info(`Tile does not exist: ${file} at z:${z}, x:${x}, y:${y}`);
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

// Serve tile metadata from the dynamically loaded MBTiles files
app.get('/metadata/:file', (req, res) => {
    const { file } = req.params;

    const tileServer = tileServers[`${file}.mbtiles`];
    if (!tileServer) {
        logger.warn(`Tile file ${file} not found for metadata request`);
        return res.status(404).send('Tile file not found');
    }

    logger.info(`Serving metadata for ${file}`);

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

// Graceful shutdown handling
const gracefulShutdown = () => {
    logger.info('Received shutdown signal. Closing server...');
    server.close(() => {
        logger.info('HTTP server closed');
        Object.values(tileServers).forEach((tileServer) => {
            tileServer.close(() => {
                logger.info('Closed tile server connection');
            });
        });
        process.exit(0);
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

// Start the server
const server = app.listen(port, () => {
    logger.info(`Tile server running at http://localhost:${port}`);
});
