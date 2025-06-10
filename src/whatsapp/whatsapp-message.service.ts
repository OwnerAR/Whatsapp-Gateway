import { Injectable } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class WhatsappMessageService {
  private redisClient: RedisClientType;

  constructor() {
    this.redisClient = createClient();
    this.redisClient.connect().catch(console.error);
  }

  async createSession(whatsappId: string, sessionData: any): Promise<void> {
    const key = `whatsapp:session:${whatsappId}`;
    await this.redisClient.set(key, JSON.stringify(sessionData));
  }

  async getSession(whatsappId: string): Promise<any | null> {
    const key = `whatsapp:session:${whatsappId}`;
    const data = await this.redisClient.get(key);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  }

  async handleNewMessage(whatsappId: string, message: any): Promise<void> {
    // Example: store last message in session
    const session = (await this.getSession(whatsappId)) || {};
    session.lastMessage = message;
    await this.createSession(whatsappId, session);

    // Add your message handling logic here
    console.log(`New message for ${whatsappId}:`, message);
  }
}
