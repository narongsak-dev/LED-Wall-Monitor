import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: number;
  username: string;
  role: string;
  /** True only on transitional sessions created by logging in with a
   *  one-time reset code. While set, MustChangePasswordGuard rejects every
   *  authenticated endpoint except finish-reset. */
  mustChangePassword: boolean;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
