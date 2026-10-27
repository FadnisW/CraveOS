import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

/**
 * Production bootstrap seed.
 *
 * It creates exactly one thing: the first super-admin account. Hubs, brands,
 * menus, riders and customers are real operational data and must be created
 * through the operator consoles — never invented by a seed script.
 *
 * Required environment variables:
 *   SUPER_ADMIN_EMAIL
 *   SUPER_ADMIN_PHONE
 * Optional:
 *   SUPER_ADMIN_NAME
 *
 * Run: npm run db:seed:prod
 */

const prisma = new PrismaClient();

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required to bootstrap a production database.`);
  }
  return value;
}

async function main() {
  const email = required('SUPER_ADMIN_EMAIL').toLowerCase();
  const phone = required('SUPER_ADMIN_PHONE');
  const name = process.env.SUPER_ADMIN_NAME?.trim() || 'Super Admin';

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
  });

  if (existing) {
    if (existing.role !== 'ADMIN' || existing.adminSubRole !== 'SUPER_ADMIN') {
      throw new Error(
        `A user already owns ${email} or ${phone} and is not a super-admin. Refusing to overwrite it.`,
      );
    }

    console.log(`Super-admin ${email} already exists. Nothing to do.`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      phone,
      name,
      role: 'ADMIN',
      adminSubRole: 'SUPER_ADMIN',
      referralCode: `SUPER_${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`,
    },
  });

  console.log(`Created super-admin ${email}. Sign in with an email OTP.`);
}

main()
  .catch((error) => {
    console.error('Production seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
