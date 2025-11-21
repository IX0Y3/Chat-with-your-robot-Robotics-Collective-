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
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchDockerContainers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/docker/ps');
      
      // Check if response is ok and content type is JSON
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 100)}`);
      }

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

  const handleStopContainer = async (containerId: string) => {
    setActionLoading(containerId);
    try {
      const response = await fetch('/api/docker/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ containerId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 100)}`);
      }

      const data = await response.json();

      if (data.success) {
        // Refresh container list after successful stop
        await fetchDockerContainers();
      } else {
        setError(data.error || 'Failed to stop container');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionLoading(null);
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
                  fontStyle: 'italic',
                  marginBottom: '12px'
                }}>
                  Last updated: {lastUpdate}
                </div>
              )}
              {containers.map((container, index) => {
                const isRunning = container.Status?.includes('Up');
                const isActionLoading = actionLoading === container.ID;
                
                return (
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
                      color: '#374151',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div style={{ fontSize: '14px', color: '#374151', flex: 1 }}>
                      <span style={{ fontWeight: 'bold', color: '#1f2937' }}>{container.Names || 'Unnamed'}</span>
                      {' '}(<span style={{ color: '#6b7280' }}>{container.ID?.substring(0, 12)}</span>)
                      {' '}-{' '}
                      <span style={{ color: isRunning ? '#22c55e' : '#ef4444' }}>{container.Status}</span>
                    </div>
                    {isRunning && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleStopContainer(container.ID)}
                          disabled={isActionLoading}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isActionLoading ? 'not-allowed' : 'pointer',
                            opacity: isActionLoading ? 0.6 : 1
                          }}
                        >
                          {isActionLoading ? '...' : 'Stop'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
};

