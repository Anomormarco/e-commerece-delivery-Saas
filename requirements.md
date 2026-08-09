# Identity-Verified Multi-Tenant E-Commerce Delivery SaaS Platform

## Runtime URL And Endpoint Map

This project must not run the role UIs as one React Router-style screen switcher. Each actor has a separate frontend URL and talks to its own backend service port.

### Frontend apps

| App | Local URL | Client command | Backend target |
|---|---|---|---|
| Public landing | `http://127.0.0.1:5173` | `npm run dev:public --workspace client` | Gateway health/info only |
| Platform admin | `http://127.0.0.1:5174` | `npm run dev:admin --workspace client` | `http://127.0.0.1:3101/api/admin` |
| Store owner | `http://127.0.0.1:5175` | `npm run dev:store --workspace client` | `http://127.0.0.1:3102/api/store` |
| Delivery employee | `http://127.0.0.1:5176` | `npm run dev:courier --workspace client` | `http://127.0.0.1:3103/api/courier` |
| Customer | `http://127.0.0.1:5177` | `npm run dev:customer --workspace client` | `http://127.0.0.1:3104/api/customer` |

### Backend services

| Service | Local URL | Service command | Health | Current endpoints |
|---|---|---|---|---|
| API gateway | `http://127.0.0.1:3000` | `npm run dev:gateway --workspace server` | `GET /health`, `GET /api/health` | Composes all service routes for compatibility |
| Admin service | `http://127.0.0.1:3101` | `npm run dev:admin --workspace server` | `GET /health` | `GET /api/admin/dashboard` |
| Store service | `http://127.0.0.1:3102` | `npm run dev:store --workspace server` | `GET /health` | `GET /api/store/dashboard` |
| Courier service | `http://127.0.0.1:3103` | `npm run dev:courier --workspace server` | `GET /health` | `GET /api/courier/dashboard` |
| Customer service | `http://127.0.0.1:3104` | `npm run dev:customer --workspace server` | `GET /health` | `GET /api/customer/orders/current/tracking` |

### Frontend-to-backend calls

| Frontend app | Fetch base URL | Page fetch path | Final request URL |
|---|---|---|---|
| Platform admin | `http://127.0.0.1:3101/api/admin` | `/dashboard` | `http://127.0.0.1:3101/api/admin/dashboard` |
| Store owner | `http://127.0.0.1:3102/api/store` | `/dashboard` | `http://127.0.0.1:3102/api/store/dashboard` |
| Delivery employee | `http://127.0.0.1:3103/api/courier` | `/dashboard` | `http://127.0.0.1:3103/api/courier/dashboard` |
| Customer | `http://127.0.0.1:3104/api/customer` | `/orders/current/tracking` | `http://127.0.0.1:3104/api/customer/orders/current/tracking` |

## Тойм

Энэхүү платформ нь дараах боломжуудыг нэг дор нэгтгэсэн олон-tenant (multi-tenant) SaaS систем юм:

- Store-ууд бараа, захиалгаа удирдах
- Баталгаажсан хүргэлтийн ажилтан (courier) бараа хүлээн авах
- Хэрэглэгч захиалгаа real-time хянах
- Төлбөр хийх (QPay)
- Хүргэлтийн орлогыг ажилтны wallet-д тооцох

### Үндсэн зарчим

| Механизм | Зорилго |
|---|---|
| e-Mongolia / ДАН | Тухайн хүн хэн болохыг баталгаажуулна |
| Нүүр танилт (Face verification) | Камерын өмнө байгаа хүн баталгаажсан эзэмшигч мөн эсэхийг шалгана |
| QR / OTP | Аль барааг хэн, хэзээ хүлээн авсныг баталгаажуулна |
| GPS | Хүргэлтийн явц, байршлыг тогтооно |
| Payment ledger | Хэрэглэгчийн төлбөрөөс store болон courier-д ногдох дүнг тооцно |

