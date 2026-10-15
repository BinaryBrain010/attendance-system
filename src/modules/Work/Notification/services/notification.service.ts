import prisma from "../../../../core/models/base.model";

/** Personal notifications. Every method is scoped to the caller's own userId. */
class NotificationService {
  async list(userId: string, page = 1, pageSize = 20, onlyUnread = false) {
    const where: Record<string, any> = { userId, ...(onlyUnread ? { readAt: null } : {}) };
    const skip = (page - 1) * pageSize;
    const [data, totalSize, unread] = await Promise.all([
      prisma.notification.findMany({ where, skip, take: pageSize, orderBy: { createdAt: "desc" } }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { data, totalSize, unread };
  }
  async unreadCount(userId: string) {
    return { unread: await prisma.notification.count({ where: { userId, readAt: null } }) };
  }
  async markRead(userId: string, id?: string) {
    if (id) { await prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } }); }
    else { await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } }); }
    return this.unreadCount(userId);
  }
}

export default NotificationService;
