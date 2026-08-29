import { seedActivityTypes } from "../lib/members";
import { seedSuperadminIfEmpty } from "../lib/admins";
import { getProgramSettings } from "../lib/settings";
import { seedDemoData } from "../lib/demo-seed";
import { env } from "../lib/env";
import { prisma } from "../lib/db";

async function main() {
  await getProgramSettings();
  await seedSuperadminIfEmpty();
  await seedActivityTypes();
  if (env().seedDemoData) await seedDemoData();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
