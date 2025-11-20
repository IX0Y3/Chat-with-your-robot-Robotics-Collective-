import { Express, Request, Response } from 'express';
import { ROSClient } from '../ros/rosClient.js';
import { addRosMessage } from '../utils/messageStorage.js';

/**
 * Setup command route
 * @param app Express application
 * @param rosClient ROS client instance
 */
export const setupCommandRoute = (app: Express, rosClient: ROSClient): void => {
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
};

