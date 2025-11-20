// @ts-ignore - roslib hat keine Type-Definitionen
import { Ros, Topic } from 'roslib';

export class ROSClient {
  private ros: Ros;
  private topic: Topic | null = null;
  private messageHandler: ((message: any) => void) | null = null;

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
    
    if (this.topic && this.topic.name === topicName) {
      // Bereits subscribed zum gleichen Topic, handler aktualisieren
      console.log(`Handler für ${topicName} aktualisiert`);
      this.messageHandler = handler;
      return;
    }

    // Wenn bereits ein anderes Topic subscribed ist, unsubscribe
    if (this.topic) {
      console.log(`Unsubscribe von altem Topic: ${this.topic.name}`);
      this.topic.unsubscribe();
    }

    this.messageHandler = handler;
    this.topic = new Topic({
      ros: this.ros,
      name: topicName,
      messageType: messageType
    });

    console.log(`Topic erstellt: ${topicName}, starte Subscription...`);
    this.topic.subscribe((message: any) => {
      console.log(`📨 Nachricht empfangen auf ${topicName}:`, message);
      if (this.messageHandler) {
        this.messageHandler(message);
      }
    });
    console.log(`✓ Subscription zu ${topicName} aktiv`);
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

