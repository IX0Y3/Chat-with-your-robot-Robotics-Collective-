import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

// WebSocket clients for log messages
const logClients = new Set<WebSocket>();

/**
 * Setup WebSocket server for log messages
 * @param server HTTP server instance
 */
export const setupLogWebSocket = (server: Server): void => {

  // Create WebSocket server
  const wss = new WebSocketServer({ 
    server,
    path: '/api/ros/logs-ws'
  });

  // Log connection
  wss.on('connection', (ws: WebSocket) => {
    console.log('✅ WebSocket client for logs connected');
    logClients.add(ws);
    
    ws.on('close', () => {
      console.log('⚠️ WebSocket client for logs disconnected');
      logClients.delete(ws);
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      logClients.delete(ws);
    });
  });
};

/**
 * Send message to all connected WebSocket clients
 * @param topic The topic of the message
 * @param message The message to send
 * @param timestamp The timestamp of the message
 */
export const sendMessageToClients = (topic: string, message: any, timestamp: number): void => {

  // If no clients are connected, return
  if (logClients.size === 0) {
    return;
  }

  // Create data object
  const data = JSON.stringify({
    topic,
    message,
    timestamp
  });

  // Send data to all connected clients
  logClients.forEach((client) => {
    // If client is open, send data
    if (client.readyState === WebSocket.OPEN) {
      // Send data
      client.send(data);
    } else {
      // If client is not open, remove from clients
      logClients.delete(client);
    }
  });
};

