const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe('SELECT 1 as ok')
  .then((r) => {
    console.log('DB OK', JSON.stringify(r));
    return p.$queryRawUnsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_name='users'",
    );
  })
  .then((r) => {
    console.log('USER COLUMNS', r.map((x) => x.column_name).join(','));
    return p.$queryRawUnsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_name='payments'",
    );
  })
  .then((r) => {
    console.log('PAYMENT COLUMNS', r.map((x) => x.column_name).join(','));
    process.exit(0);
  })
  .catch((e) => {
    console.log('DB FAIL:', e.message);
    process.exit(1);
  });
