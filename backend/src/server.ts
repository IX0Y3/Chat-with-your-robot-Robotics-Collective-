import express, { Express, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Response as ExpressResponse } from 'express';
import { ROSClient } from './ros/rosClient.js';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const PORT: number = 3000;

// HTTP Server für WebSocket
const server = createServer(app);

// Speichere empfangene ROS-Nachrichten
const rosMessages: Array<{ topic: string; message: any; timestamp: number }> = [];
const MAX_MESSAGES = 100; // Maximal 100 Nachrichten speichern

// Helper: Prüft ob eine Nachricht ein Bild enthält
// Muss vor addRosMessage definiert werden, da dort verwendet
const isImageMessage = (message: any): boolean => {
  if (!message || typeof message !== 'object') return false;
  
  if (message.image_url || message.imageUrl) return true;
  if (message.url && typeof message.url === 'string' && 
      (message.url.startsWith('http') || message.url.startsWith('data:image'))) return true;
  if (message.data && typeof message.data === 'string' && 
      (message.data.startsWith('data:image') || message.data.startsWith('http'))) return true;
  
  return false;
};

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

// Helper: Nachricht speichern und an WebSocket-Clients senden (nur nicht-Bilder)
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
  
  // Sende nur nicht-Bild-Nachrichten über WebSocket
  if (!isImageMessage(message) && logClients.size > 0) {
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

// Server-Sent Events (SSE) für Bilder (30 FPS)
// Sendet nur Bild-Nachrichten über diesen Stream
app.get('/api/ros/stream', (req: Request, res: Response) => {
  // SSE Headers setzen
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx buffering deaktivieren
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  
  console.log('SSE Client verbunden (nur Bilder)');

  let lastTimestamp = req.query.since ? parseInt(req.query.since as string) : 0;
  let messageCount = 0;

  // Sende initiale Nachrichten (nur Bilder)
  const sendMessages = () => {
    try {
      // Filtere nur Bild-Nachrichten
      const filteredMessages = rosMessages
        .filter(msg => msg.timestamp > lastTimestamp)
        .filter(msg => isImageMessage(msg.message));
      
      if (filteredMessages.length > 0) {
        filteredMessages.forEach((msg) => {
          res.write(`data: ${JSON.stringify(msg)}\n\n`);
          lastTimestamp = msg.timestamp;
          messageCount++;
        });
        console.log(`SSE (Bilder): ${filteredMessages.length} Bilder gesendet (total: ${messageCount})`);
      }
    } catch (error) {
      console.error('SSE Fehler beim Senden:', error);
    }
  };

  // Initiale Nachrichten senden
  sendMessages();

  // Prüfe alle 33ms (ca. 30 FPS) nach neuen Nachrichten
  const interval = setInterval(() => {
    if (req.socket.destroyed || req.closed) {
      clearInterval(interval);
      return;
    }
    sendMessages();
  }, 33);

  // Cleanup bei Verbindungsabbruch
  req.on('close', () => {
    clearInterval(interval);
    console.log(`SSE Client getrennt (${messageCount} Bilder gesendet)`);
    res.end();
  });
});

server.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
  console.log(`API Endpoints:`);
  console.log(`  POST /api/ros/subscribe - Subscribe zu ROS Topic`);
  console.log(`  POST /api/ros/publish - Publish ROS Message`);
  console.log(`  GET /api/ros/stream - Server-Sent Events Stream für Bilder (30 FPS)`);
  console.log(`  WS /api/ros/logs-ws - WebSocket für Log-Nachrichten (Echtzeit)`);
});

