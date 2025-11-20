import { Express, Request, Response } from 'express';
import { ROSClient } from '../ros/rosClient.js';

// Kamera-Stream: Speichere Blob-Daten (Base64) für Kamera-Topic
const cameraBlobs: Array<{ data: string; timestamp: number }> = [];
const MAX_CAMERA_BLOBS = 10; // Maximal 10 Blobs speichern (für schnelle Updates)

// Dedizierte Handler-Funktion für Kamera-Nachrichten
// Konvertiert message.data (Uint8Array) zu Base64 für Übertragung
// Frontend erstellt daraus eine Blob-URL
export const handleCameraMessage = (message: any): void => {
  if (!message || !message.data) {
    console.warn('⚠️ Message is empty');
    return;
  }
  
  const data = new Uint8Array(message.data);
  const base64Data = Buffer.from(data).toString('base64');

  const timestamp = Date.now();
  cameraBlobs.push({ data: base64Data, timestamp });
  
  // Alte Blobs entfernen, wenn zu viele
  if (cameraBlobs.length > MAX_CAMERA_BLOBS) {
    cameraBlobs.shift();
  }
};

// Dedizierter Server-Sent Events (SSE) Stream für Kamera-Topic
// Sendet Blob-Daten als Base64-kodierte Strings
export const setupCameraStreamEndpoint = (app: Express): void => {

  app.get('/api/ros/camera-stream', (req: Request, res: Response) => {

    // SSE Headers setzen
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    
    console.log('SSE Client für Kamera-Stream verbunden');

    let lastTimestamp = req.query.since ? parseInt(req.query.since as string) : 0;
    let blobCount = 0;

    // Sende Blob-Daten (Base64)
    const sendBlobs = () => {
      try {
        // Filtere nur neue Blobs
        const newBlobs = cameraBlobs.filter(blob => blob.timestamp > lastTimestamp);
        
        if (newBlobs.length > 0) {
          newBlobs.forEach(({ data, timestamp }) => {
            // Sende Base64-Daten, Frontend erstellt daraus eine Blob-URL
            const message = JSON.stringify({
              data: data,
              timestamp: timestamp
            });
            res.write(`data: ${message}\n\n`);
            lastTimestamp = timestamp;
            blobCount++;
          });
          console.log(`Kamera-Stream: ${newBlobs.length} Blobs gesendet (total: ${blobCount})`);
        }
      } catch (error) {
        console.error('SSE Fehler beim Senden von Blobs:', error);
      }
    };

    // Initiale Blobs senden
    sendBlobs();

    // Prüfe alle 33ms (ca. 30 FPS) nach neuen Blobs
    const interval = setInterval(() => {
      if (req.socket.destroyed || req.closed) {
        clearInterval(interval);
        return;
      }
      sendBlobs();
    }, 33);

    // Cleanup bei Verbindungsabbruch
    req.on('close', () => {
      clearInterval(interval);
      console.log(`SSE Client für Kamera-Stream getrennt (${blobCount} Blobs gesendet)`);
      res.end();
    });
  });
};

// Automatische Subscription zum Kamera-Topic beim Server-Start
const CAMERA_TOPIC = '/camera/color/image_raw/compressed';
const CAMERA_MESSAGE_TYPE = 'sensor_msgs/msg/Image';

// Warte auf ROS-Verbindung und subscribe dann zum Kamera-Topic
export const setupCameraSubscription = (rosClient: ROSClient): void => {
  if (rosClient.isConnected) {
    console.log(`Subscribing zu Kamera-Topic: ${CAMERA_TOPIC}`);
    rosClient.subscribe(CAMERA_TOPIC, CAMERA_MESSAGE_TYPE, (message: any) => {
      console.log(`[${CAMERA_TOPIC}] Kamera-Nachricht empfangen`);
      handleCameraMessage(message);
    });
  } else {
    // Warte auf Verbindung
    const checkConnection = setInterval(() => {
      if (rosClient.isConnected) {
        clearInterval(checkConnection);
        console.log(`Subscribing zu Kamera-Topic: ${CAMERA_TOPIC}`);
        rosClient.subscribe(CAMERA_TOPIC, CAMERA_MESSAGE_TYPE, (message: any) => {
          console.log(`[${CAMERA_TOPIC}] Kamera-Nachricht empfangen`);
          handleCameraMessage(message);
        });
      }
    }, 1000);
    
    // Timeout nach 30 Sekunden
    setTimeout(() => {
      clearInterval(checkConnection);
      if (!rosClient.isConnected) {
        console.warn('ROS-Verbindung nicht hergestellt, Kamera-Subscription nicht möglich');
      }
    }, 30000);
  }
};


