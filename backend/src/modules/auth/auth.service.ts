import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async login(
    username: string,
    password: string,
    meta: { ipAddress?: string | null; userAgent?: string | null; rememberMe?: boolean } = {},
  ) {
    const user = await this.users.findByUsername(username);
    const fail = async (existingUserId: bigint | null = null) => {
      await this.users.recordLogin({
        userId: existingUserId,
        username,
        success: false,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    };

    if (!user || !user.isActive) {
      await fail(user ? user.id : null);
    }

    // Two-step authentication: first try the real password, then fall back
    // to checking whether the value is an approved-and-unused password-reset
    // code. Matching a reset code yields a "transitional" session whose only
    // allowed action is setting a new password (mustChangePassword=true).
    let mustChangePassword = false;
    const passwordOk = await bcrypt.compare(password, user!.passwordHash);
    if (!passwordOk) {
      const codeOk = await this.checkResetCode(user!.id, password);
      if (!codeOk) await fail(user!.id);
      // The reset request stays `approved` — it'll get marked `used` only
      // when setPasswordAfterReset() actually changes the password. This
      // way a user who logs in with the code but doesn't finish the flow
      // can sign in again with the same code (until it expires).
      mustChangePassword = true;
    }

    await this.users.recordLogin({
      userId: user!.id,
      username: user!.username,
      success: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.issueTokens(
      user!.id,
      user!.username,
      user!.role,
      meta.rememberMe,
      mustChangePassword,
    );
  }

  /** Returns true if `code` matches the latest approved+unexpired reset
   *  request for this user. Does NOT mark the request `used` — that happens
   *  only when the user actually completes finish-reset. Until then the
   *  code stays valid so the user can sign in again if they cancelled out
   *  of the FirstTimePassword page without setting a real password (they
   *  can't access anything else while mustChangePassword is set anyway).
   *
   *  The request stays in `approved` status. Expiry is enforced by the
   *  `codeExpiresAt` timestamp on every login attempt. */
  private async checkResetCode(userId: bigint, code: string): Promise<boolean> {
    const req = await this.prisma.passwordResetRequest.findFirst({
      where: { userId, status: 'approved' },
      orderBy: { approvedAt: 'desc' },
    });
    if (!req || !req.codeHash || !req.codeExpiresAt) return false;
    if (req.codeExpiresAt < new Date()) {
      await this.prisma.passwordResetRequest.update({
        where: { id: req.id },
        data: { status: 'expired' },
      });
      return false;
    }
    return bcrypt.compare(code, req.codeHash);
  }

  async refresh(token: string) {
    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      const user = await this.users.findById(BigInt(payload.sub));
      if (!user || !user.isActive) throw new UnauthorizedException();
      // A re-issue from refresh inherits the "remembered" property — if the
      // original refresh token had a long ttl we preserve it; otherwise the
      // default applies. We approximate by reading remaining lifetime.
      const longLived =
        typeof payload.exp === 'number' &&
        typeof payload.iat === 'number' &&
        payload.exp - payload.iat > 7 * 24 * 60 * 60;
      // Preserve the mustChangePassword bit too — until they actually set a
      // new password, every refresh stays in transitional mode.
      const mcp = payload.mustChangePassword === true;
      return this.issueTokens(user.id, user.username, user.role, longLived, mcp);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /** Issue fresh tokens AFTER the user has set a new password — clears the
   *  transitional flag so the rest of the app becomes accessible. */
  async issueTokensAfterReset(userId: bigint) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return this.issueTokens(user.id, user.username, user.role, false, false);
  }

  private async issueTokens(
    id: bigint,
    username: string,
    role: string,
    rememberMe = false,
    mustChangePassword = false,
  ) {
    // The flag rides on both tokens — it's checked on every authenticated
    // request, so the JwtStrategy hands it to req.user and downstream guards
    // can reject anything that isn't the "set new password" endpoint.
    const basePayload = { sub: Number(id), username, role, mustChangePassword };

    const accessToken = await this.jwt.signAsync(basePayload);
    const refreshToken = await this.jwt.signAsync(basePayload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: rememberMe
        ? '90d'
        : this.config.get<string>('JWT_REFRESH_EXPIRES_IN'),
    });

    return { accessToken, refreshToken, mustChangePassword };
  }
}
