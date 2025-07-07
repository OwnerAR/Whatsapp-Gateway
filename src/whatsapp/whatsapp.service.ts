import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  downloadMediaMessage,
  AuthenticationState,
  AnyRegularMessageContent,
  WAMessageKey,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as path from 'path';
import * as NodeCache from 'node-cache';
import { ConfigService } from '@nestjs/config';
import axios, { isAxiosError } from 'axios';
import {
  QuotedMessage,
  WAMessageContent,
} from 'src/common/whatsapp/whatsapp.interface';

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
}

// Tambahkan type definition untuk content dengan quoted
type MessageContentWithQuote = AnyRegularMessageContent & {
  quoted?: QuotedMessage;
};

interface ExtendedSocket extends ReturnType<typeof makeWASocket> {
  // Ganti definisi readMessages menjadi:
  readMessages(keys: WAMessageKey[]): Promise<void>;
}

@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get('API_BASE_URL') || '';
    this.apiKey = this.configService.get('API_KEY') || '';
  }
  private sock: ExtendedSocket;
  private state: AuthenticationState;
  private saveCreds: () => Promise<void>;
  private store: {
    chats: Map<string, any>;
  } = {
    chats: new Map(),
  };

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
                  text: response.data.message,
                } as AnyRegularMessageContent);
                try {
                  await this.sock.sendReceipt(
                    msg.key.remoteJid,
                    msg.key.participant as string,
                    [msg.key.id as string],
                    'read',
                  );
                  if (!msg.key.fromMe && mediaType === 'image') {
                    await this.sock.sendMessage(msg.key.remoteJid, {
                      delete: {
                        remoteJid: msg.key.remoteJid,
                        participant: msg.key.participant,
                        fromMe: false,
                        id: msg.key.id,
                      },
                    });
                  }
                } catch (deleteError) {
                  console.error('Error deleting message:', deleteError);
                }
              }
            } catch (error: any) {
              if (isAxiosError(error)) {
                console.error('Error sending message:', error.response?.data);
                if (msg.key.remoteJid) {
                  await this.sock.sendReceipt(
                    msg.key.remoteJid, // Parameter 1: jid
                    msg.key.participant as string, // Parameter 2: participant
                    [msg.key.id as string], // Parameter 3: messageIds (array)
                    'read', // Parameter 4: type
                  );
                }
              } else {
                console.error('Unexpected error:', error);
              }
            }
          }
        }
      })();
    });

    this.sock.ev.on('messaging-history.set', ({ chats }) => {
      this.store.chats = new Map(chats.map((chat) => [chat.id, chat]));
      console.log('Got chats', this.store.chats.size);
    });
    this.sock.ev.on('chats.upsert', (chats) => {
      for (const chat of chats) {
        const chatId = typeof chat === 'string' ? chat : chat.id;
        this.store.chats.set(chatId, chat);
      }
    });
  }
  /**
   * Kirim pesan WhatsApp ke nomor atau grup tertentu.
   * @param jid JID penerima (nomor telepon atau ID grup).
   * @param message Pesan yang akan dikirim.
   * @param options Opsi tambahan untuk pesan, seperti quotedMessageId dan media.
   * @returns Promise yang menyelesaikan dengan hasil pengiriman pesan.
   */
  async sendMessage(waMessageContent: WAMessageContent): Promise<any> {
    if (!this.sock) {
      throw new Error('WhatsApp socket not initialized');
    }

    try {
      const normalizedJid = this.normalizeJid(waMessageContent.jid);
      let content: AnyRegularMessageContent;

      if (waMessageContent.options?.media) {
        if (waMessageContent.options.media.type === 'image') {
          content = {
            image: waMessageContent.options.media.buffer,
            caption: waMessageContent.message,
          } as AnyRegularMessageContent;
        } else if (waMessageContent.options.media.type === 'video') {
          content = {
            video: waMessageContent.options.media.buffer,
            caption: waMessageContent.message,
          } as AnyRegularMessageContent;
        } else {
          content = {
            document: waMessageContent.options.media.buffer,
            fileName: waMessageContent.options.media.filename || 'file',
            caption: waMessageContent.message,
          } as AnyRegularMessageContent;
        }
      } else {
        content = {
          text: waMessageContent.message,
        } as AnyRegularMessageContent;
      }

      if (waMessageContent.options?.quotedMessageId) {
        try {
          const quoted = {
            key: {
              remoteJid: normalizedJid,
              id: waMessageContent.options.quotedMessageId,
              fromMe: false,
            },
            message: {
              conversation:
                waMessageContent.message.substring(0, 20) +
                (waMessageContent.message.length > 20 ? '...' : ''),
            },
          };

          (content as MessageContentWithQuote).quoted = quoted;
        } catch (quoteError) {
          console.error('Error setting quoted message:', quoteError);
        }
      }

      const sentMsg = await this.sock.sendMessage(normalizedJid, content);
      return sentMsg;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw new Error(
        `Failed to send WhatsApp message: ${(error as Error).message}`,
      );
    }
  }

  normalizeJid(jid: string): string {
    if (jid.includes('@')) {
      return jid;
    }

    const privateJid = `${jid}@s.whatsapp.net`;
    const groupJid = `${jid}@g.us`;

    if (this.store.chats.has(privateJid)) {
      return privateJid;
    } else if (this.store.chats.has(groupJid)) {
      return groupJid;
    }

    if (jid.includes('-')) {
      return groupJid;
    }
    if (jid.length > 15) {
      return groupJid;
    }

    return privateJid;
  }

  async onModuleDestroy() {
    if (this.sock) {
      await this.sock.logout();
    }
  }
}
