import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { LogView, LogEntry } from './components/LogView';
import { StatusView, ConnectionStatus } from './components/StatusView';

function App() {
  const [streamStatus, setStreamStatus] = useState<ConnectionStatus>('disconnected');
  const [commandStatus, setCommandStatus] = useState<ConnectionStatus>('disconnected');
  const [logStatus, setLogStatus] = useState<ConnectionStatus>('disconnected');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [robotImageSrc, setRobotImageSrc] = useState<string | null>(null);
  const [commandInput, setCommandInput] = useState<string>('');
  const lastTimestampRef = useRef<number>(0);
  const currentBlobUrlRef = useRef<string | null>(null); // For cleanup of blob URLs
  const hasSubscribedRef = useRef<boolean>(false); // Prevent double subscription in Strict Mode

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { timestamp, message }]);
  };

  const handleImageChange = useCallback((newSrc: string | null) => {
    setRobotImageSrc(newSrc);
  }, []);

  // Clear logs on component mount (page reload)
  useEffect(() => {
    setLogs([]);
  }, []);
  

  // Dedicated Server-Sent Events (SSE) stream for camera blobs
  // Starts immediately on component mount (camera subscription is automatic in backend)
  useEffect(() => {
    setStreamStatus('connecting');
    addLog('🔄 Connecting to camera stream...');
    const eventSource = new EventSource(`/api/ros/camera-stream?since=${lastTimestampRef.current}`);

    eventSource.onopen = () => {
      setStreamStatus('connected');
      addLog('✅ Camera stream connected');
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
      setStreamStatus('error');
      addLog('⚠️ Connection error to camera stream');
    };

    return () => {
      setStreamStatus('disconnected');
      addLog('🔌 Camera stream disconnected');
      eventSource.close();
      // Cleanup blob URL on unmount
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
        currentBlobUrlRef.current = null;
      }
    };
  }, [handleImageChange]);

  // Automatically subscribe to /rosout on component mount
  useEffect(() => {
    // Prevent double subscription in React Strict Mode
    if (hasSubscribedRef.current) {
      return;
    }
    hasSubscribedRef.current = true;

    const subscribeToRosout = async () => {
      setIsLoading(true);
      setCommandStatus('connecting');
      addLog('🔄 Auto-subscribing to /rosout...');

      try {
        const response = await fetch('/api/ros/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            topic: '/rosout',
            messageType: 'rcl_interfaces/msg/Log',
          }),
        });

        const data = await response.json();

        if (response.ok) {
          setCommandStatus('connected');
          setIsSubscribed(true);
          addLog(`✅ ${data.message}`);
        } else {
          setCommandStatus('error');
          setIsSubscribed(false);
          addLog(`❌ Error: ${data.error}`);
        }
      } catch (error) {
        setCommandStatus('error');
        addLog(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsLoading(false);
      }
    };

    subscribeToRosout();
  }, []);



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
        addLog(`✓ ${data.message}`);
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
      
      <StatusView 
        streamStatus={streamStatus}
        commandStatus={commandStatus}
        logStatus={logStatus}
      />

      <div className="command-container">
        <h2>Send Command</h2>
        <form onSubmit={handleCommandSubmit} className="command-form">
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (commandInput.trim() && commandStatus === 'connected' && !isLoading) {
                  handleCommandSubmit(e as any);
                }
              }
            }}
            placeholder="Enter command..."
            className="command-input"
            disabled={commandStatus !== 'connected'}
          />
          <button
            type="submit"
            disabled={!commandInput.trim() || commandStatus !== 'connected' || isLoading}
            className="command-button"
          >
            Send
          </button>
        </form>
      </div>

      <LogView 
        logs={logs} 
        isSubscribed={isSubscribed} 
        onLog={addLog}
        onStatusChange={setLogStatus}
      />
    </div>
  );
}

export default App;

