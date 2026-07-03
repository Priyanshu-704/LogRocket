import express from 'express';
import cors from 'cors';
import path from 'path';
import authRouter from './routes/auth';
import projectRouter from './routes/project';
import issueRouter from './routes/issue';
import sdkRouter from './routes/sdk';
import errorHandler from './middleware/errorHandler';

const app = express();

// Standard middleware
// CORS configuration: Allow * for SDK endpoints, restrict backend APIs to DASHBOARD_URL in production
app.use((req, res, next) => {
  const isSdkRoute = req.path.startsWith('/sdk');
  const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
  const origin = req.headers.origin;

  if (isSdkRoute) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  } else if (process.env.NODE_ENV === 'production') {
    if (origin && dashboardUrl.split(',').includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});
// Set JSON payload limits to 10MB to handle large CSS/DOM audit logs from complex web apps
app.use(express.json({ limit: '10mb' }));

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'JS Code Analyzer Backend API Gateway is healthy.',
    timestamp: new Date()
  });
});

// App Router Declarations
app.use('/api/auth', authRouter);
app.use('/api/projects', projectRouter);
app.use('/api/issues', issueRouter);

// Serve the compiled UMD SDK file as analyzer.js
app.get('/sdk/analyzer.js', (req, res) => {
  res.sendFile(path.join(process.cwd(), '../sdk/dist/analyzer.min.js'));
});
app.use('/sdk', sdkRouter);

// Global Error Handler (Must be registered last)
app.use(errorHandler);

export { app };
export default app;
