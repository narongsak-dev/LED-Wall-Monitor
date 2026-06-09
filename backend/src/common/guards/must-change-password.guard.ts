import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Global guard that locks transitional sessions into a single allowed action.
 *
 * When a user logs in with a one-time reset code, the issued JWT carries
 * `mustChangePassword=true`. JwtStrategy lifts that flag onto `req.user`.
 * This guard runs AFTER authentication and rejects every authenticated
 * request whose path isn't on the small allow-list below.
 *
 * Unauthenticated routes (login, captcha, etc.) pass through untouched —
 * `req.user` is undefined for them.
 */
const ALLOW_DURING_MUST_CHANGE = [
  /\/api\/auth\/finish-reset$/,
  /\/api\/auth\/refresh$/,
  /\/api\/users\/me$/,
];

@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as { mustChangePassword?: boolean } | undefined;
    if (!user || !user.mustChangePassword) return true;

    const path = req.path;
    for (const re of ALLOW_DURING_MUST_CHANGE) {
      if (re.test(path)) return true;
    }
    throw new ForbiddenException(
      'จำเป็นต้องตั้งรหัสผ่านใหม่ก่อนใช้งานระบบ',
    );
  }
}
