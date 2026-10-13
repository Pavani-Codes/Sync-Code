import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import roomRoutes from './routes/room.routes.js';
import executeRoutes from './routes/execute.routes.js';
// ... existing imports ...

const app = express();

app.use(cors());
app.use(express.json());

// Mount API routes
app.use('/api/execute', executeRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/auth', authRoutes);

// ... rest of your express routes/handlers ...

export default app;