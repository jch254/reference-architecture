import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';

import { Public } from '../auth/auth.guard';
import { ExampleService } from './example.service';

@Controller()
export class ExampleController {
  constructor(private readonly exampleService: ExampleService) {}

  @Public()
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
      req.user!.tenantSlug,
      body.name,
    );
    return example;
  }

  @Get('example')
  async listExamples(@Req() req: Request) {
    const examples = await this.exampleService.listExamples(req.user!.tenantSlug);
    return examples;
  }

  @Patch('example/:id')
  async updateExample(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { name: string },
  ) {
    if (!body.name) throw new BadRequestException('name is required');

    const example = await this.exampleService.updateExample(
      req.user!.tenantSlug,
      id,
      body.name,
    );
    if (!example) throw new NotFoundException('Example not found');
    return example;
  }

  @Delete('example/:id')
  async deleteExample(@Req() req: Request, @Param('id') id: string) {
    await this.exampleService.deleteExample(req.user!.tenantSlug, id);
    return { id };
  }
}
