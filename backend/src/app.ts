import express from 'express';
import cors from 'cors';
import roomRoutes from './routes/room.routes.js';
import executeRoutes from './routes/execute.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

// Mount API routes
app.use('/api/execute', executeRoutes);
app.use('/api/rooms', roomRoutes);

export default app;