const express = require('express');
const { Pool } = require('pg');
const pino = require('pino');
const pinoHttp = require('pino-http');
const dotenv = require('dotenv');
dotenv.config(); // Load environment variables from .env file


// Initialize structured JSON logging  
// log level like errors, warnings or just info (default)
function getTransport() {
  if (process.env.NODE_ENV === 'production') return undefined;
  try {
    require.resolve('pino-pretty');
    return { target: 'pino-pretty' };
  } catch {
    return undefined; // not installed (production image): fall back to plain JSON logs
  }
}

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: getTransport()
});

const app = express();
app.use(pinoHttp({ logger }));
app.use(express.json());

// Database connection pool 
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Track application startup and readiness state
let isReady = false;
let isShuttingDown = false;

// Initialize DB Table & set readiness flag
async function initializeDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_stats (
        id SERIAL PRIMARY KEY,
        visits INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Ensure at least one row exists
    const res = await pool.query('SELECT COUNT(*) FROM app_stats;');
    if (parseInt(res.rows[0].count) === 0) {
      await pool.query('INSERT INTO app_stats (visits) VALUES (0);');
    }
    isReady = true;
    logger.info('Database initialized successfully. Application is READY.');
  } catch (err) {
    logger.error({ err }, 'Failed to connect to database during startup. Retrying in 5s...');
    setTimeout(initializeDb, 5000); // Retry loop every 5s
  }
}



// --- Routes ---

// Root endpoint
app.get('/', async (req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({ status: 'Service Unavailable - Shutting down' });
  }

  try {
    // Increment visit counter in database
    await pool.query('UPDATE app_stats SET visits = visits + 1, updated_at = NOW() WHERE id = 1;');
    const dbRes = await pool.query('SELECT visits FROM app_stats WHERE id = 1;');
    const visits = dbRes.rows[0].visits;

    res.json({
      message: 'Welcome to the Minimal Node.js API!',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0',
      databaseVisits: visits,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error({ err }, 'Error handling root request');
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
});

// Liveness probe (Checks if process is alive)
app.get('/healthz', (req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({ status: 'DOWN' });
  }
  res.status(200).json({ status: 'UP', uptime: process.uptime() });
});

// Readiness probe (Checks if dependencies like DB are ready)
app.get('/readyz', async (req, res) => {
  if (!isReady || isShuttingDown) {
    return res.status(503).json({ status: 'NOT_READY', databaseConnected: isReady });
  }

  try {
    // Ping database connection pool without reading any table
    await pool.query('SELECT 1;');
    res.status(200).json({ status: 'READY', databaseConnected: true });
  } catch (err) {
    logger.error({ err }, 'Readiness check failed: Database unhealthy');
    res.status(503).json({ status: 'NOT_READY', databaseConnected: false, error: err.message });
  }
});

// Simple metrics endpoint for Prometheus scraping (Requirement 5)
app.get('/metrics', async (req, res) => {
  try {
    const dbRes = await pool.query('SELECT visits FROM app_stats WHERE id = 1;');
    const visits = dbRes.rows[0]?.visits || 0;
    
    // Output Prometheus text exposition format
    res.set('Content-Type', 'text/plain');
    res.send(
      `# HELP node_app_visits_total Total number of visits to the application\n` +
      `# TYPE node_app_visits_total counter\n` +
      `node_app_visits_total ${visits}\n` +
      `# HELP node_app_uptime_seconds Process uptime in seconds\n` +
      `# TYPE node_app_uptime_seconds gauge\n` +
      `node_app_uptime_seconds ${process.uptime()}\n`
    );
  } catch (err) {
    res.status(500).send('# Error generating metrics');
  }
});

// --- Server Lifecycle & Graceful Shutdown ---
const PORT = process.env.PORT || 3000;
let server; // CHANGE: declared with let so it can be assigned inside the startup block below

// Graceful shutdown handling for container termination signals (SIGTERM/SIGINT)
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  isShuttingDown = true; // set flag to true

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await pool.end();
      logger.info('Database pool closed.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during database pool closure');
      process.exit(1);
    }
  });

  // Force shutdown if connections hang too long
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1); // error code
  }, 10000);
};

// when this file is run directly (not imported), start the server and initialize the DB
// when it is imported (e.g., for testing), do not start the server or initialize the DB
if (require.main === module) {
  initializeDb();

  server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

module.exports = { app, pool }; // export what tests need