import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertUser(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}) {
  const passwordHash = await bcrypt.hash(input.password, 12);

  await prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      passwordHash,
      role: input.role,
      active: true
    },
    create: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      active: true
    }
  });
}

async function main() {
  await upsertUser({
    name: "Admin User",
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.com",
    password: process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345",
    role: UserRole.ADMIN
  });

  await upsertUser({
    name: "Sales User",
    email: process.env.SEED_SALES_EMAIL ?? "sales@example.com",
    password: process.env.SEED_SALES_PASSWORD ?? "Sales@12345",
    role: UserRole.SALES
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
