import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  delay,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as path from 'path';
import * as NodeCache from 'node-cache';

const groupCache = new NodeCache();

const authFolder = path.resolve('./auth_info_baileys');

@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private sock: ReturnType<typeof makeWASocket>;
  private state: any;
  private saveCreds: () => Promise<void>;

  // Add properties to track connection status and QR code
  private connectionStatus: 'open' | 'close' | 'unknown' = 'unknown';
  private latestQRCode: string | null = null;

  getConnectionStatus(): 'open' | 'close' | 'unknown' {
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
      printQRInTerminal: true,
      cachedGroupMetadata: async (jid) => groupCache.get(jid),
    });

    this.sock.ev.on('creds.update', this.saveCreds);

    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        console.log('QR Code received, scan please.');
        this.latestQRCode = qr;
      } else {
        this.latestQRCode = null;
      }
      if (connection === 'close') {
        this.connectionStatus = 'close';
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Connection closed due to', lastDisconnect?.error, ', reconnecting:', shouldReconnect);
        if (shouldReconnect) {
          this.onModuleInit();
        }
      } else if (connection === 'open') {
        this.connectionStatus = 'open';
        console.log('Connected to WhatsApp');
      } else {
        this.connectionStatus = 'unknown';
      }
    });

    this.sock.ev.on('messages.upsert', async (m) => {
      console.log('Message received:', JSON.stringify(m, undefined, 2));
      // You can add message handling logic here
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