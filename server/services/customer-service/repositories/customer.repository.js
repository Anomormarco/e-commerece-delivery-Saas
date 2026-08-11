import { prisma } from "@deliverhub/server-platform/database/prisma";

export async function findCustomerWithLatestOrder(userId) {
  return prisma.customer.findUnique({
    where: { userId },
    include: {
      orders: {
        take: 1,
        orderBy: { createdAt: "desc" },
        include: {
          store: true,
          customerAddress: true,
          items: true,
          statusHistory: { orderBy: { createdAt: "asc" } },
          deliveryAssignments: {
            take: 1,
            orderBy: { createdAt: "desc" },
            include: {
              employee: {
                include: { user: true },
              },
            },
          },
        },
      },
    },
  });
}

export async function findCustomerOrderHistory(userId, { limit = 10 } = {}) {
  return prisma.customer.findUnique({
    where: { userId },
    include: {
      orders: {
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          store: true,
          customerAddress: true,
          items: true,
          statusHistory: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
}
