import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WhatsappService } from './whatsapp/whatsapp.service';
import { WhatsappMessageService } from './whatsapp/whatsapp-message.service';
import { WhatsappController } from './whatsapp/whatsapp.controller';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [AppController, WhatsappController],
  providers: [AppService, WhatsappService, WhatsappMessageService],
  exports: [WhatsappService, WhatsappMessageService],
})
export class AppModule {}
