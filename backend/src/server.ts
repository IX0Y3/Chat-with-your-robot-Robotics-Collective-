import express, { Express } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ROSClient } from './ros/rosClient.js';
import { createServer } from 'http';
import { setupCameraStreamEndpoint, setupCameraSubscription } from './routes/cameraStream.js';
import { setupLogWebSocket } from './websocket/logWebSocket.js';
import { setupSubscribeRoute } from './routes/subscribe.js';
import { setupCommandRoute } from './routes/command.js';
import { setupDockerRoute } from './routes/docker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const PORT: number = 3000;

// HTTP Server for WebSocket
const server = createServer(app);

// Setup WebSocket server for log messages
setupLogWebSocket(server);


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

// Setup routes
setupSubscribeRoute(app, rosClient);
setupCommandRoute(app, rosClient);
setupDockerRoute(app);


server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API Endpoints:`);
  console.log(`📡  POST /api/ros/subscribe - Subscribe to ROS Topic`);
  console.log(`📡  POST /api/ros/command - Send command to ROS (publishes as ROS message)`);
  console.log(`📡  GET /api/ros/camera-stream - Server-Sent Events stream for camera blobs`);
  console.log(`📡  WS /api/ros/logs-ws - WebSocket for log messages (real-time)`);
  console.log(`🐳  GET /api/docker/ps - Get Docker container list (JSON format)`);
  console.log(`🐳  GET /api/docker/ps-all - Get all Docker containers (including stopped)`);
  console.log(`🐳  POST /api/docker/start - Start a Docker container`);
  console.log(`🐳  POST /api/docker/stop - Stop a Docker container`);
});

