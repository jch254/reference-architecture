import 'reflect-metadata';
import {
  BadRequestException,
  ExecutionContext,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { config } from '../../common/config';
import { AuthPrincipal } from '../../common/context/identity.types';
import { AuthGuard, IS_PUBLIC_KEY } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { OidcJwtValidator } from '../auth/oidc-jwt.validator';
import { ExampleController } from './example.controller';
import { Example, ExampleService } from './example.service';

const principal: AuthPrincipal = {
  provider: 'oidc',
  subject: 'auth0|user-123',
};

const example: Example = {
  id: 'example-1',
  userId: 'user-1',
  name: 'Example',
  createdAt: '2026-05-17T00:00:00.000Z',
  updatedAt: '2026-05-17T00:00:00.000Z',
};

function createGuardContext(handler: unknown): ExecutionContext {
  const req = {
    headers: {},
    signedCookies: {},
    tenantSlug: 'tenant-a',
  };

  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => ExampleController,
  } as unknown as ExecutionContext;
}

describe('ExampleController', () => {
  let controller: ExampleController;
  let service: Record<string, jest.Mock>;

  beforeEach(() => {
    service = {
      getHealth: jest.fn(() => ({ status: 'ok' })),
      createExample: jest.fn().mockResolvedValue(example),
      listExamples: jest.fn().mockResolvedValue([example]),
      getExample: jest.fn().mockResolvedValue(example),
      updateExample: jest.fn().mockResolvedValue(example),
      deleteExample: jest.fn().mockResolvedValue(true),
    };

    controller = new ExampleController(
      service as unknown as ExampleService,
    );
  });

  it('keeps health public and example CRUD protected by the global auth guard', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, controller.getHealth),
    ).toBe(true);

    for (const handler of [
      controller.createExample,
      controller.listExamples,
      controller.getExample,
      controller.updateExample,
      controller.deleteExample,
    ]) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBeUndefined();
    }
  });

  it('rejects unauthenticated example CRUD routes through the global auth guard', async () => {
    const originalAuthProvider = config.authProvider;
    const guard = new AuthGuard(
      new Reflector(),
      {} as AuthService,
      {} as OidcJwtValidator,
    );

    config.authProvider = 'oidc';
    try {
      await expect(
        guard.canActivate(createGuardContext(controller.getHealth)),
      ).resolves.toBe(true);

      for (const handler of [
        controller.createExample,
        controller.listExamples,
        controller.getExample,
        controller.updateExample,
        controller.deleteExample,
      ]) {
        await expect(
          guard.canActivate(createGuardContext(handler)),
        ).rejects.toThrow(UnauthorizedException);
      }

      config.authProvider = 'none';
      await expect(
        guard.canActivate(createGuardContext(controller.listExamples)),
      ).rejects.toThrow(UnauthorizedException);
    } finally {
      config.authProvider = originalAuthProvider;
    }
  });

  it('passes only the authenticated principal and name when creating', async () => {
    await controller.createExample(
      {
        name: 'Created',
        tenantId: 'client-tenant',
        userId: 'client-user',
      },
      principal,
    );

    expect(service.createExample).toHaveBeenCalledWith(principal, 'Created');
  });

  it('passes only the authenticated principal, id, and name when updating', async () => {
    await controller.updateExample(
      'example-1',
      {
        name: 'Updated',
        tenantId: 'client-tenant',
        userId: 'client-user',
      },
      principal,
    );

    expect(service.updateExample).toHaveBeenCalledWith(
      principal,
      'example-1',
      'Updated',
    );
  });

  it('rejects missing names before create or update service calls', async () => {
    await expect(
      controller.createExample({ name: '' }, principal),
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.updateExample('example-1', { name: '' }, principal),
    ).rejects.toThrow(BadRequestException);

    expect(service.createExample).not.toHaveBeenCalled();
    expect(service.updateExample).not.toHaveBeenCalled();
  });

  it('returns not found for missing read, update, and delete targets', async () => {
    service.getExample.mockResolvedValueOnce(null);
    service.updateExample.mockResolvedValueOnce(null);
    service.deleteExample.mockResolvedValueOnce(false);

    await expect(
      controller.getExample('missing', principal),
    ).rejects.toThrow(NotFoundException);
    await expect(
      controller.updateExample('missing', { name: 'Updated' }, principal),
    ).rejects.toThrow(NotFoundException);
    await expect(
      controller.deleteExample('missing', principal),
    ).rejects.toThrow(NotFoundException);
  });
});
