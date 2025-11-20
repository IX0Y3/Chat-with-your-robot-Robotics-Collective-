import express, { Express, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Response as ExpressResponse } from 'express';
import { ROSClient } from './ros/rosClient.js';
import { createServer } from 'http';
import { setupCameraStreamEndpoint, setupCameraSubscription } from './stream/cameraStream.js';
import { setupLogWebSocket, sendMessageToClients } from './websocket/logWebSocket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const PORT: number = 3000;

// HTTP Server for WebSocket
const server = createServer(app);

// Store received ROS messages
const rosMessages: Array<{ topic: string; message: any; timestamp: number }> = [];
const MAX_MESSAGES = 100; // Maximum 100 messages to store

// Setup WebSocket server for log messages
setupLogWebSocket(server);

/**
 * Store message and send to WebSocket clients
 * @param topic The topic of the message
 * @param message The message to store
 */
const addRosMessage = (topic: string, message: any) => {
  const timestamp = Date.now();
  const msg = {
    topic,
    message,
    timestamp
  };
  rosMessages.push(msg);
  console.log(`Message stored: [${topic}] timestamp=${timestamp}, total=${rosMessages.length}`);
  
  // Remove old messages if too many
  if (rosMessages.length > MAX_MESSAGES) {
    rosMessages.shift();
  }
  
  // Send message to WebSocket clients
  sendMessageToClients(topic, message, timestamp);
};


// CORS for React Frontend (must be before routes)
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

// Setup camera stream endpoint
setupCameraStreamEndpoint(app);

// Start camera subscription (has retry logic, doesn't need to wait for server)
setupCameraSubscription(rosClient);

// ROS Subscription Endpoint
app.post('/api/ros/subscribe', (req: Request, res: Response) => {
  const { topic, messageType } = req.body;

  if (!topic || !messageType) {
    return res.status(400).json({ error: 'topic and messageType are required' });
  }

  // Subscribe and handle messages
  rosClient.subscribe(topic, messageType, (message: any) => {
    console.log(`[${topic}] Received:`, message);
    // Store message
    addRosMessage(topic, message);
  });

  res.json({ 
    success: true, 
    message: `Subscribed to ${topic}`,
    connected: rosClient.isConnected 
  });
});

// Command Endpoint - Processes commands from frontend and publishes them as ROS message
app.post('/api/ros/command', (req: Request, res: Response) => {
  const { command } = req.body;

  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'command is required and must be a string' });
  }

  if (!rosClient.isConnected) {
    return res.status(503).json({ error: 'ROS not connected' });
  }

  console.log(`Command received: ${command}`);

  // Publishes command to ROS topic /transcription_text
  const topic = '/transcription_text';
  const messageType = 'std_msgs/msg/String';
  const message = { data: command };

  rosClient.publish(topic, messageType, message);
  console.log(`Publishing command to ${topic}:`, message);

  // Store published message for logs
  addRosMessage(topic, message);

  res.json({ 
    success: true, 
    message: `Command '${command}' was published as ROS message`
  });
});


server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API Endpoints:`);
  console.log(`📡  POST /api/ros/subscribe - Subscribe to ROS Topic`);
  console.log(`📡  POST /api/ros/command - Send command to ROS (publishes as ROS message)`);
  console.log(`📡  GET /api/ros/camera-stream - Server-Sent Events stream for camera blobs`);
  console.log(`📡  WS /api/ros/logs-ws - WebSocket for log messages (real-time)`);
});

