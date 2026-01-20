// src/kafka/producer.js
const { Kafka, Partitioners } = require('kafkajs');

class KafkaProducer {
  constructor() {
    this.kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID,
      brokers: process.env.KAFKA_BROKERS.split(',')
    });
    
    // Fix the partitioner warning
    this.producer = this.kafka.producer({
      createPartitioner: Partitioners.LegacyPartitioner
    });
  }

  async connect() {
    await this.producer.connect();
    console.log('Kafka Producer connected');
  }

  async disconnect() {
    await this.producer.disconnect();
    console.log('Kafka Producer disconnected');
  }

  async send(topic, messages) {
    try {
      await this.producer.send({
        topic,
        messages: Array.isArray(messages) ? messages : [messages]
      });
      console.log(`Message sent to topic ${topic}`);
    } catch (error) {
      console.error('Error sending message to Kafka:', error);
      throw error;
    }
  }

  // Send audit log
  async sendAuditLog(action, userId, details = {}) {
    const message = {
      action,
      userId,
      timestamp: new Date().toISOString(),
      details,
      service: 'admin-service'
    };

    await this.send('audit-logs', {
      key: userId,
      value: JSON.stringify(message)
    });
  }

  // Send notification
  async sendNotification(type, userId, data = {}) {
    const message = {
      type,
      userId,
      data,
      timestamp: new Date().toISOString()
    };

    await this.send('notifications', {
      key: userId,
      value: JSON.stringify(message)
    });
  }
}

module.exports = new KafkaProducer();