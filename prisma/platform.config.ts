import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "platform.schema.prisma",
  migrations: {
    path: "platform/migrations"
  }
});
