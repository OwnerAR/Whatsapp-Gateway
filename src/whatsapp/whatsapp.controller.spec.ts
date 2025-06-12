import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappService } from './whatsapp.service';
import { ConfigService } from '@nestjs/config';

describe('WhatsappService', () => {
  let service: WhatsappService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'API_KEY') return 'test-api-key';
              if (key === 'API_BASE_URL') return 'http://test-url.com';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<WhatsappService>(WhatsappService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should handle errors correctly', () => {
    try {
      // Lakukan operasi yang akan gagal
      void service.sendMessage('invalid-jid', 'Test message');
      fail('Should have thrown an error');
    } catch (err: unknown) {
      const error = err as Error;
      expect(error.message).toContain('expected error');
    }
  });
});
