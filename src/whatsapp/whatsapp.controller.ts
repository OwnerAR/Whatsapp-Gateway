import { Controller, Get, Post, Body } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('status')
  getStatus(): any {
    if (this.whatsappService['connectionStatus'] === 'open') {
      return { status: 'ready' };
    } else if (this.whatsappService['connectionStatus'] === 'close') {
      return { qrCode: this.whatsappService['latestQRCode'] };
    } else {
      return { status: 'unknown' };
    }
  }

  @Post('send')
  async sendMessage(@Body() body: { jid: string; message: string }): Promise<any> {
    let { jid, message } = body;
    if (!jid.includes('@')) {
      jid = jid + '@s.whatsapp.net';
    }
    await this.whatsappService.sendMessage(jid, message);
    return { success: true, message: 'Message sent' };
  }
}
