import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleName } from '../../common/enums/domain.enums.js';
import { RolesGuard } from './roles.guard.js';

function createContext(role?: RoleName): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user: role ? { id: 1, role } : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows access when no @Roles metadata is set', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext(RoleName.CITIZEN))).toBe(true);
  });

  it('allows access when user has required role', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([RoleName.STAFF]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext(RoleName.STAFF))).toBe(true);
  });

  it('throws ForbiddenException when CITIZEN accesses STAFF route', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([RoleName.STAFF]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(createContext(RoleName.CITIZEN))).toThrow(
      ForbiddenException,
    );
  });
});

