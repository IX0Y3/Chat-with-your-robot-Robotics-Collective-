import express, { Express, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Response as ExpressResponse } from 'express';
import { ROSClient } from './ros/rosClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const PORT: number = 3000;

// CORS für React Frontend (muss vor den Routes sein)
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// JSON Body Parser
app.use(express.json());

// ROS Client
const rosClient = new ROSClient('ws://localhost:9090');

// ROS Subscription Endpoint
app.post('/api/ros/subscribe', (req: Request, res: Response) => {
  const { topic, messageType } = req.body;

  if (!topic || !messageType) {
    return res.status(400).json({ error: 'topic und messageType sind erforderlich' });
  }

  // Subscribe und handle messages
  rosClient.subscribe(topic, messageType, (message: any) => {
    console.log(`[${topic}] Empfangen:`, message);
    // Hier könntest du die Nachrichten in eine Datenbank speichern, 
    // über WebSocket an Clients senden, etc.
  });

  res.json({ 
    success: true, 
    message: `Subscribed zu ${topic}`,
    connected: rosClient.isConnected 
  });
});

// ROS Publish Endpoint
app.post('/api/ros/publish', (req: Request, res: Response) => {
  const { topic, messageType, message } = req.body;

  if (!topic || !messageType || !message) {
    return res.status(400).json({ error: 'topic, messageType und message sind erforderlich' });
  }

  if (!rosClient.isConnected) {
    return res.status(503).json({ error: 'ROS nicht verbunden' });
  }

  rosClient.publish(topic, messageType, message);
  res.json({ success: true, message: 'Nachricht gesendet' });
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
  console.log(`API Endpoints:`);
  console.log(`  POST /api/ros/subscribe - Subscribe zu ROS Topic`);
  console.log(`  POST /api/ros/publish - Publish ROS Message`);
});

