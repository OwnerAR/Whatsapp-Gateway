import { Test, TestingModule } from '@nestjs/testing';
import { FaceRecognitionController } from './face-recognition.controller';
import { FaceRecognitionService } from './face-recognition.service';

describe('FaceRecognitionController', () => {
  let controller: FaceRecognitionController;
  let _service: FaceRecognitionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FaceRecognitionController],
      providers: [
        {
          provide: FaceRecognitionService,
          useValue: {
            // mock service methods if needed
          },
        },
      ],
    }).compile();

    controller = module.get<FaceRecognitionController>(
      FaceRecognitionController,
    );
    _service = module.get<FaceRecognitionService>(FaceRecognitionService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // Add more tests for controller methods here
});
