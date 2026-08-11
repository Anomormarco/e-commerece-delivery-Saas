import { useEffect, useState } from "react";
import { postJson } from "../shared/api";
import { useRealtimeResource } from "../shared/useRealtimeResource";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  storeId?: string;
  storeName?: string;
};

type NotificationInbox = {
  unreadCount: number;
  items: NotificationItem[];
};

const text = {
  label: "Мэдэгдэл",
  empty: "Шинэ мэдэгдэл алга.",
  markRead: "Уншсан болгох",
  allRead: "Уншсан",
};

const localNotificationKey = "deliverhub-store-notifications";

function isForStore(item: { storeId?: string; storeName?: string; title?: string; body?: string }, storeId?: string, storeName?: string) {
  if (!storeId && !storeName) return true;
  const normalizedStoreName = storeName?.trim().toLowerCase();
  const itemStoreName = item.storeName?.trim().toLowerCase();
  const searchableText = `${item.title ?? ""} ${item.body ?? ""}`.toLowerCase();
  const matchesStoreName = Boolean(normalizedStoreName && (itemStoreName === normalizedStoreName || searchableText.includes(normalizedStoreName)));

  return item.storeId === storeId || matchesStoreName || (!item.storeId && !item.storeName);
}

function markInboxRead(inbox: NotificationInbox | null, storeId?: string, storeName?: string): NotificationInbox | null {
  if (!inbox) return inbox;
  const readAt = new Date().toISOString();

  return {
    ...inbox,
    unreadCount: inbox.items.filter((item) => !item.readAt && !isForStore(item, storeId, storeName)).length,
    items: inbox.items.map((item) => (item.readAt || !isForStore(item, storeId, storeName) ? item : { ...item, readAt })),
  };
}

export function NotificationBell({ className = "", storeId, storeName }: { className?: string; storeId?: string; storeName?: string }) {
  const [open, setOpen] = useState(false);
  const [localInbox, setLocalInbox] = useState<NotificationInbox | null>(null);
  const [localItems, setLocalItems] = useState<NotificationItem[]>(() => {
    try {
      const raw = localStorage.getItem(localNotificationKey);
      return raw ? (JSON.parse(raw) as NotificationItem[]) : [];
    } catch {
      return [];
    }
  });
  const inbox = useRealtimeResource<NotificationInbox>("/notifications", ["notifications.updated"]);
  const visibleInbox = localInbox ?? inbox.data;
  const scopedLocalItems = localItems.filter((item) => isForStore(item, storeId, storeName));
  const scopedRemoteItems = (visibleInbox?.items ?? []).filter((item) => isForStore(item, storeId, storeName));
  const items = [...scopedLocalItems, ...scopedRemoteItems];
  const unreadCount = items.filter((item) => !item.readAt).length;

  useEffect(() => {
    setLocalInbox(inbox.data);
  }, [inbox.data]);

  useEffect(() => {
    function refreshLocalItems(event?: Event) {
      if (event instanceof StorageEvent && event.key && event.key !== localNotificationKey) return;
      try {
        const raw = localStorage.getItem(localNotificationKey);
        setLocalItems(raw ? (JSON.parse(raw) as NotificationItem[]) : []);
      } catch {
        setLocalItems([]);
      }
    }

    window.addEventListener("storage", refreshLocalItems);
    window.addEventListener("focus", refreshLocalItems);
    return () => {
      window.removeEventListener("storage", refreshLocalItems);
      window.removeEventListener("focus", refreshLocalItems);
    };
  }, []);

  async function markRead() {
    const readAt = new Date().toISOString();
    const nextLocalItems = localItems.map((item) => (item.readAt || !isForStore(item, storeId, storeName) ? item : { ...item, readAt }));
    setLocalItems(nextLocalItems);
    localStorage.setItem(localNotificationKey, JSON.stringify(nextLocalItems));
    setLocalInbox((current) => markInboxRead(current ?? inbox.data, storeId, storeName));
    const nextInbox = await postJson<NotificationInbox>("/notifications/read").catch(() => null);

    if (nextInbox) {
      setLocalInbox(nextInbox);
      return;
    }

    void inbox.refetch();
  }

  function toggleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && unreadCount > 0) void markRead();
  }

  return (
    <div className={`notification-bell ${className}`}>
      <button aria-label={text.label} className="notification-bell-button" onClick={toggleOpen} type="button">
        <svg aria-hidden="true" className="notification-bell-icon" fill="none" viewBox="0 0 24 24">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {unreadCount > 0 && <b>{unreadCount > 9 ? "9+" : unreadCount}</b>}
      </button>
      {open && (
        <section className="notification-panel">
          <div>
            <strong>{text.label}</strong>
            <button disabled={!unreadCount} onClick={markRead} type="button">
              {unreadCount ? text.markRead : text.allRead}
            </button>
          </div>
          {items.length ? (
            items.slice(0, 6).map((item) => (
              <article className={item.readAt ? "" : "unread"} key={item.id}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <time>{new Date(item.createdAt).toLocaleString()}</time>
              </article>
            ))
          ) : (
            <p className="notification-empty">{inbox.loading ? "..." : text.empty}</p>
          )}
        </section>
      )}
    </div>
  );
}
