import { Express, Request, Response } from 'express';
import { ROSClient } from '../ros/rosClient.js';
import { addRosMessage } from '../utils/messageStorage.js';

/**
 * Setup subscribe route
 * @param app Express application
 * @param rosClient ROS client instance
 */
export const setupSubscribeRoute = (app: Express, rosClient: ROSClient): void => {
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
};

