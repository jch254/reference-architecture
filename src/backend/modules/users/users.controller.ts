import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';

import { AuthPrincipal } from '../../common/context/identity.types';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { User } from './user.types';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(
    @Req() req: Request,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<{ user: User }> {
    const user = await this.usersService.findOrCreateFromPrincipal(
      req.tenantSlug,
      principal,
    );

    return { user };
  }
}
