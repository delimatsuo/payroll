import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getModelInfo } from './config/llm';

// Routes
import managersRouter from './routes/managers';
import establishmentsRouter from './routes/establishments';
import employeesRouter from './routes/employees';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    llm: getModelInfo(),
  });
});

// API Routes
app.use('/api/managers', managersRouter);
app.use('/api/establishments', establishmentsRouter);
app.use('/api', employeesRouter); // Includes /api/establishments/:id/employees and /api/employees/:id

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'NotFound',
    message: 'Endpoint not found',
  });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'InternalError',
    message: 'An unexpected error occurred',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Escala Simples API running on port ${PORT}`);
  console.log(`📊 LLM Config:`, getModelInfo());
});
