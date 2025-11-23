# Frontend

React Frontend for Embodied AI Web Interface - Real-time web interface for interacting with ROS2 robots.

## Requirements

- **Node.js** (Version 18 or higher)
- **npm** (or pnpm)
- **Backend Server** running on `http://localhost:3000`

## Tech Stack

- **React** (v18.2.0) - UI library for building user interfaces
- **TypeScript** (v5.0.0) - Typed JavaScript extension
- **Vite** (v5.0.0) - Fast build tool and development server
- **CSS3** - Styling with modern CSS features

## Installation

```bash
npm install
```

## Development Mode

Start the development server with hot module replacement:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

**Important**: Make sure the backend server is running on `http://localhost:3000` before starting the frontend.

## Features

### Real-time Camera Stream
- Displays live camera feed from the robot
- Uses Server-Sent Events (SSE) for efficient streaming
- Automatic reconnection on connection loss
- Maximum dimensions: 640x480px
- Responsive sizing based on available space

### Command Interface
- Send commands to the robot via text input
- Commands are published to ROS2 `/transcription_text` topic
- Real-time status feedback
- Input validation and error handling

### Dual Log System
- **System Logs**: WebSocket messages from ROS2 topics
  - Real-time updates from subscribed topics
  - Formatted display of ROS messages
  - Collapsible interface
- **API Responses**: HTTP responses and connection status
  - Command responses
  - Connection status updates
  - Error messages
  - Collapsible interface

### Docker Container Management
- Real-time monitoring of running Docker containers
- Container status and health information
- Stop containers directly from the interface
- Auto-refresh every 5 seconds when panel is open
- Collapsible interface with container count

### Connection Status
- Visual status indicators for:
  - **Stream**: Camera stream connection status
  - **Command**: ROS command connection status
  - **Log**: WebSocket log connection status
- Color-coded status (green: connected, amber: connecting, red: error, gray: disconnected)
- Automatic polling of health endpoint for real-time updates

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── LogView.tsx           # WebSocket log viewer component
│   │   ├── ResponseLogView.tsx    # API response log viewer component
│   │   ├── StatusView.tsx         # Connection status display
│   │   └── DockerView.tsx         # Docker container management
│   ├── App.tsx                    # Main application component
│   ├── App.css                    # Application styles
│   ├── index.css                  # Global styles
│   ├── main.tsx                   # Application entry point
│   └── vite-env.d.ts             # Vite type definitions
├── index.html                     # HTML template
├── vite.config.ts                # Vite configuration
├── tsconfig.json                 # TypeScript configuration
├── package.json
└── README.md
```

## Components

### App.tsx
Main application component that manages:
- State for all connections (stream, command, log)
- Camera image source
- Command input handling
- Log management (WebSocket and API responses)
- Automatic subscription to `/rosout` topic on mount
- Health check polling for connection status

### LogView.tsx
Component for displaying WebSocket messages:
- Connects to `/api/ros/logs-ws` WebSocket
- Displays messages from subscribed ROS2 topics
- Formats messages based on topic type:
  - `/rosout`: Extracts `msg` field
  - `/transcription_text`: Extracts `data` field
- Collapsible interface
- Automatic reconnection with exponential backoff

### ResponseLogView.tsx
Component for displaying API responses:
- Shows HTTP response messages
- Connection status updates
- Error messages
- Collapsible interface

### StatusView.tsx
Component for displaying connection status:
- Visual status indicators
- Color-coded status display
- Real-time status updates from health endpoint

### DockerView.tsx
Component for Docker container management:
- Lists all running Docker containers
- Displays container ID, name, status, and ports
- Provides stop button for running containers
- Auto-refresh every 5 seconds when expanded
- Collapsible interface
- Error handling for Docker availability

## API Integration

### Server-Sent Events (SSE)
- **Endpoint**: `GET /api/ros/camera-stream`
- **Purpose**: Real-time camera image streaming
- **Implementation**: Uses `EventSource` API
- **Update Rate**: ~30 FPS
- **Data Format**: Base64-encoded JPEG images

### WebSocket
- **Endpoint**: `WS /api/ros/logs-ws`
- **Purpose**: Real-time log messages from ROS2 topics
- **Implementation**: Native WebSocket API
- **Message Format**: JSON with topic, message, and timestamp
- **Reconnection**: Automatic with exponential backoff

### REST API
- **POST /api/ros/subscribe**: Subscribe to ROS2 topics
- **POST /api/ros/command**: Send commands to robot
- **GET /api/health**: Health check and connection status
- **GET /api/docker/ps**: List running Docker containers
- **POST /api/docker/stop**: Stop a Docker container
- **Proxy Configuration**: All `/api` requests are proxied to `http://localhost:3000`

## Vite Configuration

The Vite configuration includes:
- React plugin for JSX support
- Development server on port 5173
- Proxy configuration for API requests
- WebSocket proxy support
- SSE-specific proxy headers

## Browser Compatibility

- Modern browsers with ES6+ support
- WebSocket API support required
- EventSource (SSE) API support required
- Canvas API for image rendering

## Development Tips

- The frontend automatically connects to the backend on startup
- Camera stream starts immediately on component mount
- `/rosout` topic subscription happens automatically
- Health endpoint is polled every 2 seconds for connection status
- Docker view auto-refreshes every 5 seconds when expanded
- Logs are cleared on page reload
- All timestamps use local time format
