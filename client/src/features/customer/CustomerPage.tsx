import { BrandLogo } from "../../components/BrandLogo";
import { NotificationBell } from "../../components/NotificationBell";
import { StateBlock } from "../../components/StateBlock";
import { useRealtimeResource } from "../../shared/useRealtimeResource";
import type { CustomerTracking } from "../../shared/types";

const text = {
  brand: "DeliverHub",
  arriving: "ARRIVING SOON",
  minutes: "8 Minutes",
  track: "\u042F\u0432\u0446 \u0445\u044F\u043D\u0430\u0445",
  history: "\u0417\u0430\u0445\u0438\u0430\u043B\u0433\u044B\u043D \u0442\u04AF\u04AF\u0445",
  order: "\u0417\u0430\u0445\u0438\u0430\u043B\u0433\u0430",
  total: "\u041D\u0438\u0439\u0442",
  timeline: "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u043D \u044F\u0432\u0446",
  courier: "\u0422\u0430\u043D\u044B \u0445\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u043D \u0430\u0436\u0438\u043B\u0442\u0430\u043D",
  callCourier: "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u043D \u0430\u0436\u0438\u043B\u0442\u0430\u043D\u0442\u0430\u0439 \u0445\u043E\u043B\u0431\u043E\u0433\u0434\u043E\u0445",
  location: "\u0410\u0436\u0438\u043B\u0442\u043D\u044B \u0431\u0430\u0439\u0440\u0448\u0438\u043B",
  address: "\u0422\u0430\u043D\u044B \u0445\u0430\u044F\u0433",
  secretCode: "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u043D \u043D\u0443\u0443\u0446 \u043A\u043E\u0434",
  secretHelp: "\u0410\u0436\u0438\u043B\u0442\u0430\u043D \u0445\u04AF\u0440\u0433\u04E9\u0436 \u0438\u0440\u044D\u0445\u044D\u0434 \u044D\u043D\u044D \u043A\u043E\u0434\u044B\u0433 \u0434\u0430\u043C\u0436\u0443\u0443\u043B\u043D\u0430 \u0443\u0443.",
  noCode: "\u041D\u0443\u0443\u0446 \u043A\u043E\u0434 \u04AF\u04AF\u0441\u044D\u044D\u0433\u04AF\u0439 \u0431\u0430\u0439\u043D\u0430.",
  sms: "SMS-\u044D\u044D\u0440 \u043C\u04E9\u043D \u0438\u043B\u0433\u044D\u044D\u0433\u0434\u0441\u04E9\u043D",
};

export function CustomerPage() {
  const tracking = useRealtimeResource<CustomerTracking>("/orders/current/tracking", ["customer.tracking.refresh"]);

  return (
    <main className="customer-tracking role-page">
      <header className="customer-os-header">
        <BrandLogo showText size={32} />
        <NotificationBell />
      </header>
      <div className="customer-tabs">
        <button className="tab-active" type="button">{text.track}</button>
        <button type="button">{text.history}</button>
      </div>
      <div className="tracking-canvas">
        <StateBlock loading={tracking.loading} error={tracking.error} empty={!tracking.data}>
          {tracking.data && (
            <>
              <section className="tracking-map-hero">
                <div className="eta-card">
                  <span>{text.arriving}</span>
                  <strong>{text.minutes}</strong>
                </div>
                <button className="map-tool-button" type="button" aria-label={text.track}>⌾</button>
                <span className="route-line route-line-one" />
                <span className="route-line route-line-two" />
                <span className="route-pin" />
                <span className="route-courier" />
              </section>

              <article className="receipt-card">
                <div className="receipt-head">
                  <div>
                    <p>{text.order} {tracking.data.orderNo}</p>
                    <h2>{tracking.data.storeName}</h2>
                    <span>{tracking.data.district}</span>
                  </div>
                  <strong>{tracking.data.statusLabel}</strong>
                </div>
                <div className="receipt-lines">
                  {tracking.data.items.map((item) => (
                    <div key={item.label}>
                      <span>{item.label}</span>
                      <b>{"\u20AE"}{item.amountMnt}</b>
                    </div>
                  ))}
                </div>
                <div className="receipt-total">
                  <strong>{text.total}</strong>
                  <b>{"\u20AE"}{tracking.data.totalMnt}</b>
                </div>
              </article>

              <span className="tracking-dot" />

              <article className="timeline-card">
                <h2>{text.timeline}</h2>
                <div className="delivery-progress-row">
                  <span className="done">✓<b>Picked Up</b></span>
                  <i />
                  <span className="active">▣<b>On the Way</b></span>
                  <i />
                  <span>⌂<b>Arrived</b></span>
                </div>
                <div className="timeline-list">
                  {tracking.data.timeline.map((step) => (
                    <div className={`timeline-item ${step.state}`} key={step.title}>
                      <span className="timeline-icon">{step.icon}</span>
                      <div>
                        <h3>{step.title}</h3>
                        <p>{step.description}</p>
                      </div>
                      <time>{step.time}</time>
                    </div>
                  ))}
                </div>
              </article>

              <article className="courier-panel">
                <h2>{text.courier}</h2>
                <div className="courier-profile">
                  <div className="courier-avatar" aria-hidden="true">{"\u25CF"}</div>
                  <div>
                    <h3>{tracking.data.courier.name}</h3>
                    <p>
                      <span>{"\u2605"}</span> {tracking.data.courier.rating} {"\u00B7"} {tracking.data.courier.vehicle} {"\u00B7"} {tracking.data.courier.plate}
                    </p>
                  </div>
                  <button className="call-button" aria-label={text.callCourier} type="button">{"\u260E"}</button>
                </div>
                <div className="customer-map">
                  <span className="customer-map-dot" />
                  <span className="customer-map-pin" />
                  <strong>{text.location}</strong>
                  <p>{tracking.data.courier.etaText}</p>
                  <button className="track-button" type="button">{"\u2316"} {text.address}</button>
                </div>
              </article>

              <article className="secret-code-card">
                <h2>{text.secretCode}</h2>
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
                <small>{text.sms} {"\u00B7"} {tracking.data.maskedPhone}</small>
              </article>
            </>
          )}
        </StateBlock>
      </div>
    </main>
  );
}
