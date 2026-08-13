import { StateBlock } from "../../components/StateBlock";
import { useRealtimeResource } from "../../shared/useRealtimeResource";
import type { CustomerTracking } from "../../shared/types";

const text = {
  help: "Тусламж",
  pageTitle: "Хүргэлт хянах",
  confirmed: "Баталгаажсан",
  preparing: "Бэлтгэж байна",
  inDelivery: "Хүргэлтэд гарсан",
  delivered: "Хүргэгдсэн",
  courier: "Хүргэгч",
  callCourier: "Хүргэлтийн ажилтантай холбогдох",
  secretCode: "Хүлээлгэн өгөх код",
  secretHelp: "Бараагаа хүлээн авахдаа энэ кодыг хэлнэ үү",
  noCode: "Нууц код үүсээгүй байна.",
};

export function CustomerPage() {
  const tracking = useRealtimeResource<CustomerTracking>("/orders/current/tracking", ["customer.tracking.refresh"]);

  return (
    <main className="customer-tracking role-page">
      <section className="customer-mobile-shell">
        <div className="customer-status-bar" aria-hidden="true">
          <span>9:41</span>
          <div><span>▮</span><span>◠</span><span>▰</span></div>
        </div>

        <header className="customer-track-header">
          <button type="button" aria-label="Буцах">‹</button>
          <h1>{text.pageTitle}</h1>
          <button type="button">{text.help}</button>
        </header>

        <StateBlock loading={tracking.loading} error={tracking.error} empty={!tracking.data}>
          {tracking.data && (
            <section className="customer-track-screen">
              <section className="customer-progress-panel" aria-label="Хүргэлтийн явц">
                <div className="customer-progress-line" aria-hidden="true"><span /></div>
                {[
                  { label: text.confirmed, icon: "✓", state: "done" },
                  { label: text.preparing, icon: "▣", state: "done" },
                  { label: text.inDelivery, icon: "▰", state: "active" },
                  { label: text.delivered, icon: "⌂", state: "pending" },
                ].map((step) => (
                  <div className={`customer-progress-step ${step.state}`} key={step.label}>
                    <span>{step.icon}</span>
                    <b>{step.label}</b>
                  </div>
                ))}
              </section>

              <section className="customer-track-map" aria-label="Газрын зураг">
                <div className="customer-map-grid" aria-hidden="true">
                  <span className="customer-map-road road-one" />
                  <span className="customer-map-road road-two" />
                  <span className="customer-map-road road-three" />
                  <span className="customer-map-route" />
                  <span className="customer-map-pin store" />
                  <span className="customer-map-pin courier" />
                </div>
                <article className="customer-courier-card">
                  <div className="customer-courier-avatar" aria-hidden="true">
                    {tracking.data.courier.name.slice(0, 1).toUpperCase()}
                    <b>{tracking.data.courier.rating} ★</b>
                  </div>
                  <div>
                    <h3>{text.courier}: {tracking.data.courier.name}</h3>
                    <p>Утас: {tracking.data.maskedPhone || "9911-XXXX"}</p>
                    <div>
                      <button type="button" aria-label={text.callCourier}>☎ Залгах</button>
                      <button type="button" aria-label="Чат">●</button>
                    </div>
                  </div>
                </article>
              </section>

              <footer className="customer-secret-footer">
                <h4>{text.secretCode}</h4>
                <p>{text.secretHelp}</p>
                {tracking.data.secretCode.length > 0 ? (
                  <div className="secret-code">
                    {tracking.data.secretCode.map((digit, index) => (
                      <span key={`${digit}-${index}`}>{digit}</span>
                    ))}
                  </div>
                ) : (
                  <div className="state-card">{text.noCode}</div>
                )}
              </footer>
            </section>
          )}
        </StateBlock>

        <nav className="customer-bottom-nav" aria-label="Хэрэглэгчийн цэс">
          <button type="button">⌂<span>Нүүр</span></button>
          <button className="active" type="button">▣<span>Түгээлт</span></button>
          <button type="button">$<span>Хэтэвч</span></button>
          <button type="button">◎<span>Профайл</span></button>
        </nav>
      </section>
    </main>
  );
}
