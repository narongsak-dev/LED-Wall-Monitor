import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('admin1234', 10);
  const viewerHash = await bcrypt.hash('viewer1234', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@example.com',
      passwordHash,
      fullName: 'ผู้ดูแลระบบ',
      role: 'super_admin',
    },
  });

  const viewer = await prisma.user.upsert({
    where: { username: 'viewer' },
    update: {},
    create: {
      username: 'viewer',
      email: 'viewer@example.com',
      passwordHash: viewerHash,
      fullName: 'ผู้ดูข้อมูล',
      role: 'viewer',
    },
  });

  const siteA = await prisma.site.upsert({
    where: { code: 'SITE-001' },
    update: {},
    create: {
      code: 'SITE-001',
      name: 'โรงงาน A',
      location: 'กรุงเทพมหานคร',
    },
  });

  const siteB = await prisma.site.upsert({
    where: { code: 'SITE-002' },
    update: {},
    create: {
      code: 'SITE-002',
      name: 'โรงงาน B',
      location: 'ชลบุรี',
    },
  });

  for (const site of [siteA, siteB]) {
    await prisma.userSite.upsert({
      where: { userId_siteId: { userId: admin.id, siteId: site.id } },
      update: { permission: 'admin' },
      create: { userId: admin.id, siteId: site.id, permission: 'admin' },
    });
    await prisma.userSite.upsert({
      where: { userId_siteId: { userId: viewer.id, siteId: site.id } },
      update: { permission: 'read' },
      create: { userId: viewer.id, siteId: site.id, permission: 'read' },
    });
  }

  // Example board attached to SITE-001 with one PZEM sensor on UART2.
  // KWS sensor placeholder is left commented until MAX485 module is wired up.
  const boardA1 = await prisma.board.upsert({
    where: { code: 'BOARD-001' },
    update: {},
    create: {
      siteId: siteA.id,
      code: 'BOARD-001',
      name: 'ตู้ควบคุมจุดที่ 1',
      hardware: 'HKL-EA8 (ESP32)',
      firmware: 'v0.1.0',
    },
  });

  await prisma.sensor.upsert({
    where: { code: 'PZEM-001' },
    update: {},
    create: {
      boardId: boardA1.id,
      siteId: siteA.id,
      code: 'PZEM-001',
      name: 'มิเตอร์ AC จุดที่ 1',
      sensorType: 'power_meter',
      model: 'PZEM-004T v3.0',
      channel: 'uart2',
    },
  });

  console.log('Seed complete.');
  console.log('Accounts:');
  console.log('  admin  / admin1234');
  console.log('  viewer / viewer1234');
  console.log('Boards:');
  console.log('  SITE-001 / BOARD-001 / PZEM-001');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
