const statusEl = document.getElementById('status') as HTMLSpanElement;
const logEl = document.getElementById('log') as HTMLPreElement;
const subscribeBtn = document.getElementById('subscribeBtn') as HTMLButtonElement;

if (!statusEl || !logEl || !subscribeBtn) {
  throw new Error('Required DOM elements not found');
}

function log(text: string): void {
  const timestamp = new Date().toLocaleTimeString();
  logEl.textContent += `[${timestamp}] ${text}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

// Button zum Subscriben
subscribeBtn.onclick = async () => {
  try {
    log('Subscribing zu /example_topic...');
    
    const response = await fetch('/api/ros/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: '/example_topic',
        messageType: 'std_msgs/msg/String'
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      statusEl.textContent = 'verbunden';
      statusEl.style.color = 'green';
      log(`✓ ${data.message}`);
      log(`Verbindungsstatus: ${data.connected ? 'verbunden' : 'nicht verbunden'}`);
    } else {
      statusEl.textContent = 'Fehler';
      statusEl.style.color = 'red';
      log(`✗ Fehler: ${data.error}`);
    }
  } catch (error) {
    statusEl.textContent = 'Fehler';
    statusEl.style.color = 'red';
    log(`✗ Fehler: ${error instanceof Error ? error.message : String(error)}`);
  }
};
