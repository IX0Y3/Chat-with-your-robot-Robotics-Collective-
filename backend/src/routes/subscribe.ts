import { Express, Request, Response } from 'express';
import { ROSClient } from '../ros/rosClient.js';
import { addRosMessage } from '../utils/messageStorage.js';

/**
 * Setup subscribe route
 * @param app Express application
 * @param rosClient ROS client instance
 */
export const setupSubscribeRoute = (app: Express, rosClient: ROSClient): void => {

  // Post subscribe to ROS topic
  app.post('/api/ros/subscribe', (req: Request, res: Response) => {

    // Get topic and message type from request body
    const { topic, messageType } = req.body;

    // Check if topic and message type are provided
    if (!topic || !messageType) {
      return res.status(400).json({ error: 'topic and messageType are required' });
    }

    // Subscribe and handle messages
    rosClient.subscribe(topic, messageType, (message: any) => {
      console.log(`[${topic}] Received:`, message);
      // Store message
      addRosMessage(topic, message);
    });

    // Return success message
    res.json({ 
      success: true, 
      message: `Subscribed to ${topic}`,
    });
  });
};

