import { ActorRole } from "@prisma/client";
import { prisma } from "../src/database/prisma.js";

const permissions = [
  "platform.tenants.manage",
  "platform.subscriptions.manage",
  "platform.users.manage",
  "platform.disputes.manage",
  "platform.payments.monitor",
  "platform.audit.view",
  "platform.settings.manage",
  "store.dashboard.view",
  "store.products.manage",
  "store.inventory.manage",
  "store.orders.manage",
  "store.deliveries.manage",
  "store.employees.manage",
  "store.customers.view",
  "store.pricing.manage",
  "store.payments.view",
  "store.settlements.view",
  "store.reports.view",
  "store.settings.manage",
  "store.audit.view",
  "delivery.jobs.view",
  "delivery.jobs.accept",
  "delivery.jobs.reject",
  "delivery.pickup.verify",
  "delivery.location.share",
  "delivery.delivery.complete",
  "delivery.history.view",
  "delivery.wallet.view",
  "delivery.payout.request",
  "delivery.profile.manage",
  "customer.catalog.view",
  "customer.orders.create",
  "customer.orders.view",
  "customer.payments.create",
  "customer.delivery.track",
  "customer.delivery.confirm",
  "customer.disputes.create",
  "customer.profile.manage",
  "customer.notifications.view",
];

const rolePermissions = {
  PLATFORM_ADMIN: permissions.filter((permission) => permission.startsWith("platform.")),
  STORE_ADMIN: permissions.filter((permission) => permission.startsWith("store.")),
  DELIVERY_EMPLOYEE: permissions.filter((permission) => permission.startsWith("delivery.")),
  CUSTOMER: permissions.filter((permission) => permission.startsWith("customer.")),
};

const roleNames = {
  PLATFORM_ADMIN: "Platform admin",
  STORE_ADMIN: "Store admin",
  DELIVERY_EMPLOYEE: "Delivery employee",
  CUSTOMER: "Customer",
};

async function main() {
  await Promise.all(
    permissions.map((code) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code },
      }),
    ),
  );

  for (const roleCode of Object.values(ActorRole)) {
    const role = await prisma.role.upsert({
      where: { code: roleCode },
      update: {},
      create: {
        code: roleCode,
        name: roleNames[roleCode],
      },
    });

    const permissionRows = await prisma.permission.findMany({
      where: { code: { in: rolePermissions[roleCode] } },
      select: { id: true },
    });

    await Promise.all(
      permissionRows.map((permission) =>
        prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id,
          },
        }),
      ),
    );
  }

  const starterPlan = await prisma.subscriptionPlan.upsert({
    where: { code: "starter" },
    update: {},
    create: {
      code: "starter",
      name: "Starter",
      monthlyPriceMnt: 99000n,
      maxStoreUsers: 5,
      maxCouriers: 10,
      maxMonthlyOrders: 500,
      features: {
        reports: "basic",
        api: false,
        locationHistoryDays: 30,
      },
    },
  });

  console.log(`Seed complete. Permissions: ${permissions.length}. Plan: ${starterPlan.code}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
