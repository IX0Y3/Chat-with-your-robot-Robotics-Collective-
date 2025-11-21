import { useState } from 'react';
import { LogEntry } from './LogView';
import '../App.css';

interface ResponseLogViewProps {
  logs: LogEntry[];
}

export const ResponseLogView = ({ logs }: ResponseLogViewProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

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

