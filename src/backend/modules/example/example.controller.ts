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
} from '@nestjs/common';

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
    @Body() body: { name: string },
  ) {
    if (!body.name) throw new BadRequestException('name is required');

    const example = await this.exampleService.createExample(body.name);
    return example;
  }

  @Public()
  @Get('example')
  async listExamples() {
    const examples = await this.exampleService.listExamples();
    return examples;
  }

  @Patch('example/:id')
  async updateExample(
    @Param('id') id: string,
    @Body() body: { name: string },
  ) {
    if (!body.name) throw new BadRequestException('name is required');

    const example = await this.exampleService.updateExample(
      id,
      body.name,
    );
    if (!example) throw new NotFoundException('Example not found');
    return example;
  }

  @Delete('example/:id')
  async deleteExample(@Param('id') id: string) {
    await this.exampleService.deleteExample(id);
    return { id };
  }
}
