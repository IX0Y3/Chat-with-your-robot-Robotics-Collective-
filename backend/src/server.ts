import express, { Express, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Response as ExpressResponse } from 'express';
import { ROSClient } from './ros/rosClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const PORT: number = 3000;

// Speichere empfangene ROS-Nachrichten
const rosMessages: Array<{ topic: string; message: any; timestamp: number }> = [];
const MAX_MESSAGES = 100; // Maximal 100 Nachrichten speichern

// Helper: Nachricht speichern
const addRosMessage = (topic: string, message: any) => {
  const timestamp = Date.now();
  rosMessages.push({
    topic,
    message,
    timestamp
  });
  console.log(`Nachricht gespeichert: [${topic}] timestamp=${timestamp}, total=${rosMessages.length}`);
  // Alte Nachrichten entfernen, wenn zu viele
  if (rosMessages.length > MAX_MESSAGES) {
    rosMessages.shift();
  }
};

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
    // Nachricht speichern
    addRosMessage(topic, message);
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
  console.log(`Publishe auf ${topic}:`, message);
  
  // HINWEIS: In ROS bekommst du deine eigenen Publikationen normalerweise nicht zurück.
  // Für Testzwecke speichern wir die publizierte Nachricht auch direkt,
  // damit das Frontend sie sehen kann (in einer echten Umgebung würde die Nachricht
  // von einem anderen ROS-Node kommen)
  addRosMessage(topic, message);
  
  res.json({ success: true, message: 'Nachricht gesendet' });
});

// Endpoint zum Abrufen von ROS-Nachrichten
app.get('/api/ros/messages', (req: Request, res: Response) => {
  const since = req.query.since ? parseInt(req.query.since as string) : 0;
  const filteredMessages = rosMessages.filter(msg => msg.timestamp > since);
  
  // Debug: Logge wie viele Nachrichten gespeichert sind
  console.log(`GET /api/ros/messages: since=${since}, total=${rosMessages.length}, filtered=${filteredMessages.length}`);
  
  res.setHeader('Content-Type', 'application/json');
  res.json({
    messages: filteredMessages,
    latestTimestamp: rosMessages.length > 0 ? rosMessages[rosMessages.length - 1].timestamp : 0
  });
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
  console.log(`API Endpoints:`);
  console.log(`  POST /api/ros/subscribe - Subscribe zu ROS Topic`);
  console.log(`  POST /api/ros/publish - Publish ROS Message`);
  console.log(`  GET /api/ros/messages - Abrufe ROS Nachrichten`);
});

