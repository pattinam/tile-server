# Tile Server

A Node.js application for serving tiles stored in MBTiles format. This project allows you to serve vector map tiles from MBTiles files in a REST API, with the ability to handle multiple files dynamically.

## Features
- Serve vector tiles from MBTiles files.
- Dynamically load MBTiles files stored in a directory.
- Health check endpoint to monitor server status.
- Support for CORS and secure headers.
- Logging and log rotation using Winston.
- Graceful shutdown on termination.

## Requirements
- Node.js (version 14.x or higher)
- npm
- MBTiles files for serving tiles

## Getting Started

Follow the steps below to set up the development environment and run the server.

### 1. Clone the repository

```bash
git clone https://github.com/pattinam/tiles-server.git
```

### 2. Install dependencies

Make sure you have Node.js installed, then run the following to install the project dependencies:

```bash
cd tiles-server
npm install
```

### 3. Configure environment variables
Create a `.env` file in the root of the project and configure the following variables:

```dotenv
PORT=8000                # Port for the server
ALLOWED_ORIGINS=*        # Comma-separated list of allowed CORS origins
LOG_DIR=./logs            # Directory for logs
MBTILES_DIR=./tiles       # Directory where your MBTiles files are stored
```

### 4. Add MBTiles files
Store your MBTiles files in the tiles/ directory (or a directory specified in your .env file).

###  5. Start the server
To run the server in development mode, use the following command:

```bash
npm start
```

The server will be running at http://localhost:8000 (or the port specified in your .env file).

### 6. Accessing tiles
You can access the tiles in the following endpoint following endpoint:

```http
http://localhost:8000/tiles/:file/:z/:x/:y.mvt
```

Where:

:file is the name of the MBTiles file (without the .mbtiles extension).
:z, :x, :y are the zoom, tile X, and tile Y coordinates of the requested tile.

Example:

```http
http://localhost:8000/tiles/myMap/12/300/150.mvt
```

### 7. Health check endpoint

To check if the server is healthy, use the following endpoint:

```http
GET /health
```

If the server is running and serving tiles correctly, you'll receive a 200 OK response.

## Contributing

We welcome contributions from the community! To contribute, please follow these steps:

- Fork the repository: Click the "Fork" button on the top right of the repository page to create your own copy of the repository.
- Create a new branch for your feature or bugfix:
- Make the necessary changes to the code. Please ensure your code adheres to the project's coding style.
- Commit your changes with a clear and concise message:
- Push your changes to your fork:
- Create a new pull request from your branch.
- Please include a description of the changes you've made, along with any relevant details.

## License
This project is licensed under the MIT License - see the `LICENSE` file for details.

## Acknowledgements
- MBTiles for the tile format.
- Mapbox for their open-source libraries.
- Winston for logging.
- Express for the web server.
