import { useState, useEffect, useRef } from 'react';
import { LogEntry } from './LogView';
import '../App.css';

interface ResponseLogViewProps {
  logs: LogEntry[];
}

export const ResponseLogView = ({ logs }: ResponseLogViewProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const logContainerRef = useRef<HTMLPreElement | null>(null);

  // Auto-scroll to bottom when new logs arrive and not collapsed
  useEffect(() => {
    if (!isCollapsed && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isCollapsed]);

  return (
    <div className={`log-container ${isCollapsed ? 'collapsed' : ''}`}>
      <h3 
        className="log-title collapsible-header" 
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
        API Responses
      </h3>
      {!isCollapsed && (
        <pre className="log" ref={logContainerRef}>
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

