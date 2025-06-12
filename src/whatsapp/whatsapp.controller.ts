import { Controller, Get, Post, Body } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WAMessageContent } from 'src/common/whatsapp/whatsapp.interface';

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
    @Body()
    body: WAMessageContent,
  ): Promise<any> {
    await this.whatsappService.sendMessage(body);
    return { success: true, message: 'Message sent' };
  }
}
