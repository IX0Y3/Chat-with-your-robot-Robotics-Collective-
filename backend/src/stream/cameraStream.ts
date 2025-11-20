import { Express, Request, Response } from 'express';
import { ROSClient } from '../ros/rosClient.js';

// Define a buffer to store recent camera blobs
const cameraBlobs: Array<{ data: string; timestamp: number }> = [];

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
 * @param rosClient The ROSClient instance
 */
export const setupCameraSubscription = (rosClient: ROSClient): void => {
    // Wait for connection
    const checkConnection = setInterval(() => {
      if (rosClient.isConnected) {
        clearInterval(checkConnection);
        rosClient.subscribe("/camera/color/image_raw/compressed", "sensor_msgs/msg/CompressedImage", (message: any) => {
          handleCameraMessage(message);
        });
      }
    }, 1000);
    
    // Timeout after 30 seconds
    setTimeout(() => {
      clearInterval(checkConnection);
      if (!rosClient.isConnected) {
        console.warn('⚠️ ROS Connection not established within 30 seconds, cannot subscribe to camera topic.');
      }
    }, 30000);
};


