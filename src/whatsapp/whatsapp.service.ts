import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  downloadMediaMessage
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as path from 'path';
import * as NodeCache from 'node-cache';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const groupCache = new NodeCache();

const authFolder = path.resolve('./auth_info_baileys');

interface OutgoingPayload {
  message: string | undefined;
  media?: string;
  mediaType?: string;
}

@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly baseUrl: string;
  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get('API_BASE_URL') || 'http://localhost:3000';
  }
  private sock: ReturnType<typeof makeWASocket>;
  private state: any;
  private saveCreds: () => Promise<void>;

  // Add properties to track connection status and QR code
  private connectionStatus: 'open' | 'close' | 'connecting' | 'unknown' = 'unknown';
  private latestQRCode: string | null = null;

  getConnectionStatus(): 'open' | 'close' | 'connecting' | 'unknown' {
    return this.connectionStatus;
  }

  getLatestQRCode(): string | null {
    return this.latestQRCode;
  }

  async onModuleInit() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    this.state = state;
    this.saveCreds = saveCreds;

    this.sock = makeWASocket({
      version,
      auth: this.state,
      cachedGroupMetadata: async (jid) => groupCache.get(jid),
    });

    this.sock.ev.on('creds.update', this.saveCreds);

    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        this.latestQRCode = qr;
        this.connectionStatus = 'close'; // Set status to close when QR code is available
      } else {
        this.latestQRCode = null;
      }
      if (connection === 'close') {
        this.connectionStatus = connection;
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          this.onModuleInit();
        }
      } else if (connection) {
        this.connectionStatus = connection as any; // Cast to any to handle other connection states
      }
    });

    this.sock.ev.on('messages.upsert', (m) => {
      // Jalankan async function tanpa mengembalikan promise ke event handler
      void (async () => {
        if (m.messages) {
          for (const msg of m.messages) {
            let messageText: string | undefined;
            let mediaBuffer: Buffer | undefined;
            let mediaType: string | undefined;

            if (msg.message?.conversation) {
              messageText = msg.message.conversation;
            } else if (msg.message?.extendedTextMessage?.text) {
              messageText = msg.message.extendedTextMessage.text;
            } else if (msg.message?.imageMessage) {
              messageText = msg.message.imageMessage.caption || '';
              mediaType = 'image';
              mediaBuffer = await downloadMediaMessage(msg, 'buffer', {});
            } else if (msg.message?.videoMessage) {
              messageText = msg.message.videoMessage.caption || '';
              mediaType = 'video';
              mediaBuffer = await downloadMediaMessage(msg, 'buffer', {});
            } else if (msg.message?.documentMessage) {
              messageText = msg.message.documentMessage.caption || '';
              mediaType = 'document';
              mediaBuffer = await downloadMediaMessage(msg, 'buffer', {});
            }

            const payload: OutgoingPayload = { message: messageText };

            if (mediaBuffer && mediaType) {
              payload.media = mediaBuffer.toString('base64');
              payload.mediaType = mediaType;
            }

            await axios.post(this.baseUrl, {
              headers: { 'Content-Type': 'application/json' },
              data: payload,
            });
          }
        }
      })();
    });
  }
  async sendMessage(jid: string, message: string) {
    if (!this.sock) {
      throw new Error('WhatsApp socket not initialized');
    }
    await this.sock.sendMessage(jid, { text: message });
  }

  async onModuleDestroy() {
    if (this.sock) {
      await this.sock.logout();
    }
  }
}