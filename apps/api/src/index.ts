import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import establishmentRoutes from './routes/establishment';
import employeesRoutes from './routes/employees';
import invitesRoutes from './routes/invites';
import chatRoutes from './routes/chat';
import schedulesRoutes from './routes/schedules';
import employeeAuthRoutes from './routes/employee-auth';
import employeeAvailabilityRoutes from './routes/employee-availability';
import employeeScheduleRoutes from './routes/employee-schedule';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Development-only test routes (bypasses auth)
if (process.env.NODE_ENV === 'development') {
  const testChatRoutes = require('./routes/chat-test').default;
  app.use('/test/chat', testChatRoutes);
  console.log('   ⚠️  Test routes enabled: /test/chat/*');

  // Debug endpoint to check establishment data
  const { collections } = require('./services/firebase');
  app.get('/debug/establishment/:id', async (req, res) => {
    try {
      const doc = await collections.establishments.doc(req.params.id).get();
      if (!doc.exists) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      const data = doc.data();
      res.json({
        id: doc.id,
        operatingHours: data?.operatingHours,
        operatingHoursKeys: data?.operatingHours ? Object.keys(data.operatingHours) : [],
        operatingHoursTypes: data?.operatingHours
          ? Object.entries(data.operatingHours).map(([k, v]) => ({ key: k, type: typeof v, value: v }))
          : [],
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Fix corrupted operatingHours data (set to 24/7)
  app.post('/debug/fix-hours/:id', async (req, res) => {
    try {
      const fixedHours: Record<number, any> = {};
      for (let day = 0; day <= 6; day++) {
        fixedHours[day] = {
          isOpen: true,
          openTime: '00:00',
          closeTime: '23:59',
        };
      }
      await collections.establishments.doc(req.params.id).update({
        operatingHours: fixedHours,
      });
      res.json({ success: true, operatingHours: fixedHours });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
}

// API Routes
app.use('/establishment', establishmentRoutes);
app.use('/employees', employeesRoutes);
app.use('/invites', invitesRoutes);
app.use('/chat', chatRoutes);
app.use('/schedules', schedulesRoutes);
app.use('/employee-auth', employeeAuthRoutes);
app.use('/availability', employeeAvailabilityRoutes);
app.use('/employee/schedule', employeeScheduleRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Não encontrado',
    message: `Rota ${req.method} ${req.path} não encontrada`,
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Erro interno',
    message: 'Ocorreu um erro inesperado',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Escala Simples API running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});

export default app;
