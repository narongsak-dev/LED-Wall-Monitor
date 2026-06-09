/**
 * Emergency password-reset CLI — for when every super_admin has lost access
 * and the in-app reset flow is unreachable.
 *
 * Run inside the backend container (DATABASE_URL must point at the running
 * postgres):
 *
 *     docker compose -p ledmonitor exec backend \
 *         node dist/scripts/reset-password.js <username> <newpassword>
 *
 * If <newpassword> is omitted a random 12-char password is printed once.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function randomPassword(length: number): string {
  const buf = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}

async function main() {
  const [, , username, providedPassword] = process.argv;
  if (!username) {
    console.error('Usage: reset-password.js <username> [newpassword]');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      console.error(`User "${username}" not found`);
      process.exit(2);
    }

    const newPassword = providedPassword ?? randomPassword(12);
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, isActive: true },
    });

    console.log('');
    console.log(`✔ Password reset for "${username}" (role: ${user.role})`);
    console.log(`  New password: ${newPassword}`);
    console.log('');
    console.log('  Hand this to the user — it will be the only time they see it.');
    console.log('');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(99);
});
