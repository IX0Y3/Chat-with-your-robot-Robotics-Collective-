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
  const [status, setStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [robotImageSrc, setRobotImageSrc] = useState<string | null>(null);
  const [commandInput, setCommandInput] = useState<string>('');
  const lastTimestampRef = useRef<number>(0);
  const currentBlobUrlRef = useRef<string | null>(null); // For cleanup of blob URLs

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { timestamp, message }]);
  };

  const handleImageChange = useCallback((newSrc: string | null) => {
    setRobotImageSrc(newSrc);
  }, []);

  // Dedicated Server-Sent Events (SSE) stream for camera blobs
  useEffect(() => {
    if (!isSubscribed) return;

    addLog('🔄 Connecting to camera stream...');
    const eventSource = new EventSource(`/api/ros/camera-stream?since=${lastTimestampRef.current}`);

    eventSource.onopen = () => {
      addLog('✓ Camera stream connected');
    };

    eventSource.onmessage = (event) => {
      console.log('Camera stream message received');
      try {
        const blobData = JSON.parse(event.data);
        
        // Backend sends Base64 data, we create a blob URL from it
        if (blobData.data && typeof blobData.data === 'string') {
          // Convert Base64 string to Uint8Array
          const base64Data = blobData.data;
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          // Create blob from Uint8Array
          const blob = new Blob([bytes], { type: 'image/jpeg' });
          
          // Create blob URL (can be used in <img> element)
          const blobUrl = URL.createObjectURL(blob);
          
          // Cleanup old blob URL
          if (currentBlobUrlRef.current) {
            URL.revokeObjectURL(currentBlobUrlRef.current);
          }
          
          currentBlobUrlRef.current = blobUrl;
          handleImageChange(blobUrl);
        }
      } catch (error) {
        console.error('Error processing camera blob data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Camera stream error:', error);
      addLog('⚠️ Connection error to camera stream');
    };

    return () => {
      addLog('🔌 Camera stream disconnected');
      eventSource.close();
      // Cleanup blob URL on unmount
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
        currentBlobUrlRef.current = null;
      }
    };
  }, [isSubscribed, handleImageChange]);

  // WebSocket for log messages (not images) - more efficient than polling
  useEffect(() => {
    if (!isSubscribed) return;

    addLog('🔄 Connecting to WebSocket for logs...');
    
    // WebSocket URL: Vite proxy forwards /api
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const ws = new WebSocket(`${wsProtocol}//${wsHost}/api/ros/logs-ws`);

    ws.onopen = () => {
      addLog('✓ WebSocket for logs connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg: ROSMessage = JSON.parse(event.data);
        
        // Formatted display of message
        const messageStr = typeof msg.message === 'object' 
          ? JSON.stringify(msg.message, null, 2)
          : String(msg.message);
        addLog(`📨 [${msg.topic}] ${messageStr}`);
        lastTimestampRef.current = msg.timestamp;
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      addLog('⚠️ WebSocket error for logs');
    };

    ws.onclose = () => {
      addLog('🔌 WebSocket for logs disconnected');
    };

    return () => {
      ws.close();
    };
  }, [isSubscribed]);

  const handleSubscribe = async () => {
    setIsLoading(true);
    addLog('Subscribing to /example_topic...');

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
        setStatus('connected');
        setIsSubscribed(true);
        addLog(`✓ ${data.message}`);
        addLog(`Connection status: ${data.connected ? 'connected' : 'not connected'}`);
        addLog('🔄 Starting polling for ROS messages...');
      } else {
        setStatus('error');
        setIsSubscribed(false);
        addLog(`✗ Error: ${data.error}`);
      }
    } catch (error) {
      setStatus('error');
      addLog(`✗ Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };



  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    const command = commandInput.trim();
    setCommandInput('');
    addLog(`📤 Sending command: ${command}`);

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
        addLog(`✓ Command successful: ${data.message || 'Executed'}`);
      } else {
        addLog(`✗ Error: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      addLog(`✗ Error: ${error instanceof Error ? error.message : String(error)}`);
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
              // If image cannot be loaded, show placeholder
              handleImageChange(null);
            }}
          />
        ) : (
          <div className="robot-image-placeholder">
            <span>No Signal</span>
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
          {isLoading ? 'Connecting...' : 'Subscribe to ROS Topic'}
        </button>
      </div>

      <div className="command-container">
        <h2>Send Command</h2>
        <form onSubmit={handleCommandSubmit} className="command-form">
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Enter command..."
            className="command-input"
            disabled={status !== 'connected'}
          />
          <button
            type="submit"
            disabled={!commandInput.trim() || status !== 'connected' || isLoading}
            className="command-button"
          >
            Send
          </button>
        </form>
      </div>

      <div className="log-container">
        <h2>Log</h2>
        <pre className="log">
          {logs.length === 0 ? 'No logs...' : logs.map((log, index) => (
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

