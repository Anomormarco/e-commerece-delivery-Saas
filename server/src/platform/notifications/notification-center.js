import { prisma } from "../../database/prisma.js";

const labelsByEvent = {
  "admin.registered": ["Шинэ админ бүртгэл", "Админ хэрэглэгч бүртгэгдлээ."],
  "admin.profile.updated": ["Админ профайл шинэчлэгдлээ", "Профайлын мэдээлэл өөрчлөгдлөө."],
  "courier.registered": ["Шинэ хүргэлтийн ажилтан", "Employee verification амжилттай бүртгэгдлээ."],
  "courier.status.updated": ["Employee төлөв шинэчлэгдлээ", "Хүргэлтийн ажилтны online/offline төлөв өөрчлөгдлөө."],
  "delivery.request.created": ["Шинэ хүргэлтийн хүсэлт", "Store шинэ хүргэлтийн хүсэлт үүсгэлээ."],
  "delivery.job.accepted": ["Хүргэлт хүлээн авлаа", "Employee хүргэлтийн ажлыг хүлээн авлаа."],
  "delivery.job.rejected": ["Хүргэлт татгалзлаа", "Employee хүргэлтийн хүсэлтээс татгалзлаа."],
  "delivery.job.arrived_store": ["Employee дэлгүүр дээр ирлээ", "Pickup verification эхлэхэд бэлэн боллоо."],
  "delivery.job.pickup_verified": ["Pickup баталгаажлаа", "Store OTP баталгаажиж ачаа авлаа."],
  "delivery.job.dropoff_verified": ["Хүргэлт дууслаа", "Customer OTP баталгаажиж хүргэлт амжилттай дууслаа."],
};

function notificationCopy(event) {
  const [title, body] = labelsByEvent[event.type] ?? ["Системийн мэдэгдэл", `${event.type} event ирлээ.`];
  return { title, body };
}

function audienceForRole(role) {
  if (role === "admin") return { channel: "ADMIN", tenantId: null };
  if (role === "store") return { channel: "STORE", tenantId: null };
  if (role === "courier") return { channel: "EMPLOYEE", tenantId: null };
  return { channel: "CUSTOMER", tenantId: null };
}

export async function createNotificationFromEvent(role, event = {}) {
  const { channel, tenantId } = audienceForRole(role);
  const { title, body } = notificationCopy(event);

  return prisma.notification.create({
    data: {
      tenantId,
      userId: event.payload?.userId ? String(event.payload.userId) : null,
      title,
      body,
      channel,
      status: "SENT",
    },
  });
}

export async function listNotificationsForRole(role, { limit = 20 } = {}) {
  const { channel } = audienceForRole(role);
  const notifications = await prisma.notification.findMany({
    where: { channel },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return {
    unreadCount: notifications.filter((notification) => !notification.readAt).length,
    items: notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      channel: notification.channel,
      status: notification.status,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
    })),
  };
}

export async function markNotificationsReadForRole(role) {
  const { channel } = audienceForRole(role);
  await prisma.notification.updateMany({
    where: { channel, readAt: null },
    data: { status: "READ", readAt: new Date() },
  });

  return listNotificationsForRole(role);
}
