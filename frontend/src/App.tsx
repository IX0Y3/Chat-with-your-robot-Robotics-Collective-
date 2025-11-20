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
  const lastTimestampRef = useRef<number>(0);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { timestamp, message }]);
  };

  // Polling für ROS-Nachrichten vom Backend
  useEffect(() => {
    if (!isSubscribed) return;

    const pollMessages = async () => {
      try {
        const response = await fetch(`/api/ros/messages?since=${lastTimestampRef.current}`);
        
        // Prüfe ob Response OK ist und Content-Type JSON ist
        if (!response.ok) {
          const text = await response.text();
          console.error('API Fehler:', response.status, text);
          return;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('Unerwarteter Content-Type:', contentType, text.substring(0, 100));
          return;
        }

        const data = await response.json();
        
        // Debug: Zeige wie viele Nachrichten gefunden wurden
        if (data.messages && data.messages.length > 0) {
          console.log(`Polling: ${data.messages.length} neue Nachrichten gefunden`);
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
        // Nur einmal loggen, nicht bei jedem Poll
        if (error instanceof Error && !error.message.includes('JSON')) {
          addLog(`⚠️ Fehler beim Abrufen der Nachrichten: ${error.message}`);
        }
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

  return (
    <div className="app">
      <h1>ROS2 Web Demo</h1>
      
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

