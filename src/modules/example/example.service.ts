import { Injectable } from '@nestjs/common';

@Injectable()
export class ExampleService {
  getHealth(): { status: string; timestamp: number } {
    return {
      status: 'ok',
      timestamp: Date.now(),
    };
  }

  getExample(
    requestId: string,
    tenantId: string,
  ): { message: string; requestId: string; tenantId: string } {
    return {
      message: 'reference architecture is running',
      requestId,
      tenantId,
    };
  }
}
