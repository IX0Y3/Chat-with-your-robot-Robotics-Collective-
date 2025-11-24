# Embodied AI Agent: Chat with your robot

A real-time web interface for interacting with ROS2 robots through a modern React frontend and TypeScript backend.

**Developed during the Robotics Collective Hackathon for Kinova robots.**

## Overview

This project provides a complete web-based interface for controlling and monitoring ROS2 robots. It was originally developed for **Kinova robots** during the Robotics Collective Hackathon, but can be adapted for other robots by configuring different ROS2 topics.

The system features real-time camera streaming, command execution, and comprehensive logging of robot interactions.

## Key Features

### Real-time Camera Streaming
- Live video feed from robot camera
- Server-Sent Events (SSE) for efficient streaming
- Automatic reconnection and error handling
- Responsive display with maximum dimensions (640x480px)

### Command Interface
- Send text commands to the robot
- Commands published to ROS2 `/transcription_text` topic
- Real-time status feedback and validation

### Dual Log System
- **System Logs**: Real-time WebSocket messages from ROS2 topics
- **API Responses**: HTTP responses and connection status updates
- Collapsible log sections for better organization
- Automatic message formatting based on topic type

### Docker Container Management
- Real-time view of running Docker containers
- Monitor container status and health
- Stop containers directly from the interface
- Auto-refresh every 5 seconds

### Connection Status Monitoring
- Visual indicators for Stream, Command, and Log connections
- Color-coded status (connected, connecting, error, disconnected)
- Real-time status updates via health endpoint
- Automatic polling for connection health

## Requirements

### Robot/ROS2 Environment
- **ROS2** (standard installation)
- **ros2-web-bridge** driver
  - Must be running on `ws://localhost:9090`
  - Provides WebSocket bridge to ROS2 topics
- **Docker** (optional, for container management features)
  - Required for Docker container monitoring and control

### Backend
- **Node.js** (Version 18 or higher)
- **npm** (or pnpm)
- **roslib** (ROS Bridge Client Library for JavaScript)

### Frontend
- **Node.js** (Version 18 or higher)
- **npm** (or pnpm)
- Modern browser with WebSocket and SSE support

## Quick Start

### 1. Start ROS2 Bridge

Ensure the ROS2 bridge is running:

```bash
# Start ros2-web-bridge on ws://localhost:9090
# (Implementation depends on your ros2-web-bridge setup)
```

### 2. Start Backend Server

