import { Express, Request, Response } from 'express';
import { ROSClient } from '../ros/rosClient.js';
import { addRosMessage } from '../utils/messageStorage.js';

/**
 * Setup command route
 * @param app Express application
 * @param rosClient ROS client instance
 */
export const setupCommandRoute = (app: Express, rosClient: ROSClient): void => {

  // Post command to ROS topic /transcription_text
  app.post('/api/ros/command', (req: Request, res: Response) => {
    const { command } = req.body;

    // Check if command is a string
    if (!command || typeof command !== 'string') {
      return res.status(400).json({ error: 'command is required and must be a string' });
    }

    // Check if ROS is connected
    if (!rosClient.isConnected) {
      return res.status(503).json({ error: 'ROS not connected' });
    }

    // Publishes command to ROS topic /transcription_text
    const topic = '/transcription_text';
    const messageType = 'std_msgs/msg/String';
    const message = { data: command };
    rosClient.publish(topic, messageType, message);

    // Store published message for logs
    addRosMessage(topic, message);

    // Return success message
    res.json({ 
      success: true, 
      message: `Command '${command}' was sent to the robot`
    });
  });
};

