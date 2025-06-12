import { Controller, Get, Post, Body } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('status')
  getStatus(): any {
    return {
      status: this.whatsappService['connectionStatus'],
      qrCode: this.whatsappService['latestQRCode'],
    };
  }

  @Post('send')
  async sendMessage(
    @Body() body: { jid: string; message: string },
  ): Promise<any> {
    const { message } = body;
    let { jid } = body;
    if (!jid.includes('@')) {
      jid = jid + '@s.whatsapp.net';
    }
    await this.whatsappService.sendMessage(jid, message);
    return { success: true, message: 'Message sent' };
  }
}
