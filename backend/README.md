# Backend

TypeScript Backend for Embodied AI Web Interface - Connects a web application with ROS2 via WebSockets.

## Requirements

- **Node.js** (Version 18 or higher)
- **npm** (or pnpm)
- **ros2-web-bridge** driver
    - The `rosbridge` must be running on `ws://localhost:9090`
- **ROS2** standard installation
- **Docker** (optional)
    - Required for Docker container management features
    - Must be accessible from the backend server

## Tech Stack

- **Express.js** (v5.1.0) - Web framework for HTTP server and REST API
- **TypeScript** (v5.0.0) - Typed JavaScript extension
- **roslib** (v2.0.0) - ROS Bridge Client Library for JavaScript
- **ws** (v8.18.3) - WebSocket server for real-time communication
- **Node.js** - JavaScript runtime environment

## Installation

```bash
npm install
```

## Development Mode

For development with automatic TypeScript compilation in watch mode:

```bash
npm run dev
```

This starts the TypeScript compiler in watch mode. The server must be started separately:

```bash
# In a second terminal
npm start
```

**Important**: Make sure the ROS2 `rosbridge` is running before starting the backend server:

## API Endpoints

### GET `/api/health`

Health check endpoint that provides status information for all connections.

**Response:**
```json
{
  "success": true,
  "status": {
    "stream": "connected",
    "log": "connected",
    "command": "connected"
  },
  "details": {
    "ros": {
      "connected": true
    },
    "camera": {
      "active": true,
      "lastMessageTime": 1234567890
    },
    "websocket": {
      "hasClients": true,
      "clientCount": 1
    }
  }
}
```

**Status Values:**
- `connected`: Connection is active and working
- `connecting`: Connection is being established
- `disconnected`: No connection

**Description:**
- Provides real-time status for all system connections
- Monitors ROS connection, camera stream, and WebSocket clients
- Used by frontend for connection status indicators
- Includes detailed information about each component

---

### GET `/api/docker/ps`

Lists all running Docker containers.

**Response:**
```json
{
  "success": true,
  "containers": [
    {
      "ID": "abc123def456",
      "Image": "ubuntu:latest",
      "Command": "/bin/bash",
      "CreatedAt": "2025-01-15 10:30:00",
      "Status": "Up 2 hours",
      "Ports": "8080->80/tcp",
      "Names": "my-container"
    }
  ],
  "count": 1
}
```

**Errors:**
- `503`: Docker is not available or not installed
- `500`: Failed to execute docker ps

**Description:**
- Executes `docker ps` command and returns structured JSON output
- Provides information about all running containers
- Automatically parses Docker output into JSON format
- Used by frontend Docker management interface

---

### POST `/api/docker/stop`

Stops a running Docker container.

**Request Body:**
```json
{
  "containerId": "abc123def456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Container abc123def456 stopped successfully",
  "output": "abc123def456"
}
```

**Errors:**
- `400`: containerId missing or not a string
- `503`: Docker is not available or not installed
- `500`: Failed to stop container

**Description:**
- Stops a Docker container by ID or name
- Executes `docker stop` command
- Returns success confirmation
- Used by frontend for container management

---

### POST `/api/ros/subscribe`

Subscribes to a ROS2 topic and receives messages in real-time.

**Request Body:**
```json
{
  "topic": "/rosout",
  "messageType": "rcl_interfaces/msg/Log"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscribed to /rosout"
}
```

**Description:**
- Subscribes to the specified ROS2 topic
- Received messages are stored in the message storage
- Messages are forwarded to connected clients via the WebSocket `/api/ros/logs-ws`

---

### POST `/api/ros/command`

Sends a command to the robot by publishing a message on the `/transcription_text` topic.

**Request Body:**
```json
{
  "command": "move forward"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Command 'move forward' was sent to the robot"
}
```

**Errors:**
- `400`: Command missing or not a string
- `503`: ROS not connected

**Description:**
- Publishes the command as `std_msgs/msg/String` on `/transcription_text`
- Typically processed by a speech processing or command handler node
- The published message is also transmitted via the log WebSocket

---

### GET `/api/ros/camera-stream`

Server-Sent Events (SSE) stream for camera images in real-time.

**Query Parameters:**
- `since` (optional): Timestamp for incremental updates

**Response:**
- Content-Type: `text/event-stream`
- Continuous stream of Base64-encoded image data

**Event Format:**
```
data: {"data": "base64EncodedImageData", "timestamp": 1234567890}

```

**Description:**
- Streams compressed camera images from topic `/camera/color/image_raw/compressed`
- Images are transmitted as Base64-encoded strings
- Update rate: ~30 FPS (every 33ms)
- Buffer stores the last 10 images
- Automatic subscription on server start

---

### WebSocket `/api/ros/logs-ws`

WebSocket connection for real-time log messages from ROS2 topics.

**Connection:**
```
ws://localhost:3000/api/ros/logs-ws
```

**Message Format:**
```json
{
  "topic": "/rosout",
  "message": {
    "msg": "Log message content"
  },
  "timestamp": 1234567890
}
```

**Description:**
- Receives all messages from subscribed ROS2 topics
- Automatically updated when new messages arrive
- Supports multiple simultaneous client connections
- Messages are formatted based on topic type:
  - `/rosout`: Extracts `msg` field from `rcl_interfaces/msg/Log`
  - `/transcription_text`: Extracts `data` field from `std_msgs/msg/String`

## Architecture

```
┌─────────────┐
│   Frontend  │
│  (React)    │
└──────┬──────┘
       │ HTTP/WS
       │
┌──────▼───────────────────┐
│   Express Server         │
│   (Port 3000)            │
│                          │
│  ┌────────────────────┐  │
│  │   ROS Client       │  │
│  │  (roslib)          │  │
│  └─────────┬──────────┘  │
└────────────┼─────────────┘
             │ WebSocket
             │
┌────────────▼─────────────┐
│   ROS2 Bridge Server     │
│   (Port 9090)            │
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│      ROS2 Topics         │
│  - /rosout               │
│  - /transcription_text   │
│  - /camera/...           │
└──────────────────────────┘
```

## Project Structure

```
backend/
├── src/
│   ├── ros/
│   │   └── rosClient.ts          # ROS Client Wrapper
│   ├── routes/
│   │   ├── subscribe.ts          # Subscribe Endpoint
│   │   ├── command.ts            # Command Endpoint
│   │   ├── cameraStream.ts       # Camera SSE Stream
│   │   ├── health.ts             # Health Check Endpoint
│   │   └── docker.ts             # Docker Management Endpoints
│   ├── websocket/
│   │   └── logWebSocket.ts      # WebSocket for Logs
│   ├── utils/
│   │   └── messageStorage.ts     # Message Storage
│   └── server.ts                 # Main Server
├── dist/                         # Compiled JavaScript files
├── package.json
├── tsconfig.json
└── README.md
```

## CORS Configuration

The backend is configured for development with a frontend on `http://localhost:5173`. For production, the CORS configuration in `server.ts` must be adjusted.
