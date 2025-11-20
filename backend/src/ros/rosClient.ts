// @ts-ignore - roslib has no type definitions
import { Ros, Topic } from 'roslib';
export class ROSClient {
  private ros: Ros;
  private topics: Map<string, Topic> = new Map();
  private handlers: Map<string, (message: any) => void> = new Map();

  // Constructor for ROSClient
  constructor(url: string = 'ws://localhost:9090') {

    // Initialize ROS connection
    this.ros = new Ros({ url });
    
    // Log ROS connection status
    console.log(`ROS Client initialized, connecting to ${url}...`);
    
    // Log ROS connection
    this.ros.on('connection', () => {
      console.log('✅ ROS connected!');
    });

    // Log ROS error
    this.ros.on('error', (error: Error) => {
      console.error('❌ ROS error:', error);
    });

    // Log ROS connection closed
    this.ros.on('close', () => {
      console.log('⚠️ ROS connection closed');
    });
  }

  /**
   * Subscribe to a ROS topic
   * @param topicName The name of the topic to subscribe to
   * @param messageType The type of the message to subscribe to
   * @param handler The handler function to call when a message is received
   */
  subscribe(topicName: string, messageType: string, handler: (message: any) => void): void {
    console.log(`🔄 Subscribing to ${topicName} (${messageType})`);
    
    // If already subscribed, only update handler
    if (this.topics.has(topicName)) {
      console.log(`✅ Handler for ${topicName} updated`);
      this.handlers.set(topicName, handler);
      return;
    }

    // Create new topic and subscribe
    const topic = new Topic({
      ros: this.ros,
      name: topicName,
      messageType: messageType
    });

    // Subscribe to topic
    topic.subscribe((message: any) => {
      const handler = this.handlers.get(topicName);
      if (handler) {
        handler(message);
      }
    });

    // Store topic and handler
    this.topics.set(topicName, topic);
    this.handlers.set(topicName, handler);
    
    // Log subscription status
    console.log(`✅ Subscription to ${topicName} active (total: ${this.topics.size} topics)`);
  }

  /**
   * Unsubscribe from a ROS topic
   * @param topicName The name of the topic to unsubscribe from
   */
  unsubscribe(topicName: string): void {

    // Get topic
    const topic = this.topics.get(topicName);

    // If topic exists, unsubscribe
    if (topic) {
      // Unsubscribe from topic
      topic.unsubscribe();
      // Delete topic and handler
      this.topics.delete(topicName);
      this.handlers.delete(topicName);
      console.log(`✅ Unsubscribed from ${topicName} (total: ${this.topics.size} topics)`);
    }
  }

  /**
   * Publish a message to a ROS topic
   * @param topicName The name of the topic to publish to
   * @param messageType The type of the message to publish
   * @param message The message to publish
   */
  publish(topicName: string, messageType: string, message: any): void {
    console.log(`🔄 Publishing to ${topicName} (${messageType}):`, message);
    
    // Create new topic and publish
    const topic = new Topic({
      ros: this.ros,
      name: topicName,
      messageType: messageType
    });
    
    // Publish message
    topic.publish(message);
    console.log(`✅ Message published to ${topicName}`);
  }

  /**
   * Get the connection status of the ROS client
   * @returns The connection status of the ROS client
   */
  get isConnected(): boolean {
    // Return connection status
    return this.ros.isConnected;
  }
}

