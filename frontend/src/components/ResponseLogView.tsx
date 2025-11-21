import { LogEntry } from './LogView';
import '../App.css';

interface ResponseLogViewProps {
  logs: LogEntry[];
}

export const ResponseLogView = ({ logs }: ResponseLogViewProps) => {
  return (
    <div className="log-container">
      <h3 className="log-title">API Responses</h3>
      <pre className="log">
        {logs.length === 0 ? 'No logs...' : logs.map((log, index) => (
          <div key={index}>
            [{log.timestamp}] {log.message}
          </div>
        ))}
      </pre>
    </div>
  );
};

