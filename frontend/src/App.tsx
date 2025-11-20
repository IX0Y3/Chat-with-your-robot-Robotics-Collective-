import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

interface LogEntry {
  timestamp: string;
  message: string;
}

interface ROSMessage {
  topic: string;
  message: any;
  timestamp: number;
}

function App() {
  const [status, setStatus] = useState<'getrennt' | 'verbunden' | 'Fehler'>('getrennt');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [robotImageSrc, setRobotImageSrc] = useState<string | null>(null);
  const [commandInput, setCommandInput] = useState<string>('');
  const lastTimestampRef = useRef<number>(0);
  const lastLogTimeRef = useRef<number>(0);
  const logThrottleMs = 1000; // Maximal 1 Log pro Sekunde für Bild-Updates
  const currentBlobUrlRef = useRef<string | null>(null); // Für Cleanup von Blob-URLs

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { timestamp, message }]);
  };

  const handleImageChange = useCallback((newSrc: string | null) => {
    setRobotImageSrc(newSrc);
  }, []);

  // Dedizierter Server-Sent Events (SSE) Stream für Kamera-Blobs
  useEffect(() => {
    if (!isSubscribed) return;

    addLog('🔄 Verbinde mit Kamera-Stream...');
    const eventSource = new EventSource(`/api/ros/camera-stream?since=${lastTimestampRef.current}`);

    eventSource.onopen = () => {
      addLog('✓ Kamera-Stream verbunden');
    };

    eventSource.onmessage = (event) => {
      console.log('Kamera-Stream Nachricht erhalten');
      try {
        const blobData = JSON.parse(event.data);
        
        // Backend sendet Base64-Daten, wir erstellen daraus eine Blob-URL
        if (blobData.data && typeof blobData.data === 'string') {
          // Konvertiere Base64-String zu Uint8Array
          const base64Data = blobData.data;
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          // Erstelle Blob aus Uint8Array
          const blob = new Blob([bytes], { type: 'image/jpeg' });
          
          // Erstelle Blob-URL (die im <img> Element verwendet werden kann)
          const blobUrl = URL.createObjectURL(blob);
          
          // Cleanup alte Blob-URL
          if (currentBlobUrlRef.current) {
            URL.revokeObjectURL(currentBlobUrlRef.current);
          }
          
          currentBlobUrlRef.current = blobUrl;
          handleImageChange(blobUrl);
          
          // Log nur bei Bildänderung und mit Throttling
          const now = Date.now();
          if ((now - lastLogTimeRef.current) > logThrottleMs) {
            addLog(`🖼️ Kamera-Bild aktualisiert (${bytes.length} bytes)`);
            lastLogTimeRef.current = now;
          }
        }
      } catch (error) {
        console.error('Fehler beim Verarbeiten der Kamera-Blob-Daten:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Kamera-Stream Fehler:', error);
      addLog('⚠️ Verbindungsfehler zu Kamera-Stream');
    };

    return () => {
      addLog('🔌 Kamera-Stream getrennt');
      eventSource.close();
      // Cleanup Blob-URL beim Unmount
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
        currentBlobUrlRef.current = null;
      }
    };
  }, [isSubscribed, handleImageChange]);

  // WebSocket für Log-Nachrichten (nicht Bilder) - effizienter als Polling
  useEffect(() => {
    if (!isSubscribed) return;

    addLog('🔄 Verbinde mit WebSocket für Logs...');
    
    // WebSocket-URL: Vite Proxy leitet /api weiter
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const ws = new WebSocket(`${wsProtocol}//${wsHost}/api/ros/logs-ws`);

    ws.onopen = () => {
      addLog('✓ WebSocket für Logs verbunden');
    };

    ws.onmessage = (event) => {
      try {
        const msg: ROSMessage = JSON.parse(event.data);
        
        // Formatierte Anzeige der Nachricht
        const messageStr = typeof msg.message === 'object' 
          ? JSON.stringify(msg.message, null, 2)
          : String(msg.message);
        addLog(`📨 [${msg.topic}] ${messageStr}`);
        lastTimestampRef.current = msg.timestamp;
      } catch (error) {
        console.error('Fehler beim Parsen der WebSocket-Nachricht:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket Fehler:', error);
      addLog('⚠️ WebSocket-Fehler für Logs');
    };

    ws.onclose = () => {
      addLog('🔌 WebSocket für Logs getrennt');
    };

    return () => {
      ws.close();
    };
  }, [isSubscribed]);

  const handleSubscribe = async () => {
    setIsLoading(true);
    addLog('Subscribing zu /example_topic...');

    try {
      const response = await fetch('/api/ros/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: '/example_topic',
          messageType: 'std_msgs/msg/String',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('verbunden');
        setIsSubscribed(true);
        addLog(`✓ ${data.message}`);
        addLog(`Verbindungsstatus: ${data.connected ? 'verbunden' : 'nicht verbunden'}`);
        addLog('🔄 Starte Polling für ROS-Nachrichten...');
      } else {
        setStatus('Fehler');
        setIsSubscribed(false);
        addLog(`✗ Fehler: ${data.error}`);
      }
    } catch (error) {
      setStatus('Fehler');
      addLog(`✗ Fehler: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async () => {
    setIsLoading(true);
    addLog('Publishe Nachricht...');

    try {
      const response = await fetch('/api/ros/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: '/example_topic',
          messageType: 'std_msgs/msg/String',
          message: {
            data: 'Hallo aus dem React Frontend!'
          },
        }),
      });

      const data = await response.json();

      if (response.ok) {
        addLog(`✓ ${data.message}`);
      } else {
        addLog(`✗ Fehler: ${data.error}`);
      }
    } catch (error) {
      addLog(`✗ Fehler: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };


  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    const command = commandInput.trim();
    setCommandInput('');
    addLog(`📤 Sende Befehl: ${command}`);

    try {
      const response = await fetch('/api/ros/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command }),
      });

      const data = await response.json();

      if (response.ok) {
        addLog(`✓ Befehl erfolgreich: ${data.message || 'Ausgeführt'}`);
      } else {
        addLog(`✗ Fehler: ${data.error || 'Unbekannter Fehler'}`);
      }
    } catch (error) {
      addLog(`✗ Fehler: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="app">
      <h1>ROS2 Web Demo</h1>
      
      <div className="robot-image-container">
        {robotImageSrc ? (
          <img 
            id="robot-image" 
            src={robotImageSrc} 
            alt="Robot Image" 
            className="robot-image"
            onError={() => {
              // Wenn Bild nicht geladen werden kann, zeige schwarzen Kasten
              handleImageChange(null);
            }}
          />
        ) : (
          <div className="robot-image-placeholder">
            <span>Kein Signal</span>
          </div>
        )}
      </div>
      
      <div className="status-container">
        <p>
          Status:{' '}
          <span className={`status status-${status.toLowerCase()}`}>
            {status}
          </span>
        </p>
      </div>

      <div className="button-group">
        <button
          onClick={handleSubscribe}
          disabled={isLoading}
          className="subscribe-button"
        >
          {isLoading ? 'Verbinde...' : 'Zu ROS Topic subscriben'}
        </button>
        
        <button
          onClick={handlePublish}
          disabled={isLoading || status !== 'verbunden'}
          className="publish-button"
        >
          Nachricht publishen
        </button>
      </div>

      <div className="command-container">
        <h2>Befehl senden</h2>
        <form onSubmit={handleCommandSubmit} className="command-form">
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Befehl eingeben..."
            className="command-input"
            disabled={status !== 'verbunden'}
          />
          <button
            type="submit"
            disabled={!commandInput.trim() || status !== 'verbunden' || isLoading}
            className="command-button"
          >
            Senden
          </button>
        </form>
      </div>

      <div className="log-container">
        <h2>Log</h2>
        <pre className="log">
          {logs.length === 0 ? 'Keine Logs...' : logs.map((log, index) => (
            <div key={index}>
              [{log.timestamp}] {log.message}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

export default App;

