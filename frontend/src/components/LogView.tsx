import { useEffect, useRef, useState } from 'react';
import '../App.css';

export interface LogEntry {
  timestamp: string;
  message: string;
}

interface ROSMessage {
  topic: string;
  message: any;
  timestamp: number;
}

interface LogViewProps {
  logs: LogEntry[];
  isSubscribed: boolean;
  onLog: (message: string) => void;
  title?: string;
}

export const LogView = ({ logs, isSubscribed, onLog, title }: LogViewProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const lastTimestampRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  // WebSocket for log messages (not images) - more efficient than polling
  useEffect(() => {
    if (!isSubscribed) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      return;
    }

    const connectWebSocket = () => {
      // Don't connect if already connected
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      // Clean up existing connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      if (reconnectAttemptsRef.current === 0) {
        onLog('🔄 Connecting to WebSocket for logs...');
      }
      
      // WebSocket URL: Vite proxy forwards /api
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      const ws = new WebSocket(`${wsProtocol}//${wsHost}/api/ros/logs-ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        onLog('✅ WebSocket for logs connected');
      };

      ws.onmessage = (event) => {
        try {
          const rosMessage: ROSMessage = JSON.parse(event.data);
          
          // Format message based on topic type
          let textMessageContent: string;
          if (rosMessage.topic === '/rosout') {
            // rcl_interfaces/msg/Log format
            textMessageContent = rosMessage.message.msg || String(rosMessage.message);
          } else if (rosMessage.topic === '/transcription_text') {
            // std_msgs/msg/String format
            textMessageContent = rosMessage.message.data || String(rosMessage.message);
          } else {
            textMessageContent = `Unknown message format: ${JSON.stringify(rosMessage.message, null, 2)}`;
          }
          
          onLog(`📨 [${rosMessage.topic}] ${textMessageContent}`);
          lastTimestampRef.current = rosMessage.timestamp;
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (reconnectAttemptsRef.current === 0) {
          onLog('⚠️ WebSocket error for logs');
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        
        // Only log disconnect if it wasn't intentional
        if (isSubscribed && reconnectAttemptsRef.current === 0) {
          onLog('🔌 WebSocket for logs disconnected');
        }

        // Reconnect with exponential backoff (max 5 seconds)
        if (isSubscribed) {
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 5000);
          
          reconnectTimeoutRef.current = window.setTimeout(() => {
            if (isSubscribed) {
              connectWebSocket();
            }
          }, delay);
        }
      };
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      reconnectAttemptsRef.current = 0;
    };
  }, [isSubscribed]); // Only depend on isSubscribed

  return (
    <div className={`log-container ${isCollapsed ? 'collapsed' : ''}`}>
      {title && (
        <h3 
          className="log-title collapsible-header" 
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
          {title}
        </h3>
      )}
      {!isCollapsed && (
        <pre className="log">
          {logs.length === 0 ? 'No logs...' : logs.map((log, index) => (
            <div key={index}>
              [{log.timestamp}] {log.message}
            </div>
          ))}
        </pre>
      )}
    </div>
  );
};

