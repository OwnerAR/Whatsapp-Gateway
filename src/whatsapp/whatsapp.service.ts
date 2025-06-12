import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  downloadMediaMessage,
  AuthenticationState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as path from 'path';
import * as NodeCache from 'node-cache';
import { ConfigService } from '@nestjs/config';
import axios, { isAxiosError } from 'axios';

const groupCache = new NodeCache();

const authFolder = path.resolve('./auth_info_baileys');

interface OutgoingPayload {
  from: string | undefined;
  fromMe?: boolean | undefined;
  participant?: string | undefined;
  message: string | undefined;
  media?: string;
  mediaType?: string;
}

interface ApiResponse {
  message?: string;
  success?: boolean;
  // tambahkan properti lain yang mungkin ada
}

@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get('API_BASE_URL') || '';
    this.apiKey = this.configService.get('API_KEY') || '';
  }
  private sock: ReturnType<typeof makeWASocket>;
  private state: AuthenticationState;
  private saveCreds: () => Promise<void>;

  // Add properties to track connection status and QR code
  private connectionStatus: 'open' | 'close' | 'connecting' | 'unknown' =
    'unknown';
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

    this.sock.ev.on('creds.update', () => {
      void this.saveCreds();
    });

    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        this.latestQRCode = qr;
        this.connectionStatus = 'close'; // Set status to close when QR code is available
      } else {
        this.latestQRCode = null;
      }
      if (connection === 'close') {
        // Definisikan nilai status code yang Anda bandingkan
        const boomStatusCode = (lastDisconnect?.error as Boom).output
          ?.statusCode;

        this.connectionStatus = connection;
        const shouldReconnect =
          typeof boomStatusCode === 'number' &&
          boomStatusCode !== (DisconnectReason.loggedOut as number);
        if (shouldReconnect) {
          void this.onModuleInit();
        }
      } else if (connection) {
        this.connectionStatus = connection; // Cast to any to handle other connection states
      }
    });

    this.sock.ev.on('messages.upsert', (m) => {
      if (m.type !== 'notify') return;
      void (async () => {
        if (m.messages) {
          for (const msg of m.messages) {
            try {
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

              const payload: OutgoingPayload = {
                from: msg.key.remoteJid || undefined,
                fromMe: msg.key.fromMe || undefined,
                message: messageText,
              };
              if (!msg.key.fromMe) {
                payload.fromMe = false;
                payload.participant = msg.key.participant || undefined;
              }
              if (mediaBuffer && mediaType === 'image') {
                payload.media = mediaBuffer.toString('base64');
                payload.mediaType = mediaType;
              }

              const response = await axios.post<ApiResponse>(
                this.baseUrl,
                payload,
                {
                  headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                  },
                },
              );
              if (msg.key.remoteJid && response.data?.message) {
                await this.sock.sendMessage(msg.key.remoteJid, {
                  text: response.data.message || 'Message sent successfully',
                  delete: {
                    remoteJid: msg.key.remoteJid,
                    fromMe: msg.key.fromMe,
                    id: msg.key.id,
                  },
                });
                await this.sock.sendReceipt(
                  msg.key.remoteJid,
                  msg.key.participant as string,
                  [msg.key.id as string],
                  'read',
                );
              }
            } catch (error: any) {
              console.error('Error sending message to API:', error);
              if (msg.key && msg.key.remoteJid && isAxiosError(error)) {
                if (error && typeof error === 'object' && 'response' in error) {
                  const errorResponse = error.response as {
                    data?: { message?: string };
                  };
                  await this.sock.sendMessage(msg.key.remoteJid, {
                    text: errorResponse.data?.message || 'Unknown error',
                  });
                } else {
                  await this.sock.sendMessage(msg.key.remoteJid, {
                    text: 'An error occurred while processing your message',
                  });
                }
              }
            }
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
