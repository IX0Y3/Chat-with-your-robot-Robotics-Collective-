// @ts-ignore - roslib hat keine Type-Definitionen
import { Ros, Topic } from 'roslib';

export class ROSClient {
  private ros: Ros;
  private topics: Map<string, Topic> = new Map();
  private handlers: Map<string, (message: any) => void> = new Map();

  constructor(url: string = 'ws://localhost:9090') {
    this.ros = new Ros({ url });
    
    console.log(`ROS Client initialisiert, verbinde mit ${url}...`);
    console.log(`Initialer Verbindungsstatus: ${this.ros.isConnected}`);
    
    this.ros.on('connection', () => {
      console.log('✓ ROS verbunden!');
    });

    this.ros.on('error', (error: Error) => {
      console.error('✗ ROS Fehler:', error);
    });

    this.ros.on('close', () => {
      console.log('⚠ ROS Verbindung geschlossen');
    });
  }

  subscribe(topicName: string, messageType: string, handler: (message: any) => void): void {
    console.log(`Subscribe zu ${topicName} (${messageType}), ROS verbunden: ${this.ros.isConnected}`);
    
    // Wenn bereits subscribed, nur Handler aktualisieren
    if (this.topics.has(topicName)) {
      console.log(`Handler für ${topicName} aktualisiert`);
      this.handlers.set(topicName, handler);
      return;
    }

    // Neues Topic erstellen und subscriben
    const topic = new Topic({
      ros: this.ros,
      name: topicName,
      messageType: messageType
    });

    console.log(`Topic erstellt: ${topicName}, starte Subscription...`);
    topic.subscribe((message: any) => {
      console.log(`📨 Nachricht empfangen auf ${topicName}:`, message);
      const handler = this.handlers.get(topicName);
      if (handler) {
        handler(message);
      }
    });

    // Topic und Handler speichern
    this.topics.set(topicName, topic);
    this.handlers.set(topicName, handler);
    
    console.log(`✓ Subscription zu ${topicName} aktiv (total: ${this.topics.size} Topics)`);
  }

  unsubscribe(topicName: string): void {
    const topic = this.topics.get(topicName);
    if (topic) {
      topic.unsubscribe();
      this.topics.delete(topicName);
      this.handlers.delete(topicName);
      console.log(`✓ Unsubscribed von ${topicName} (total: ${this.topics.size} Topics)`);
    }
  }

  publish(topicName: string, messageType: string, message: any): void {
    console.log(`Publishe auf ${topicName} (${messageType}):`, message);
    console.log(`ROS verbunden: ${this.ros.isConnected}`);
    
    const topic = new Topic({
      ros: this.ros,
      name: topicName,
      messageType: messageType
    });
    
    topic.publish(message);
    console.log(`✓ Nachricht publiziert auf ${topicName}`);
  }

  get isConnected(): boolean {
    return this.ros.isConnected;
  }
}

