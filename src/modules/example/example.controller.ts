import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';

import { ExampleService } from './example.service';

@Controller()
export class ExampleController {
  constructor(private readonly exampleService: ExampleService) {}

  @Get('health')
  getHealth(): { status: string; timestamp: number } {
    return this.exampleService.getHealth();
  }

  @Post('example')
  createExample(
    @Req() req: Request,
    @Body() body: { name: string },
  ) {
    return this.exampleService.createExample(req.tenantSlug, body.name);
  }

  @Get('example')
  async listExamples(@Req() req: Request) {
    const items = await this.exampleService.listExamples(req.tenantSlug);
    return { tenantId: req.tenantSlug, items };
  }
}
