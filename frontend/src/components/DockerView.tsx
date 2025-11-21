import { useState, useEffect } from 'react';
import '../App.css';

interface DockerContainer {
  ID: string;
  Image: string;
  Command: string;
  CreatedAt: string;
  Status: string;
  Ports: string;
  Names: string;
}

interface DockerResponse {
  success: boolean;
  containers: DockerContainer[];
  count: number;
  error?: string;
  message?: string;
}

export const DockerView = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  const fetchDockerContainers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/docker/ps');
      const data: DockerResponse = await response.json();

      if (data.success && data.containers) {
        setContainers(data.containers);
        setLastUpdate(new Date().toLocaleTimeString());
      } else {
        setError(data.error || 'Failed to fetch Docker containers');
        setContainers([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setContainers([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and when expanded
  useEffect(() => {
    if (!isCollapsed) {
      fetchDockerContainers();
      // Auto-refresh every 5 seconds when expanded
      const interval = setInterval(fetchDockerContainers, 5000);
      return () => clearInterval(interval);
    }
  }, [isCollapsed]);

  return (
    <div className={`log-container ${isCollapsed ? 'collapsed' : ''}`}>
      <h3 
        className="log-title collapsible-header" 
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
        Docker Containers {containers.length > 0 && `(${containers.length})`}
      </h3>
      {!isCollapsed && (
        <div className="log">
          {loading && containers.length === 0 && (
            <div style={{ color: '#6b7280' }}>Loading...</div>
          )}
          {error && (
            <div style={{ color: '#ef4444', marginBottom: '12px' }}>
              ⚠️ Error: {error}
            </div>
          )}
          {!loading && containers.length === 0 && !error && (
            <div style={{ color: '#6b7280' }}>No containers running</div>
          )}
          {containers.length > 0 && (
            <>
              {lastUpdate && (
                <div style={{ 
                  fontSize: '12px', 
                  color: '#6b7280', 
                  marginBottom: '12px',
                  fontStyle: 'italic'
                }}>
                  Last updated: {lastUpdate}
                </div>
              )}
              {containers.map((container, index) => (
                <div 
                  key={container.ID || index} 
                  style={{ 
                    marginBottom: '16px', 
                    marginRight: '16px',
                    padding: '12px', 
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                    color: '#374151'
                  }}
                >
                  <div style={{ fontSize: '14px', color: '#374151' }}>
                    <span style={{ fontWeight: 'bold', color: '#1f2937' }}>{container.Names || 'Unnamed'}</span>
                    {' '}(<span style={{ color: '#6b7280' }}>{container.ID?.substring(0, 12)}</span>)
                    {' '}-{' '}
                    <span style={{ color: container.Status?.includes('Up') ? '#22c55e' : '#ef4444' }}>{container.Status}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

