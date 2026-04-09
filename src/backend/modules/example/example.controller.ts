import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';

import { ExampleService } from './example.service';

@Controller()
export class ExampleController {
  constructor(private readonly exampleService: ExampleService) {}

  @Get('health')
  getHealth() {
    return this.exampleService.getHealth();
  }

  @Post('example')
  async createExample(
    @Req() req: Request,
    @Body() body: { name: string },
  ) {
    if (!body.name) throw new BadRequestException('name is required');

    const example = await this.exampleService.createExample(
      req.tenantSlug,
      body.name,
    );
    return { data: example };
  }

  @Get('example')
  async listExamples(@Req() req: Request) {
    const examples = await this.exampleService.listExamples(req.tenantSlug);
    return { data: examples };
  }

  @Delete('example/:id')
  async deleteExample(@Req() req: Request, @Param('id') id: string) {
    await this.exampleService.deleteExample(req.tenantSlug, id);
    return { data: { id } };
  }
}
