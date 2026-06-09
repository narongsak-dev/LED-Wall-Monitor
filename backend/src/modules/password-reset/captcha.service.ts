import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

const CAPTCHA_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 5000;

interface Entry {
  answer: number;
  expiresAt: number;
}

/**
 * Tiny in-memory math captcha. Picks two 2-digit operands and an operator
 * such that the result is always a small positive integer (so users typing
 * on mobile aren't fighting an awkward keyboard). Each captcha id is a
 * one-shot — solving it consumes the entry.
 *
 * In-memory is fine here: an attacker can't brute it offline (the answer
 * never leaves the server before solve), and even if the process restarts
 * mid-flow the user just gets a "captcha expired" error and fetches a new
 * one. We do periodic GC to keep the Map from growing without bound.
 */
@Injectable()
export class CaptchaService {
  private readonly store = new Map<string, Entry>();
  private lastGc = Date.now();

  issue(): { id: string; question: string } {
    this.maybeGc();

    const a = randInt(2, 19);
    const b = randInt(2, 9);
    let answer: number;
    let question: string;
    if (Math.random() < 0.5) {
      answer = a + b;
      question = `${a} + ${b} = ?`;
    } else {
      const hi = Math.max(a, b);
      const lo = Math.min(a, b);
      answer = hi - lo;
      question = `${hi} - ${lo} = ?`;
    }

    const id = crypto.randomBytes(12).toString('base64url');
    this.store.set(id, { answer, expiresAt: Date.now() + CAPTCHA_TTL_MS });
    return { id, question };
  }

  /** Returns true if the answer matches; consumes the entry either way so
   *  it can't be reused on a retry. */
  verifyAndConsume(id: string, providedAnswer: string): boolean {
    const entry = this.store.get(id);
    if (!entry) return false;
    this.store.delete(id);
    if (entry.expiresAt < Date.now()) return false;
    const n = Number(providedAnswer);
    if (!Number.isFinite(n)) return false;
    return n === entry.answer;
  }

  private maybeGc() {
    const now = Date.now();
    if (this.store.size < MAX_ENTRIES && now - this.lastGc < 60_000) return;
    this.lastGc = now;
    for (const [id, entry] of this.store) {
      if (entry.expiresAt < now) this.store.delete(id);
    }
  }
}

function randInt(min: number, max: number): number {
  return min + crypto.randomInt(0, max - min + 1);
}