> **Чухал:** Ганц нүүрний зураг авах нь бараа алдагдахаас хамгаалах хангалттай баталгаа биш. Дээрх аргуудыг нийлүүлж **chain of custody** (барааны хариуцлага хэнээс хэнд шилжсэнийг нотлох систем) болгох шаардлагатай.

---

## 1. Системийн оролцогч ба RBAC

4 үндсэн actor байна. Customer нь tenant-ийн ажилтан биш тул RBAC-ийн хувьд тусдаа consumer actor гэж тооцно — ингэснээр архитектур цэвэр болно.

| Role | Эрх, зориулалт |
|---|---|
| **Platform Admin** | SaaS, store/tenant, subscription, төлбөр, маргаан, системийн тохиргоо |
| **Store Admin** | Бараа, захиалга, салбар, ажилтан, хүргэлт, тайлан удирдах |
| **Delivery Employee** | Баталгаажуулалт, хүргэлт авах, GPS, хүргэлт дуусгах, орлого/данс |
| **Customer** | Бараа захиалах, төлбөр хийх, хүргэлт хянах, бараа хүлээн авах |

**Дараагийн хувилбарт** Store Admin-ийг дараах байдлаар салгаж болно: `Store Owner`, `Store Manager`, `Warehouse Staff`. MVP-д 4 actor хангалттай.

### Permission-ийн үндсэн жагсаалт

```
platform.tenants.manage
platform.subscriptions.manage
platform.disputes.manage
platform.audit.view

store.products.manage
store.orders.manage
store.employees.manage
store.assignments.manage
store.reports.view
store.settings.manage

delivery.jobs.view
delivery.jobs.accept
delivery.pickup.verify
delivery.location.share
delivery.delivery.complete
delivery.wallet.view
delivery.payout.request

customer.orders.create
customer.orders.view
customer.payments.create
customer.delivery.confirm
customer.disputes.create
```

---

## 2. Multi-tenant SaaS загвар

- Store бүр тусдаа **tenant** байна.
- Tenant-д хамаарах бүх өгөгдөлд `tenant_id` байна: Products, Warehouses, Employees, Orders, Deliveries, Payments, Wallet transactions, Reports, Audit logs.
- Нэг store нөгөө store-ийн захиалга, хэрэглэгч, ажилтан, санхүүгийн мэдээллийг **ямар ч нөхцөлд харах ёсгүй**.

---

## 3. Гол бизнесийн процесс

### 3.1 Хүргэлтийн ажилтны бүртгэл

1. Ажилтан утас эсвэл email-ээр бүртгүүлнэ.
2. ДАН/e-Mongolia интеграцаар иргэний identity баталгаажуулна.
3. Систем зөвшөөрөл авч шаардлагатай баталгаажсан мэдээллийг хадгална.
4. Ажилтан камер ашиглан нүүрний liveness шалгалт хийнэ.
5. Identity зураг болон live нүүрийг 1:1 face verification-оор харьцуулна.
6. Банкны дансаа бүртгүүлнэ.
7. Store Admin ажилтныг review хийгээд идэвхжүүлнэ.
8. Ажилтны статус `VERIFIED` болно.

**Ажилтны verification төлөв (happy path):**

```
REGISTERED
→ IDENTITY_PENDING
→ IDENTITY_VERIFIED
→ FACE_PENDING
→ FACE_VERIFIED
→ ADMIN_REVIEW
→ ACTIVE
```

**Татгалзсан / хугацаа дууссан төлөвүүд:**

```
REJECTED
SUSPENDED
REVERIFICATION_REQUIRED
```

