import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Legacy super-admin-only guard. New code should prefer
 *   @UseGuards(JwtAuthGuard, RolesGuard) + @Roles('super_admin')
 * which composes more cleanly with the site_admin / viewer tiers. This guard
 * stays as a one-liner for already-decorated controllers.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || user.role !== 'super_admin') {
      throw new ForbiddenException('super_admin role required');
    }
    return true;
  }
}
