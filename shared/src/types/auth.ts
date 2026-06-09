import type { User } from './user';

export interface LoginRequest {
  username: string;
  password: string;
  /**
   * When true, the backend issues a long-lived refresh token (~90 days) so the
   * session survives browser restarts. When false / undefined, the refresh
   * token expiry stays at the short default and the frontend additionally
   * applies an idle-logout timer.
   */
  rememberMe?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  /** True when the password used at login was a one-time reset code: the
   *  session is transitional and the user must immediately set a real
   *  password before they can do anything else. */
  mustChangePassword?: boolean;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface JwtPayload {
  sub: number;
  username: string;
  role: string;
  /** Set on tokens issued after a code-based login. While true, the
   *  backend MustChangePasswordGuard rejects every authenticated request
   *  except the finish-reset endpoint. */
  mustChangePassword?: boolean;
  iat?: number;
  exp?: number;
}
