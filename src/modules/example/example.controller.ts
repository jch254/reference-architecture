import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';

import { ExampleService } from './example.service';

@Controller()
export class ExampleController {
  constructor(private readonly exampleService: ExampleService) {}

  @Get('health')
  getHealth(): { status: string; timestamp: number } {
    return this.exampleService.getHealth();
  }

  @Get('example')
  getExample(
    @Req() req: Request,
  ): { message: string; requestId: string; tenantId: string } {
    return this.exampleService.getExample(req.requestId, req.tenantSlug);
  }
}
