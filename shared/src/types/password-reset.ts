import type { UserRole } from './user';

export type PasswordResetStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'used'
  | 'expired';

/** GET /api/auth/password-reset/captcha — returned to the public forgot-password page. */
export interface CaptchaChallenge {
  id: string;
  question: string;
}

/** POST /api/auth/password-reset/request — public, no auth. */
export interface SubmitResetRequestPayload {
  username: string;
  /** Phone number OR email — whichever the user remembers. */
  contact: string;
  captchaId: string;
  captchaAnswer: string;
  /** Honeypot field. Real users always leave this empty. */
  hp?: string;
}

/** Item returned from GET /api/users/me/pending-resets (for approvers). */
export interface PendingResetItem {
  id: number;
  userId: number;
  username: string;
  fullName: string | null;
  role: UserRole;
  providedContact: string;
  /** Verifies the contact matches the stored email/phone — admins can decide
   *  whether the request is legitimate before approving. */
  contactMatchesEmail: boolean;
  contactMatchesPhone: boolean;
  requestedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface ApproveResetResponse {
  /** Plain 6-digit code — shown to the approver exactly once. Hand it to the
   *  requester out-of-band so they can redeem on the verify page. */
  code: string;
  /** ISO-8601 timestamp at which the code becomes invalid. */
  expiresAt: string;
  username: string;
}

/** Single row in the history table — visible to approvers, scoped the same
 *  way `PendingResetItem` is. Includes the final status + approver info. */
export interface ResetHistoryItem {
  id: number;
  userId: number;
  username: string;
  fullName: string | null;
  role: UserRole;
  providedContact: string;
  requestedAt: string;
  status: PasswordResetStatus;
  ipAddress: string | null;
  approverId: number | null;
  approverUsername: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  usedAt: string | null;
}

export interface ResetHistoryResponse {
  rows: ResetHistoryItem[];
  total: number;
}
