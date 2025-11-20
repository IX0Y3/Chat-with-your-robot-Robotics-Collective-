import { useState, useEffect, useRef } from 'react';
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
  const lastTimestampRef = useRef<number>(0);
  const lastLogTimeRef = useRef<number>(0);
  const logThrottleMs = 1000; // Maximal 1 Log pro Sekunde für Bild-Updates

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { timestamp, message }]);
  };

  // Server-Sent Events (SSE) für Bilder (30 FPS)
  // Backend sendet bereits nur Bilder über diesen Stream
  useEffect(() => {
    if (!isSubscribed) return;

    addLog('🔄 Verbinde mit SSE-Stream für Bilder...');
    const eventSource = new EventSource(`/api/ros/stream?since=${lastTimestampRef.current}`);

    eventSource.onopen = () => {
      addLog('✓ SSE-Stream für Bilder verbunden');
    };

    eventSource.onmessage = (event) => {
      try {
        const msg: ROSMessage = JSON.parse(event.data);
        
        // Backend sendet nur Bilder, also direkt verarbeiten
        if (msg.message && typeof msg.message === 'object') {
          let imageUrl: string | null = null;
          
          if (msg.message.image_url) imageUrl = msg.message.image_url;
          else if (msg.message.imageUrl) imageUrl = msg.message.imageUrl;
          else if (msg.message.url) imageUrl = msg.message.url;
          else if (msg.message.data) {
            if (typeof msg.message.data === 'string' && msg.message.data.startsWith('data:image')) {
              imageUrl = msg.message.data;
            } else if (typeof msg.message.data === 'string' && msg.message.data.startsWith('http')) {
              imageUrl = msg.message.data;
            }
          }
          
          if (imageUrl && typeof imageUrl === 'string') {
            handleImageChange(imageUrl);
            // Log nur bei Bildänderung und mit Throttling
            const now = Date.now();
            if (robotImageSrc !== imageUrl && (now - lastLogTimeRef.current) > logThrottleMs) {
              addLog(`🖼️ Bild aktualisiert von ${msg.topic}`);
              lastLogTimeRef.current = now;
            }
          }
        }
      } catch (error) {
        console.error('Fehler beim Parsen der SSE-Nachricht:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE Fehler:', error);
      addLog('⚠️ Verbindungsfehler zu Bild-Stream');
    };

    return () => {
      addLog('🔌 SSE-Stream getrennt');
      eventSource.close();
    };
  }, [isSubscribed, robotImageSrc]);

  // Polling für andere Nachrichten (nicht Bilder)
  useEffect(() => {
    if (!isSubscribed) return;

    const pollMessages = async () => {
      try {
        const response = await fetch(`/api/ros/messages?since=${lastTimestampRef.current}&excludeImages=true`);
        
        if (!response.ok) {
          const text = await response.text();
          console.error('API Fehler:', response.status, text);
          return;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          return;
        }

        const data = await response.json();
        
        if (data.messages && data.messages.length > 0) {
          data.messages.forEach((msg: ROSMessage) => {
            // Formatierte Anzeige der Nachricht
            const messageStr = typeof msg.message === 'object' 
              ? JSON.stringify(msg.message, null, 2)
              : String(msg.message);
            addLog(`📨 [${msg.topic}] ${messageStr}`);
            lastTimestampRef.current = msg.timestamp;
          });
        }
      } catch (error) {
        console.error('Fehler beim Abrufen der Nachrichten:', error);
      }
    };

    // Alle 500ms nach neuen Nachrichten fragen
    const interval = setInterval(pollMessages, 500);
    
    // Sofort einmal abfragen
    pollMessages();

    return () => clearInterval(interval);
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

  const handleImageChange = (newSrc: string | null) => {
    setRobotImageSrc(newSrc);
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