```bash
cd backend
npm install
npm run dev    # Terminal 1: TypeScript watch mode
npm start      # Terminal 2: Start server (runs on http://localhost:3000)
```

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev    # Runs on http://localhost:5173
```

### 4. Access Application

Open your browser and navigate to `http://localhost:5173`

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              React Frontend                          │   │
│  │  (http://localhost:5173)                             │   │
│  │                                                      │   │
│  │  • Camera Stream (SSE)                               │   │
│  │  • Command Interface                                 │   │
│  │  • WebSocket Logs                                    │   │
│  │  • Status Monitoring                                 │   │
│  └───────────────┬──────────────────────────────────────┘   │
└──────────────────┼──────────────────────────────────────────┘
                   │ HTTP/WebSocket/SSE
                   │
┌──────────────────▼──────────────────────────────────────────┐
│              Express Backend Server                         │
│         (http://localhost:3000)                             │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              ROS Client (roslib)                     │   │
│  │  • Topic Subscription                                │   │
│  │  • Message Publishing                                │   │
│  │  • Connection Management                             │   │
│  └───────────────┬──────────────────────────────────────┘   │
└──────────────────┼──────────────────────────────────────────┘
                   │ WebSocket (ws://localhost:9090)
                   │
┌──────────────────▼──────────────────────────────────────────┐
│            ROS2 Web Bridge                                  │
│         (ws://localhost:9090)                               │
└──────────────────┬──────────────────────────────────────────┘
                   │ ROS2 DDS
                   │
┌──────────────────▼──────────────────────────────────────────┐
│              ROS2 Topics (Kinova)                           │
│  • /camera/color/image_raw/compressed                       │
│  • /rosout                                                  │
│  • /transcription_text                                      │
│                                                             │
│  Note: Topics can be customized for other robots            │
└─────────────────────────────────────────────────────────────┘
```


### Component Architecture

#### Frontend Layer
- **React Application**: Component-based UI with hooks for state management
- **Vite Dev Server**: Fast development with HMR and API proxying
- **Real-time Communication**:
  - Server-Sent Events (SSE) for camera stream
  - WebSocket for log messages
  - REST API for commands and subscriptions

#### Backend Layer
- **Express Server**: HTTP server and REST API endpoints
- **ROS Client**: Wrapper around roslib for ROS2 communication
- **WebSocket Server**: Real-time log message broadcasting
- **Message Storage**: Temporary storage for camera frames and logs

#### ROS2 Layer
- **ros2-web-bridge**: WebSocket bridge to ROS2 DDS network
- **ROS2 Topics**: Standard ROS2 message topics (configured for Kinova robots)
- **Robot Nodes**: ROS2 nodes running on the robot

### Data Flow

#### Camera Stream Flow
```
Robot Camera → ROS2 Topic → ros2-web-bridge → Backend ROS Client 
→ Camera Buffer → SSE Stream → Frontend EventSource → Image Display
```

#### Command Flow
```
User Input → Frontend → POST /api/ros/command → Backend ROS Client 
→ ROS2 Topic (/transcription_text) → Robot Command Handler
```

#### Log Flow
```
ROS2 Topic → Backend ROS Client → Message Storage → WebSocket Server 
→ Frontend WebSocket → Log Display
```

### API Endpoints

#### REST API
- `POST /api/ros/subscribe` - Subscribe to ROS2 topics
- `POST /api/ros/command` - Send commands to robot
- `GET /api/health` - Health check and connection status
- `GET /api/docker/ps` - List running Docker containers
- `POST /api/docker/stop` - Stop a Docker container

#### Real-time Streams
- `GET /api/ros/camera-stream` - Server-Sent Events for camera images
- `WS /api/ros/logs-ws` - WebSocket for real-time log messages

## Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── ros/
│   │   │   └── rosClient.ts          # ROS Client wrapper
│   │   ├── routes/
│   │   │   ├── subscribe.ts          # Subscribe endpoint
│   │   │   ├── command.ts            # Command endpoint
│   │   │   ├── cameraStream.ts       # Camera SSE stream
│   │   │   ├── health.ts             # Health check endpoint
│   │   │   └── docker.ts             # Docker management endpoints
│   │   ├── websocket/
│   │   │   └── logWebSocket.ts      # WebSocket server
│   │   ├── utils/
│   │   │   └── messageStorage.ts     # Message storage
│   │   └── server.ts                 # Main server
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── LogView.tsx           # WebSocket log viewer
│   │   │   ├── ResponseLogView.tsx   # API response viewer
│   │   │   ├── StatusView.tsx        # Status indicators
│   │   │   └── DockerView.tsx        # Docker container viewer
│   │   ├── App.tsx                   # Main application
│   │   ├── App.css                   # Application styles
│   │   └── main.tsx                  # Entry point
│   └── package.json
│
└── README.md
```

## Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **CSS3** - Styling

### Backend
- **Express.js 5** - Web framework
- **TypeScript** - Type safety
- **roslib** - ROS2 bridge client
- **ws** - WebSocket server

### Communication
- **Server-Sent Events (SSE)** - Camera streaming
- **WebSocket** - Real-time logs
- **REST API** - Commands and subscriptions
- **ROS2 DDS** - Robot communication

## Development

### Backend Development
```bash
cd backend
npm run dev    # Watch mode for TypeScript compilation
npm start      # Run compiled server
```

### Frontend Development
```bash
cd frontend
npm run dev    # Start Vite dev server with HMR
```

### Full Stack Development
Run all services in separate terminals:
1. ROS2 bridge (ws://localhost:9090)
2. Backend server (http://localhost:3000)
3. Frontend dev server (http://localhost:5173)

## Configuration

### Backend
- Port: `3000` (configurable in `server.ts`)
- ROS Bridge URL: `ws://localhost:9090` (configurable in `rosClient.ts`)
- CORS: Configured for `http://localhost:5173` (adjust in `server.ts` for production)

### Frontend
- Port: `5173` (configurable in `vite.config.ts`)
- API Proxy: All `/api` requests proxied to `http://localhost:3000`
- WebSocket Proxy: Enabled for `/api/ros/logs-ws`

## Adapting for Other Robots

This project was developed specifically for **Kinova robots**, but can be adapted for other robots by modifying the ROS2 topics:

### Default Topics (Kinova)
- **Camera**: `/camera/color/image_raw/compressed` (sensor_msgs/msg/CompressedImage)
- **Commands**: `/transcription_text` (std_msgs/msg/String)
- **Logs**: `/rosout` (rcl_interfaces/msg/Log)

### Customization

To adapt for a different robot:

1. **Camera Topic**: Modify in `backend/src/routes/cameraStream.ts`:
   ```typescript
   rosClient.subscribe("/your/camera/topic", "sensor_msgs/msg/CompressedImage", ...)
   ```

2. **Command Topic**: Modify in `backend/src/routes/command.ts`:
   ```typescript
   const topic = '/your/command/topic';
   ```

3. **Log Topics**: Modify subscription in `frontend/src/App.tsx`:
   ```typescript
   topic: '/your/log/topic',
   messageType: 'your/msg/Type'
   ```

The message types may also need adjustment depending on your robot's ROS2 setup.

## Error Handling

- **Connection Errors**: Visual status indicators and log messages
- **WebSocket Reconnection**: Automatic with exponential backoff
- **SSE Reconnection**: Automatic on connection loss
- **Input Validation**: Client and server-side validation
- **ROS Connection**: Automatic retry logic for camera subscription

## Browser Compatibility

- Modern browsers with ES6+ support
- WebSocket API required
- EventSource (SSE) API required
- Canvas API for image rendering
