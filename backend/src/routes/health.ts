import { Express, Request, Response } from 'express';
import { ROSClient } from '../ros/rosClient.js';
import { getCameraStreamStatus } from './cameraStream.js';
import { getWebSocketStatus } from '../websocket/logWebSocket.js';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

/**
 * Determine connection status based on boolean and activity
 */
const getStatus = (isConnected: boolean, isActive?: boolean): ConnectionStatus => {
  if (!isConnected) {
    return 'disconnected';
  }
  if (isActive === false) {
    return 'disconnected';
  }
  return 'connected';
};

/**
 * Setup health check route
 * @param app Express application
 * @param rosClient ROSClient instance
 */
export const setupHealthRoute = (app: Express, rosClient: ROSClient): void => {
  app.get('/api/health', (req: Request, res: Response) => {
    try {
      // Get ROS connection status
      const rosConnected = rosClient.isConnected;
      
      // Get camera stream status
      const cameraStatus = getCameraStreamStatus();
      
      // Get WebSocket status
      const wsStatus = getWebSocketStatus();
      
      // Determine status for each component
      const streamStatus: ConnectionStatus = getStatus(rosConnected, cameraStatus.isActive);
      const logStatus: ConnectionStatus = getStatus(rosConnected, wsStatus.hasClients);
      const commandStatus: ConnectionStatus = getStatus(rosConnected);
      
      // Return health status
      res.json({
        success: true,
        status: {
          stream: streamStatus,
          log: logStatus,
          command: commandStatus,
        },
        details: {
          ros: {
            connected: rosConnected
          },
          camera: {
            active: cameraStatus.isActive,
            lastMessageTime: cameraStatus.lastMessageTime
          },
          websocket: {
            hasClients: wsStatus.hasClients,
            clientCount: wsStatus.clientCount
          }
        }
      });
    } catch (error: any) {
      console.error('Error in health check:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get health status',
        message: error.message
      });
    }
  });
};

