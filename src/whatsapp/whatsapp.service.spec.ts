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

  // Skip test yang memerlukan koneksi WhatsApp
  it.skip('should connect to WhatsApp', async () => {
    // Implementasi test koneksi WhatsApp yang akan di-skip di CI
    expect(await service.getConnectionStatus()).toBe('open');
  });
  
  // Test yang tidak memerlukan koneksi WhatsApp
  it('should process messages correctly', () => {
    // Implementasi test yang tidak memerlukan koneksi sebenarnya
    const result = service.processMessage('test message');
    expect(result).toBeDefined();
  });
});