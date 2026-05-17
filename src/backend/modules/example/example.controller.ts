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

import { AuthPrincipal } from '../../common/context/identity.types';
import { Public } from '../auth/auth.guard';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { ExampleService } from './example.service';

interface ExampleBody {
  name: string;
  tenantId?: string;
  userId?: string;
}

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
    @Body() body: ExampleBody,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    if (!body.name) throw new BadRequestException('name is required');

    const example = await this.exampleService.createExample(
      principal,
      body.name,
    );
    return example;
  }

  @Get('example')
  async listExamples(
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    const examples = await this.exampleService.listExamples(principal);
    return examples;
  }

  @Get('example/:id')
  async getExample(
    @Param('id') id: string,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    const example = await this.exampleService.getExample(principal, id);
    if (!example) throw new NotFoundException('Example not found');
    return example;
  }

  @Patch('example/:id')
  async updateExample(
    @Param('id') id: string,
    @Body() body: ExampleBody,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    if (!body.name) throw new BadRequestException('name is required');

    const example = await this.exampleService.updateExample(
      principal,
      id,
      body.name,
    );
    if (!example) throw new NotFoundException('Example not found');
    return example;
  }

  @Delete('example/:id')
  async deleteExample(
    @Param('id') id: string,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    const deleted = await this.exampleService.deleteExample(principal, id);
    if (!deleted) throw new NotFoundException('Example not found');
    return { id };
  }
}
