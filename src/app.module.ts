import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WhatsappService } from './whatsapp/whatsapp.service';
import { WhatsappMessageService } from './whatsapp/whatsapp-message.service';
import { WhatsappController } from './whatsapp/whatsapp.controller';
import { FaceRecognitionController } from './face-recognition/face-recognition.controller';
import { FaceRecognitionService } from './face-recognition/face-recognition.service';

@Module({
  imports: [],
  controllers: [AppController, WhatsappController, FaceRecognitionController],
  providers: [AppService, WhatsappService, WhatsappMessageService, FaceRecognitionService],
  exports: [WhatsappService, WhatsappMessageService],
})
export class AppModule {}
