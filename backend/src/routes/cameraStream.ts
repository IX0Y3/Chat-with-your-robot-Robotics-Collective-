import { Express, Request, Response } from 'express';
import { ROSClient } from '../ros/rosClient.js';

// Define a buffer to store recent camera blobs
const cameraBlobs: Array<{ data: string; timestamp: number }> = [];

// Track last camera message timestamp for health check
let lastCameraMessageTime: number = 0;

/**
 * Handle messages from the camera topic and store them in the buffer.
 * @param message Message received from the camera topic
 * @returns void
 */
export const handleCameraMessage = (message: any): void => {

  // Check if message is valid (not empty)
  if (!message || !message.data) {
    console.warn('⚠️ Message is empty');
    return;
  }
  
  // Convert message data (assumed to be Uint8Array) to Base64 string
  const data = new Uint8Array(message.data);
  const base64Data = Buffer.from(data).toString('base64');

  // Store the Base64 string with a timestamp
  const timestamp = Date.now();
  cameraBlobs.push({ data: base64Data, timestamp });
  lastCameraMessageTime = timestamp;
  
  // Limit buffer size to last 10 blobs
  // This is to prevent excessive memory usage
  if (cameraBlobs.length > 10) {
    cameraBlobs.shift();
  }
};

/**
 * Outsourced endpoint setup for camera SSE stream.
 * @param app The express application
 */
export const setupCameraStreamEndpoint = (app: Express): void => {

  // Camera Stream SSE Endpoint
  app.get('/api/ros/camera-stream', (req: Request, res: Response) => {

    // SSE Headers
    // Needs to allow CORS from frontend server (assumed localhost:5173)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');

    // Initial last timestamp from query parameter
    let lastTimestamp = req.query.since ? parseInt(req.query.since as string) : 0;

    // Method to send new blobs to client
    const sendBlobs = () => {
      try {
        // Filter blobs that are newer than lastTimestamp
        const newBlobs = cameraBlobs.filter(blob => blob.timestamp > lastTimestamp);
        
        // Send each new blob as SSE message
        if (newBlobs.length > 0) {

          // Send each new blob
          newBlobs.forEach(({ data, timestamp }) => {
            const message = JSON.stringify({
              data: data,
              timestamp: timestamp
            });
            // Send Data: message with ending newline
            res.write(`data: ${message}\n\n`);
            lastTimestamp = timestamp;
          });
        }
      } catch (error) {
        console.error('SSE Error while sending blobs:', error);
      }
    };

    // Send initial blobs
    sendBlobs();

    // Check for new blobs every 33ms (~30fps) and send to client
    const interval = setInterval(() => {
      if (req.socket.destroyed || req.closed) {
        clearInterval(interval);
        return;
      }
      sendBlobs();
    }, 33);

    // Cleanup in case of client disconnect
    req.on('close', () => {
      clearInterval(interval);
      console.log(`SSE Client for camera-stream disconnected`);
      res.end();
    });
  });
};

/**
 * Waits for ROS connection and subscribes to the camera topic
 * Continuously tries to subscribe while not connected (handles reconnection)
 * @param rosClient The ROSClient instance
 */
export const setupCameraSubscription = (rosClient: ROSClient): void => {
  const cameraTopic = "/camera/color/image_raw/compressed";
  const messageType = "sensor_msgs/msg/CompressedImage";
  let isSubscribed = false;

  // Continuously try to subscribe while not connected
  const checkConnection = setInterval(() => {
    if (rosClient.isConnected && !isSubscribed) {
      rosClient.subscribe(cameraTopic, messageType, (message: any) => {
        handleCameraMessage(message);
      });
      isSubscribed = true;
    } else if (!rosClient.isConnected && isSubscribed) {
      // Connection lost, reset subscription flag to retry
      console.log('⚠️ ROS connection lost, will resubscribe when reconnected...');
      isSubscribed = false;
    }
  }, 2000);
};

/**
 * Get camera stream status for health check
 * @returns Object with camera stream status information
 */
export const getCameraStreamStatus = (): { isActive: boolean; lastMessageTime: number } => {
  const CAMERA_TIMEOUT = 5000; // 5 seconds without messages = inactive
  const now = Date.now();
  const timeSinceLastMessage = now - lastCameraMessageTime;
  
  return {
    isActive: lastCameraMessageTime > 0 && timeSinceLastMessage < CAMERA_TIMEOUT,
    lastMessageTime: lastCameraMessageTime
  };
};

