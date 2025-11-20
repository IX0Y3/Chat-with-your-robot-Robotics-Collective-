// @ts-ignore - roslib hat keine Type-Definitionen
import { Ros, Topic } from 'roslib';

export class ROSClient {
  private ros: Ros;
  private topic: Topic | null = null;
  private messageHandler: ((message: any) => void) | null = null;

  constructor(url: string = 'ws://localhost:9090') {
    this.ros = new Ros({ url });
    
    this.ros.on('connection', () => {
      console.log('ROS verbunden');
    });

    this.ros.on('error', (error: Error) => {
      console.error('ROS Fehler:', error);
    });

    this.ros.on('close', () => {
      console.log('ROS Verbindung geschlossen');
    });
  }

  subscribe(topicName: string, messageType: string, handler: (message: any) => void): void {
    if (this.topic) {
      // Bereits subscribed, handler aktualisieren
      this.messageHandler = handler;
      return;
    }

    this.messageHandler = handler;
    this.topic = new Topic({
      ros: this.ros,
      name: topicName,
      messageType: messageType
    });

    this.topic.subscribe((message: any) => {
      if (this.messageHandler) {
        this.messageHandler(message);
      }
    });
  }

  publish(topicName: string, messageType: string, message: any): void {
    const topic = new Topic({
      ros: this.ros,
      name: topicName,
      messageType: messageType
    });
    topic.publish(message);
  }

  get isConnected(): boolean {
    return this.ros.isConnected;
  }
}

