import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { LogView, LogEntry } from './components/LogView';
import { ResponseLogView } from './components/ResponseLogView';
import { StatusView, ConnectionStatus } from './components/StatusView';
import { DockerView } from './components/DockerView';

function App() {
  const [streamStatus, setStreamStatus] = useState<ConnectionStatus>('disconnected');
  const [commandStatus, setCommandStatus] = useState<ConnectionStatus>('disconnected');
  const [logStatus, setLogStatus] = useState<ConnectionStatus>('disconnected');
  const [websocketLogs, setWebsocketLogs] = useState<LogEntry[]>([]);
  const [responseLogs, setResponseLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [robotImageSrc, setRobotImageSrc] = useState<string | null>(null);
  const [commandInput, setCommandInput] = useState<string>('');
  const lastTimestampRef = useRef<number>(0);
  const currentBlobUrlRef = useRef<string | null>(null); // For cleanup of blob URLs
  const hasSubscribedRef = useRef<boolean>(false); // Prevent double subscription in Strict Mode

  const addWebsocketLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setWebsocketLogs((prev) => [...prev, { timestamp, message }]);
  };

  const addResponseLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setResponseLogs((prev) => [...prev, { timestamp, message }]);
  };

  const handleImageChange = useCallback((newSrc: string | null) => {
    setRobotImageSrc(newSrc);
  }, []);

  // Clear logs on component mount (page reload)
  useEffect(() => {
    setWebsocketLogs([]);
    setResponseLogs([]);
  }, []);

  // Health check - fetch status from backend periodically
  useEffect(() => {
    const fetchHealthStatus = async () => {
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.status) {
            // Update status states from backend
            setStreamStatus(data.status.stream);
            setCommandStatus(data.status.command);
            setLogStatus(data.status.log);
          }
        }
      } catch (error) {
        console.error('Error fetching health status:', error);
        // On error, set all to disconnected
        setStreamStatus('disconnected');
        setCommandStatus('disconnected');
        setLogStatus('disconnected');
      }
    };

    // Fetch immediately
    fetchHealthStatus();
    
    // Then fetch every 1 second for faster disconnect detection
    const interval = setInterval(fetchHealthStatus, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Dedicated Server-Sent Events (SSE) stream for camera blobs
  // Starts immediately on component mount (camera subscription is automatic in backend)
  useEffect(() => {
    addResponseLog('🔄 Connecting to camera stream...');
    const eventSource = new EventSource(`/api/ros/camera-stream?since=${lastTimestampRef.current}`);

    eventSource.onopen = () => {
      addResponseLog('✅ Camera stream connected');
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
      addResponseLog('⚠️ Connection error to camera stream');
    };

    return () => {
      addResponseLog('🔌 Camera stream disconnected');
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
      addResponseLog('🔄 Auto-subscribing to /rosout...');

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
          setIsSubscribed(true);
          addResponseLog(`✅ ${data.message}`);
        } else {
          setIsSubscribed(false);
          addResponseLog(`❌ Error: ${data.error}`);
        }
      } catch (error) {
        addResponseLog(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
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
    addResponseLog(`📤 Sending command: ${command}`);

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
        addResponseLog(`✅ ${data.message}`);
      } else {
        addResponseLog(`❌ Error: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      addResponseLog(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="app">
      <div className="app-layout">
        <div className="left-panel">
          <h1>Embodied AI Agent: Chat with your robot</h1>
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
          
          <StatusView 
            streamStatus={streamStatus}
            commandStatus={commandStatus}
            logStatus={logStatus}
          />
        </div>

        <div className="right-panel">
          <div className="logs-container">
            <ResponseLogView logs={responseLogs} />
            <LogView 
              logs={websocketLogs} 
              isSubscribed={isSubscribed} 
              onLog={addWebsocketLog}
              title="System Logs"
            />
            <DockerView />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

