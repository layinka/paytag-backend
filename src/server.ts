import { buildApp } from './app.js';
import 'dotenv/config';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

/**
 * Start the server
 */
async function start() {
  try {
    const app = await buildApp();

    await app.listen({ port: PORT, host: HOST });

    console.log('');
    console.log('🚀 PayTag Backend Started');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📍 API:         http://localhost:${PORT}`);
    console.log(`📚 Docs:        http://localhost:${PORT}/docs`);
    console.log(`🔍 OpenAPI:     http://localhost:${PORT}/documentation/json`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'] as const;
    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`\n${signal} received, closing server...`);
        await app.close();
        process.exit(0);
      });
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();
