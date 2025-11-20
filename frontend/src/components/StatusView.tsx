import '../App.css';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface StatusItem {
  label: string;
  status: ConnectionStatus;
}

interface StatusViewProps {
  streamStatus: ConnectionStatus;
  commandStatus: ConnectionStatus;
  logStatus: ConnectionStatus;
}

export const StatusView = ({ streamStatus, commandStatus, logStatus }: StatusViewProps) => {
  const statusItems: StatusItem[] = [
    { label: 'Stream', status: streamStatus },
    { label: 'Command', status: commandStatus },
    { label: 'Log', status: logStatus },
  ];

  const getStatusColor = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected':
        return '#22c55e'; // green
      case 'connecting':
        return '#f59e0b'; // amber
      case 'error':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  return (
    <div className="status-container">
      <div className="status-grid">
        {statusItems.map((item) => (
          <div key={item.label} className="status-item">
            <span className="status-label">{item.label}:</span>
            <span 
              className={`status status-${item.status}`}
              style={{ color: getStatusColor(item.status) }}
            >
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

