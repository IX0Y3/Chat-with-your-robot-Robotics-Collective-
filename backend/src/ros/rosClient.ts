// @ts-ignore - roslib has no type definitions
import { Ros, Topic } from 'roslib';

export class ROSClient {
  private ros: Ros;
  private topics: Map<string, Topic> = new Map();
  private handlers: Map<string, (message: any) => void> = new Map();

  constructor(url: string = 'ws://localhost:9090') {
    this.ros = new Ros({ url });
    
    console.log(`ROS Client initialized, connecting to ${url}...`);
    console.log(`Initial connection status: ${this.ros.isConnected}`);
    
    this.ros.on('connection', () => {
      console.log('✓ ROS connected!');
    });

    this.ros.on('error', (error: Error) => {
      console.error('✗ ROS error:', error);
    });

    this.ros.on('close', () => {
      console.log('⚠ ROS connection closed');
    });
  }

  subscribe(topicName: string, messageType: string, handler: (message: any) => void): void {
    console.log(`Subscribe to ${topicName} (${messageType}), ROS connected: ${this.ros.isConnected}`);
    
    // If already subscribed, only update handler
    if (this.topics.has(topicName)) {
      console.log(`Handler for ${topicName} updated`);
      this.handlers.set(topicName, handler);
      return;
    }

    // Create new topic and subscribe
    const topic = new Topic({
      ros: this.ros,
      name: topicName,
      messageType: messageType
    });

    console.log(`Topic created: ${topicName}, starting subscription...`);
    topic.subscribe((message: any) => {
      console.log(`📨 Message received on ${topicName}:`, message);
      const handler = this.handlers.get(topicName);
      if (handler) {
        handler(message);
      }
    });

    // Store topic and handler
    this.topics.set(topicName, topic);
    this.handlers.set(topicName, handler);
    
    console.log(`✓ Subscription to ${topicName} active (total: ${this.topics.size} topics)`);
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
    console.log(`Publishing to ${topicName} (${messageType}):`, message);
    console.log(`ROS connected: ${this.ros.isConnected}`);
    
    const topic = new Topic({
      ros: this.ros,
      name: topicName,
      messageType: messageType
    });
    
    topic.publish(message);
    console.log(`✓ Message published to ${topicName}`);
  }

  get isConnected(): boolean {
    return this.ros.isConnected;
  }
}

