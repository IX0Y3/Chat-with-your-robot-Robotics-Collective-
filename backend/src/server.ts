import express, { Express, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Response as ExpressResponse } from 'express';
import { ROSClient } from './ros/rosClient.js';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { setupCameraStreamEndpoint, setupCameraSubscription } from './stream/cameraStream.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const PORT: number = 3000;

// HTTP Server für WebSocket
const server = createServer(app);

// Speichere empfangene ROS-Nachrichten
const rosMessages: Array<{ topic: string; message: any; timestamp: number }> = [];
const MAX_MESSAGES = 100; // Maximal 100 Nachrichten speichern

// WebSocket Server für Log-Nachrichten (nicht-Bilder)
const wss = new WebSocketServer({ 
  server,
  path: '/api/ros/logs-ws'
});

const logClients = new Set<WebSocket>();

wss.on('connection', (ws: WebSocket) => {
  console.log('WebSocket Client für Logs verbunden');
  logClients.add(ws);
  
  ws.on('close', () => {
    console.log('WebSocket Client für Logs getrennt');
    logClients.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket Fehler:', error);
    logClients.delete(ws);
  });
});

// Helper: Nachricht speichern und an WebSocket-Clients senden
const addRosMessage = (topic: string, message: any) => {
  const timestamp = Date.now();
  const msg = {
    topic,
    message,
    timestamp
  };
  rosMessages.push(msg);
  console.log(`Nachricht gespeichert: [${topic}] timestamp=${timestamp}, total=${rosMessages.length}`);
  
  // Alte Nachrichten entfernen, wenn zu viele
  if (rosMessages.length > MAX_MESSAGES) {
    rosMessages.shift();
  }
  
  // Sende alle Nachrichten über WebSocket (außer Kamera-Topic, das hat eigenen Stream)
  if (topic !== '/camera/color/image_raw/compressed' && logClients.size > 0) {
    const data = JSON.stringify(msg);
    logClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
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

// Kamera-Stream Endpoint einrichten
setupCameraStreamEndpoint(app);

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

// Command Endpoint - Verarbeitet Befehle vom Frontend
app.post('/api/ros/command', (req: Request, res: Response) => {
  const { command } = req.body;

  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'command ist erforderlich und muss ein String sein' });
  }

  if (!rosClient.isConnected) {
    return res.status(503).json({ error: 'ROS nicht verbunden' });
  }

  console.log(`Befehl empfangen: ${command}`);

  // Hier kannst du die Befehle verarbeiten
  // Beispiel: Befehl an ROS publishen
  // rosClient.publish('/commands', 'std_msgs/msg/String', { data: command });

  // Für jetzt: Logge den Befehl und sende Bestätigung
  res.json({ 
    success: true, 
    message: `Befehl '${command}' empfangen und verarbeitet`
  });
});


server.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
  console.log(`API Endpoints:`);
  console.log(`  POST /api/ros/subscribe - Subscribe zu ROS Topic`);
  console.log(`  POST /api/ros/publish - Publish ROS Message`);
  console.log(`  POST /api/ros/command - Sende Befehl an ROS`);
  console.log(`  GET /api/ros/camera-stream - Server-Sent Events Stream für Kamera-Blobs`);
  console.log(`  WS /api/ros/logs-ws - WebSocket für Log-Nachrichten (Echtzeit)`);
  
  // Starte Kamera-Subscription
  setupCameraSubscription(rosClient);
});

