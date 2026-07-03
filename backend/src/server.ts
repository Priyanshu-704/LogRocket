import http from 'http';
import app from './app';
import config from './config';
import { connectDB } from './config/db';
import { initSocket } from './services/socket';

async function startServer() {
  // 1. Establish database connection
  await connectDB();

  // 2. Bind HTTP server and initialize secure Socket.io instance
  const server = http.createServer(app);
  initSocket(server);

  // 3. Start listener
  server.listen(config.port, () => {
    console.log(`[Server] Active in [${config.nodeEnv}] mode`);
    console.log(`[Server] API Gateway listening on http://localhost:${config.port}`);
  });
}

startServer().catch(err => {
  console.error('[Server] Critical start error:', err);
  process.exit(1);
});
