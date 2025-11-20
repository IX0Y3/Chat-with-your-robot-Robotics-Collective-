import { Ros, Topic } from 'roslib';

const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const sendBtn = document.getElementById('sendBtn');

function log(text) {
  const timestamp = new Date().toLocaleTimeString();
  logEl.textContent += `[${timestamp}] ${text}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

// ROS-Verbindung zur ros2-web-bridge
const ros = new Ros({
  url: 'ws://localhost:9090'
});

ros.on('connection', () => {
  statusEl.textContent = 'verbunden';
  statusEl.style.color = 'green';
  log('Verbunden mit ros2-web-bridge');
});

ros.on('error', (error) => {
  statusEl.textContent = 'Fehler';
  statusEl.style.color = 'red';
  log('Fehler: ' + (error.message || error));
});

ros.on('close', () => {
  statusEl.textContent = 'getrennt';
  statusEl.style.color = 'gray';
  log('Verbindung geschlossen');
});

// Topic abonnieren
const exampleTopic = new Topic({
  ros: ros,
  name: '/example_topic',
  messageType: 'std_msgs/msg/String'
});

exampleTopic.subscribe((message) => {
  log('Empfangen: ' + message.data);
});

// Nachricht senden
sendBtn.onclick = () => {
  if (ros.isConnected) {
    exampleTopic.publish({ data: 'Hallo aus dem Browser!' });
    log('Nachricht gesendet');
  } else {
    log('Nicht verbunden');
  }
};

