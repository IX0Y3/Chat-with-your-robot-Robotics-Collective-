import { useState } from 'react';
import './App.css';

interface LogEntry {
  timestamp: string;
  message: string;
}

function App() {
  const [status, setStatus] = useState<'getrennt' | 'verbunden' | 'Fehler'>('getrennt');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { timestamp, message }]);
  };

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
        addLog(`✓ ${data.message}`);
        addLog(`Verbindungsstatus: ${data.connected ? 'verbunden' : 'nicht verbunden'}`);
      } else {
        setStatus('Fehler');
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

