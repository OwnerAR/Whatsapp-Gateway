import { Controller, Post, Body } from '@nestjs/common';
import { FaceRecognitionService } from './face-recognition.service';

@Controller('face-recognition')
export class FaceRecognitionController {
  constructor(private readonly faceRecognitionService: FaceRecognitionService) {}

  @Post('recognize')
  async recognizeFace(
    @Body() body: { urlImageReference: string; urlImage: string }
  ): Promise<any> {
    const { urlImageReference, urlImage } = body;
    return this.faceRecognitionService.recognizeFacesFromUrls(urlImageReference, urlImage);
  }
}
