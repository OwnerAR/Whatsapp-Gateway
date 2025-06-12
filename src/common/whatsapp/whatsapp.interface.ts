export interface WAMessageContent {
  jid: string;
  message: string;
  options?: {
    quotedMessageId?: string;
    media?: {
      buffer: Buffer;
      type: 'image' | 'video' | 'document';
      filename?: string;
    };
  };
}

export interface QuotedMessage {
  key: {
    remoteJid: string;
    id: string;
    fromMe: boolean;
  };
  message: {
    conversation: string;
  };
}