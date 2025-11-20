import { sendMessageToClients } from '../websocket/logWebSocket.js';

// Store received ROS messages
const rosMessages: Array<{ topic: string; message: any; timestamp: number }> = [];
const MAX_MESSAGES = 100; // Maximum 100 messages to store

/**
 * Store message and send to WebSocket clients
 * @param topic The topic of the message
 * @param message The message to store
 */
export const addRosMessage = (topic: string, message: any): void => {
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

