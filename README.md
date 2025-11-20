# Chat with your Robot - Robotics Collective

ROS2 Web Demo mit React Frontend und TypeScript Backend.

## Installation

```bash
# Alle Dependencies installieren
npm run install:all

# Oder einzeln:
npm run install:backend
npm run install:frontend
```

## Development

### Beide gleichzeitig starten (empfohlen):

```bash
npm run dev
```

Dies startet:
- Backend auf `http://localhost:3000` (mit Watch-Mode)
- Frontend auf `http://localhost:5173` (Vite Dev-Server)

### Oder einzeln:

**Backend:**
```bash
npm run dev:backend
# Oder für Production:
npm run build:backend
npm run start:backend
```

**Frontend:**
```bash
npm run dev:frontend
```

## Build für Production

```bash
npm run build:all
```

## Verwendung

1. Stelle sicher, dass `ros2-web-bridge` auf `ws://localhost:9090` läuft
2. Starte Backend und Frontend mit `npm run dev`
3. Öffne `http://localhost:5173` im Browser
4. Klicke auf "Zu ROS Topic subscriben" um die ROS-Verbindung zu starten

## Struktur

```
/
├── backend/          # TypeScript Express Backend
│   ├── src/
│   │   ├── server.ts      # Express Server
│   │   ├── ros/           # ROS Client
│   │   └── public/        # Frontend TypeScript (alt)
│   └── dist/              # Kompilierte Backend-Dateien
└── frontend/         # React Frontend
    ├── src/
    │   ├── App.tsx        # Hauptkomponente
    │   └── ...
    └── dist/              # Kompilierte Frontend-Dateien
```