> e-Mongolia-ийн албан мэдээлэлд ДАН системийг төр болон хувийн байгууллагын цахим үйлчилгээнд хэрэглэгч баталгаажуулах, нэвтрүүлэх дэд бүтэц гэж тодорхойлсон байдаг. Гэхдээ production интеграц хийхэд албан ёсны гэрээ, зөвшөөрөл, sandbox/API access тусад нь шаардлагатай тул үүнийг энгийн social login шиг шууд ашиглана гэж үзэж болохгүй. ([e-Mongolia — системийн тухай](https://www.e-mongolia.mn))

---

## 4. Нүүр танилтын шийдэл

Нүүр танилтыг өөрсдөө эхнээс нь ML model сургаж хийх шаардлагагүй — production түвшинд баталгаажсан biometric provider ашиглах нь зөв.

### Шаардлагатай 3 шалгалт

**1. Liveness detection** — Камерын өмнө амьд хүн байгаа эсэх:
- Зураг барьсан эсэх
- Өөр дэлгэц дээр видео тоглуулсан эсэх
- Mask/deepfake ашигласан эсэх
- Камерын дүрс бодит эсэх

**2. Face verification** — e-Mongolia/identity эх сурвалжийн зурагтай камерын live дүрсийг 1:1 харьцуулна.

> Энд "олон хүнээс хэн болохыг олох" (1:N recognition) хэрэггүй. Зөвхөн **"Энэ хүн бүртгэлтэй Бат мөн үү?"** гэсэн 1:1 verification хийнэ.

**3. Transaction binding** — Нүүр амжилттай таарсан үр дүнг тухайн үйлдэлтэй холбоно:

```
employee_id
verification_session_id
delivery_id
action = PICKUP
liveness_result
face_match_score
provider_reference
verified_at
device_id
ip_address
location
```

### Нүүр таних үеүүд
- Анхны employee onboarding
- Шинэ төхөөрөмжөөс нэвтрэх
- Store-оос өндөр үнэтэй бараа авах
- Сэжигтэй үйлдэл илэрсэн
- Тодорхой хугацааны дараах re-verification

### Эрсдэлийн дүрэм (risk-based verification)

Хүргэлтийн бүх бараанд дахин нүүр танилт шаардах нь ажиллагааг удаашруулна тул эрсдэлээс хамааруулна:

| Эрсдэл | Баталгаажуулалт |
|---|---|
| Бага үнэтэй бараа | Login + pickup QR |
| Дунд эрсдэл | QR + employee PIN |
| Өндөр үнэтэй бараа | QR + liveness + face verification |
| Сэжигтэй үйлдэл | Face verification + admin approval |

### Биометрийн өгөгдлийн хамгаалалт

- Хэрэглэгчээс тусгай, ойлгомжтой consent авах
- Raw camera video-г үндсэн database-д хадгалахгүй байх
- Боломжтой бол зөвхөн provider reference болон үр дүн хадгалах
- Хэрэв зураг хадгалбал object storage-д тусад нь шифрлэх
- Нүүрний embedding/template-ийг шифрлэх
- Tenant Admin-д raw biometric data харуулахгүй байх
- Retention хугацаа тогтоох
- Устгах хүсэлт, audit trail хэрэгжүүлэх
- Биометрийн өгөгдлийг зар сурталчилгаа, analytics-д ашиглахгүй байх

> **Санамж:** Монгол Улсад биометр болон байршлын мэдээлэлтэй холбоотой хууль зүйн үнэлгээ, зөвшөөрлийн текст, хадгалалтын хугацааг мэргэжлийн хуульчаар баталгаажуулах шаардлагатай.

---

## 5. Барааг ажилтанд хүлээлгэн өгөх процесс (Pickup flow)

Энэ бол системийн хамгийн чухал security workflow.

1. Store ажилтан захиалгыг бэлдэнэ.
2. Захиалгыг хүргэлтийн ажилтанд assign хийнэ.
3. Delivery Employee web app дээр ажлын санал ирнэ.
4. Ажилтан хүргэлтийг accept хийнэ.
5. Store-д очиход GPS geofence шалгана.
6. Store захиалгын нэг удаагийн QR код харуулна.
7. Хүргэлтийн ажилтан QR-г уншуулна.
8. Эрсдэлийн дүрмээр нүүр/liveness баталгаажуулалт хийнэ.
9. Store-ийн ажилтан барааны багц, serial/seal кодыг батална.
10. Хоёр тал digital handover confirmation хийнэ.
11. Барааны хариуцлага store-оос courier руу шилжинэ.
12. Захиалга `PICKED_UP` төлөвт орно.
13. GPS tracking эхэлнэ.

### Pickup evidence

```
Employee identity
Store/warehouse
Order болон package ID
QR verification
Face verification result
Pickup цаг
GPS координат
Device
Package зураг
Seal/serial number
Store талын баталгаажуулалт
Audit event
```

### QR кодын шаардлага

- Нэг удаагийн
- Богино хугацаанд хүчинтэй
- Order/assignment-д уягдсан
- Server-side баталгааждаг
- Screenshot дахин ашиглах боломжгүй

---

## 6. Захиалгын төлөвийн загвар

Backend төлөвийг дэлгэрэнгүй хадгална. Customer UI дээр энгийн алхмаар харуулна.

### Дотоод state machine

```
DRAFT
→ PAYMENT_PENDING
→ PAID
→ CONFIRMED
→ PREPARING
→ READY_FOR_PICKUP
→ COURIER_ASSIGNED
→ COURIER_ARRIVING
→ PICKUP_VERIFICATION
→ PICKED_UP
→ IN_TRANSIT
→ ARRIVING
→ DELIVERED
→ CUSTOMER_CONFIRMED
→ COMPLETED
```

### Алдааны төлөвүүд

```
PAYMENT_FAILED
CANCELLED
PICKUP_REJECTED
DELIVERY_FAILED
RETURN_REQUESTED
RETURNING
RETURNED
DISPUTED
REFUNDED
```

### Customer-д харагдах хялбар төлөв

1. Захиалга хүлээн авсан
2. Төлбөр баталгаажсан
3. Захиалга бэлтгэж байна
4. Хүргэлтийн ажилтан томилогдсон
5. Барааг хүргэлтэд хүлээн авсан
6. Захиалга замдаа гарсан
7. Хүргэлтийн ажилтан ойртож байна
8. Захиалга хүргэгдсэн

> `OrderStatusHistory` хүснэгтэд төлөв солигдсон цаг, хэн өөрчилсөн, тайлбар, нотолгоог хадгална.

---

## 7. Customer бараа хүлээн авах баталгаажуулалт

> Зөвхөн courier "Delivered" дарснаар хүргэлт дуусах ёсгүй.

1. Courier хэрэглэгчийн байршлын geofence-д хүрнэ.
2. Customer web app-д 6 оронтой OTP эсвэл нэг удаагийн QR гарна.
3. Courier OTP-г оруулах буюу QR-г уншуулна.
4. Шаардлагатай бол package зураг авна.
5. Customer "Бараагаа хүлээн авлаа" гэж батална.
6. Захиалга `DELIVERED` болно.
7. Маргаан гаргах богино хугацаа эхэлнэ.
8. Дараа нь `COMPLETED` болж settlement хийгдэнэ.

### Хэрэглэгч байхгүй үед

- Authorized recipient сонгох
- Reception/guard-д өгөх зөвшөөрөл
- Safe-drop зураг
- Дахин хүргэх
- Store руу буцаах

---

## 8. Хүргэлтийн үнэ тооцох requirement

> Хүргэлтийн үнийг `watchPosition()`-оор тооцохгүй. Захиалга өгөх үед pickup болон delivery address-ийн route distance-ээр урьдчилан тооцно.

### Тооцооны үндэс

```
Delivery fee =
  Base fee
  + distance charge
  + weight/volume charge
  + zone surcharge
  + time surcharge
  + special handling
  - discount
```

**Жишээ:**

| Зүйл | Дүн |
|---|---|
| Суурь үнэ | 3,000₮ |
| Эхний 3 км | багтсан |
| 3 км-ээс хойш | 800₮ / км |
| Хүнд барааны нэмэгдэл | 2,000₮ |
| Оргил цагийн нэмэгдэл | 15% |

### Шаардлагатай дүрэм

- Store-ийн pickup координат тодорхой байна.
- Customer address-ийг газрын зураг дээр pin-ээр батална.
- Routing service авто замын бодит маршрутыг тооцно (шулуун шугамын зайгаар үнэ бодохгүй).
- Тооцоолсон үнэ checkout дээр хэрэглэгчид харагдана.
- Захиалга төлөгдсөний дараа delivery quote түгжигдэнэ.
- Хаяг өөрчлөгдвөл үнэ дахин тооцогдоно.
- Pricing rule бүр tenant болон zone-оор ялгаатай байж болно.
- Quote-д ашигласан дүрэм, зай, хувилбар хадгалагдана.

```typescript
type DeliveryQuote = {
  pickupLocation: GeoPoint;
  dropoffLocation: GeoPoint;
  routeDistanceMeters: number;
  estimatedDurationSeconds: number;
  baseFee: number;
  distanceFee: number;
  surcharges: number;
  discounts: number;
  totalFee: number;
  currency: "MNT";
  pricingRuleVersion: string;
  expiresAt: string;
};
```

---

## 9. QPay төлбөр болон мөнгөний урсгал

### Checkout процесс

1. Backend order үүсгэнэ.
2. Үнэ болон хүргэлтийн хөлсийг түгжинэ.
3. QPay invoice үүсгэнэ.
4. Customer QR-аар төлнө.
5. QPay callback ирнэ.
6. Backend QPay API-аар төлбөрийг дахин шалгана.
7. Idempotency check хийнэ.
8. Order `PAID` болно.
9. Internal ledger-д мөнгөний задаргаа бүртгэнэ.

> QPay-ийн албан баримтжуулалтад OAuth credential авах, invoice үүсгэх, төлбөр шалгах, цуцлах болон буцаах API-ууд байдгийг дурдсан байдаг. Production merchant эрхийг QPay-тай гэрээгээр авна. ([QPay API documentation](https://qpay.mn))

### Чухал ялгаа

> QPay төлбөр амжилттай болсон даруй courier-ийн available balance-д мөнгө нэмэх нь **буруу**. Courier бараагаа хүргээгүй байж болно.

### Зөв wallet төлөв

```
EXPECTED
→ PENDING
→ AVAILABLE
→ PAYOUT_REQUESTED
→ PAID_OUT
```

- **EXPECTED**: хүргэлтийг accept хийхэд харагдах боломжит орлого
- **PENDING**: бараа хүргэгдсэн ч settlement хүлээж байгаа
- **AVAILABLE**: customer confirmation/dispute хугацааны дараа авах боломжтой
- **PAID_OUT**: банкны данс руу шилжүүлсэн

### Payment breakdown жишээ

Хэрэглэгч 105,000₮ төлсөн бол:

| Зүйл | Дүн |
|---|---|
| Барааны үнэ | 95,000₮ |
| Хүргэлтийн төлбөр | 8,000₮ |
| Үйлчилгээний шимтгэл | 2,000₮ |
| **Нийт** | **105,000₮** |

**Ledger задаргаа:**

| Зүйл | Дүн |
|---|---|
| Store payable | 95,000₮ |
| Courier earning | 6,500₮ |
| Platform delivery fee | 1,500₮ |
| Platform service fee | 2,000₮ |

> Систем нь мөнгийг өөрөө "хадгалж, хуваарилдаг" бол escrow/payment intermediary шинжтэй болж болзошгүй. QPay invoice API байгаа нь автоматаар split settlement болон courier payout дэмжинэ гэсэн үг биш. Иймээс merchant agreement, банкны payout механизм, татвар, eBarimt болон зохицуулалтын загварыг QPay/банк/хуульчаар тусад нь шийдэх шаардлагатай.

---

## 10. Delivery Employee web app (Mobile-first PWA)

### Үндсэн page-ууд

- Login / ДАН баталгаажуулалт
- Identity verification status
- Face/liveness verification
- Home dashboard
- Available delivery jobs
- Assigned jobs
- Delivery job detail
- Route/navigation
- Pickup verification
- Active delivery
- Customer handover
- Delivery history
- Earnings
- Wallet transactions
- Payout request
- Bank accounts
- Notifications
- Profile and documents
- Support/dispute
- Privacy and tracking consent

### Dashboard-ийн KPI

- Өнөөдрийн хүргэлт
- Хүлээгдэж буй ажил
- Амжилттай хүргэлт
- Expected earning
- Pending balance
- Available balance
- Online/offline статус
- Verification status

---

## 11. Store Admin UI

### Page-ууд

Dashboard · Products · Categories · Inventory · Warehouses/branches · Orders · Order details · Dispatch board · Delivery live map · Delivery history · Employees · Employee verification review · Customers · Pricing rules · Delivery zones · Payments · Settlements · Refunds · Reports · Audit logs · Store settings · Subscription and billing · Integration/API settings · Notification templates · Disputes and returns

### Dashboard KPI

- Өнөөдрийн захиалга
- Бэлтгэгдэж байгаа
- Хүргэлтэд гарсан
- Хоцорсон
- Амжилттай хүргэгдсэн
- Буцаагдсан
- Нийт борлуулалт
- Хүргэлтийн зардал
- Courier performance

---

## 12. Customer web app

### Page-ууд

Landing page · Store/catalog · Product detail · Cart · Checkout · Address and map pin · Delivery quote · QPay payment · Payment result · My orders · Order detail · Live delivery tracking · Delivery confirmation · Rating/review · Returns and disputes · Notifications · Saved addresses · Profile · Privacy settings

### Tracking page-ийн агуулга

- Step-by-step timeline
- Courier-ийн зөвшөөрөгдсөн нэр/зураг
- Estimated arrival
- Live map
- "Courier-тэй холбогдох"
- OTP/QR
- Support
- Cancel/return policy

> Courier-ийн хувийн утасны дугаарыг шууд харуулахын оронд **masked calling/chat** ашиглах нь зөв.

---

## 13. Platform Admin UI

Platform overview · Tenant/store management · Tenant detail · Subscription plans · Active subscriptions · Platform users · Identity verification monitoring · Payment monitoring · Settlement/payout monitoring · Disputes · Fraud/risk alerts · System audit · Integration health · Feature flags · Global settings · Support management · Usage analytics · System reports

---

## 14. SaaS subscription

| | Starter | Growth | Enterprise |
|---|---|---|---|
| Store users | 5 | 30 | Custom |
| Couriers | 10 | 100 | Custom |
| Monthly orders | 500 | 10,000 | Custom |
| Location history | 30 хоног | 180 хоног | Custom |
| Face verification | Нэмэлт quota | Нэмэлт quota | Contract |
| Reports | Basic | Advanced | Custom |
| API integration | — | Тийм | Тийм |
| Support | Standard | Priority | SLA |

### Usage-based billing үзүүлэлтүүд

- Нийт захиалга
- Face/liveness шалгалтын тоо
- SMS/OTP
- GPS/location хадгалалт
- Storage
- API request
- Active courier

### Subscription төлөв

```
TRIALING → ACTIVE → PAST_DUE → GRACE_PERIOD → SUSPENDED → CANCELLED
```

> Subscription дууссан үед store-ийн өгөгдлийг устгахгүй. Шинэ захиалга болон зарим үйлдлийг хаагаад read-only grace period өгнө.

---

## 15. Functional Requirements (FR)

<details>
<summary><b>🆔 Identity — 5 requirement (дэлгэхийн тулд дар)</b></summary>

| ID | Requirement |
|---|---|
| FR-ID-001 | Courier ДАН/e-Mongolia-аар identity баталгаажуулах боломжтой байна |
| FR-ID-002 | Давхар identity-аар олон courier account үүсгэхээс хамгаална |
| FR-ID-003 | Consent болон баталгаажуулалтын audit хадгална |
| FR-ID-004 | Failed verification retry limit-тэй байна |
| FR-ID-005 | Admin manual review workflow байна |

</details>

<details>
<summary><b>🙂 Face verification — 5 requirement (дэлгэхийн тулд дар)</b></summary>

| ID | Requirement |
|---|---|
| FR-FACE-001 | Камерын permission-г тайлбартай авна |
| FR-FACE-002 | Passive/active liveness шалгана |
| FR-FACE-003 | 1:1 face verification хийнэ |
| FR-FACE-004 | Threshold-оос доош үр дүнг manual review рүү шилжүүлнэ |
| FR-FACE-005 | Provider outage үед барааг шууд олгохгүй, fallback approval ашиглана |

</details>

<details>
<summary><b>🛒 Order — 5 requirement (дэлгэхийн тулд дар)</b></summary>

| ID | Requirement |
|---|---|
| FR-ORD-001 | Store бүтээгдэхүүн, inventory удирдана |
| FR-ORD-002 | Customer cart болон checkout ашиглана |
| FR-ORD-003 | Order status history immutable байна |
| FR-ORD-004 | Inventory payment амжилттай үед баталгаажна |
| FR-ORD-005 | Cancellation болон refund дүрэмтэй байна |

</details>

<details>
<summary><b>🚚 Delivery — 7 requirement (дэлгэхийн тулд дар)</b></summary>

| ID | Requirement |
|---|---|
| FR-DEL-001 | Хүргэлтийн үнийг checkout-оос өмнө тооцно |
| FR-DEL-002 | Courier assign/accept/reject боломжтой байна |
| FR-DEL-003 | Pickup QR нэг удаагийн байна |
| FR-DEL-004 | Pickup evidence хадгална |
| FR-DEL-005 | Active delivery үед GPS tracking ажиллана |
| FR-DEL-006 | Customer OTP/QR-оор delivery баталгаажуулна |
| FR-DEL-007 | Failed delivery болон return workflow байна |

</details>

<details>
<summary><b>💳 Payment — 7 requirement (дэлгэхийн тулд дар)</b></summary>

| ID | Requirement |
|---|---|
| FR-PAY-001 | QPay invoice үүсгэнэ |
| FR-PAY-002 | Callback signature/source болон төлбөрийг server-side шалгана |
| FR-PAY-003 | Давхар callback давхар орлого үүсгэхгүй |
| FR-PAY-004 | Refund бүр order болон ledger-тэй холбоотой байна |
| FR-PAY-005 | Courier earning delivery completion-оос өмнө available болохгүй |
| FR-PAY-006 | Wallet balance-ийг гүйлгээнээс тооцдог байна; шууд засахгүй |
| FR-PAY-007 | Payout бүр approval болон audit trail-тай байна |

</details>

---

## 16. Non-functional Requirements (NFR)

<details>
<summary><b>🔒 Security — 15 зүйл (дэлгэхийн тулд дар)</b></summary>

| # | Requirement |
|---|---|
| 1 | TLS/HTTPS |
| 2 | Argon2id password hashing |
| 3 | HttpOnly secure session cookie |
| 4 | Admin болон payout action-д MFA |
| 5 | RBAC + tenant-level authorization |
| 6 | PostgreSQL Row Level Security |
| 7 | Rate limiting |
| 8 | Device/session management |
| 9 | Secrets manager |
| 10 | Encryption at rest |
| 11 | Immutable audit log |
| 12 | Dependency болон vulnerability scanning |
| 13 | Payment webhook replay protection |
| 14 | Idempotency key |
| 15 | OWASP ASVS шаардлагууд |

</details>

<details>
<summary><b>⚡ Performance — 5 metric (дэлгэхийн тулд дар)</b></summary>

| Metric | Target |
|---|---|
| Энгийн API-ийн p95 | < 500 ms |
| Dashboard p95 load | < 2.5 сек |
| Location update | 5 сек дотор map дээр тусах |
| Payment callback | 30 сек дотор order төлөв шинэчлэх |
| Availability | 99.9% сарын зорилт |

</details>

<details>
<summary><b>🛡️ Reliability — 8 зүйл (дэлгэхийн тулд дар)</b></summary>

| # | Requirement |
|---|---|
| 1 | PostgreSQL automated backup |
| 2 | Point-in-time recovery |
| 3 | Payment reconciliation job |
| 4 | Location offline queue |
| 5 | Retry + dead-letter queue |
| 6 | Monitoring болон alerting |
| 7 | Provider outage fallback |
| 8 | Disaster recovery procedure |

</details>

---

## 17. Техникийн архитектур

MVP-д **TypeScript modular monolith** хамгийн оновчтой:

- Next.js — customer/store/employee applications
- NestJS — API
- PostgreSQL + PostGIS
- Prisma ORM
- Redis
- BullMQ workers
- S3-compatible object storage
- WebSocket/SSE
- MapLibre
- QPay adapter
- Identity adapter
- Face-verification adapter

### Module-ууд

```
Auth · Tenant · Identity · Biometric · Catalog · Inventory · Order
Delivery · Tracking · Pricing · Payment · Ledger · Wallet · Payout
Subscription · Notification · Audit · Fraud · Reporting
```

> Identity, QPay, face provider-ийг шууд business logic дотор бичихгүй, adapter interface-аар тусгаарлана. Provider солигдоход бүх системийг дахин бичихгүй.

---

## 18. PostgreSQL үндсэн хүснэгтүүд

```
tenants, subscription_plans, subscriptions, users, tenant_members, roles, permissions

identity_profiles, identity_verification_sessions, biometric_consents,
face_verification_sessions, trusted_devices

stores, branches, warehouses, products, product_variants,
inventory_items, inventory_movements

customers, customer_addresses, orders, order_items, order_status_history

delivery_zones, delivery_pricing_rules, delivery_quotes,
delivery_assignments, pickup_verifications, handover_evidence,
tracking_sessions, location_points, delivery_attempts

payment_invoices, payment_transactions, refunds, ledger_accounts,
ledger_entries, courier_wallets, payout_requests, bank_accounts

notifications, disputes, attachments, audit_logs, risk_events
```

> Мөнгөний утгыг JavaScript floating number-оор хадгалахгүй:
> - PostgreSQL `numeric`
> - Эсвэл бүх дүнг integer MNT
> - Ledger entry бүр debit/credit тэнцвэртэй байлгана

---

## 19. MVP-ийн бодит хүрээ

### Phase 1 — Foundation
- Multi-tenant SaaS
- 4 actor
- Authentication
- Store/catalog
- Product/order
- Basic subscription
- Audit log

### Phase 2 — Secure delivery
- Courier onboarding
- ДАН/e-Mongolia integration
- Face/liveness provider
- Assignment
- Pickup QR
- Chain-of-custody evidence
- GPS tracking
- Customer OTP delivery confirmation

### Phase 3 — Payment
- QPay invoice
- Payment callback/reconciliation
- Refund
- Internal ledger
- Courier pending/available earnings
- Manual payout approval

### Phase 4 — Scale
- Automated payout
- Advanced fraud detection
- Route optimization
- Dynamic delivery pricing
- Native courier app
- Enterprise SSO/API
- Advanced reporting

---

### Эцсийн MVP хэмжээ (ойролцоо)

- **4** үндсэн actor
- **~60** route/view
- **18** үндсэн backend module
- **40–50** database table
- **3** critical external integration: identity, face/liveness, QPay
- **4** үндсэн баталгаажуулалт: identity, face, pickup, delivery
- **2** санхүүгийн тусдаа систем: payment ба double-entry ledger
