import { type FormEvent, useEffect, useState } from "react";
import { BrandLogo } from "../../components/BrandLogo";
import { StorePage } from "../../features/store/StorePage";
import { clearAccessToken, postJson, saveAccessToken } from "../../shared/api";
import { isEmailAddress, isStrongPassword } from "../../shared/validation";

type StoreIdentity = {
  id: string;
  storeName: string;
};

type StoreAuthResponse = {
  userId: string;
  tenantId: string;
  accessToken: string;
  store: { id: string; name: string } | null;
};

type AuthMode = "login" | "register";

const sessionProfileStorageKey = "deliverhub-store-session-profile";
const accessTokenStorageKey = "deliverhub-store-access-token";

function isStorePhone(value: string) {
  return /^\+?\d{8,15}$/.test(value.trim());
}

function readSessionProfile(): StoreIdentity | null {
  try {
    const hasToken = Boolean(localStorage.getItem(accessTokenStorageKey) ?? sessionStorage.getItem(accessTokenStorageKey));
    if (!hasToken) return null;
    const raw = localStorage.getItem(sessionProfileStorageKey) ?? sessionStorage.getItem(sessionProfileStorageKey);
    return raw ? (JSON.parse(raw) as StoreIdentity) : null;
  } catch {
    return null;
  }
}

function saveSessionProfile(profile: StoreIdentity, remember: boolean) {
  const raw = JSON.stringify(profile);
  if (remember) {
    localStorage.setItem(sessionProfileStorageKey, raw);
    sessionStorage.removeItem(sessionProfileStorageKey);
  } else {
    sessionStorage.setItem(sessionProfileStorageKey, raw);
    localStorage.removeItem(sessionProfileStorageKey);
  }
}

function clearSessionProfile() {
  localStorage.removeItem(sessionProfileStorageKey);
  sessionStorage.removeItem(sessionProfileStorageKey);
}

const text = {
  title: "DeliverHub Дэлгүүр",
  registerTitle: "Дэлгүүрийн бүртгэл үүсгэх",
  loginLead: "Нэвтрэх нэр болон нууц үгээ оруулж дэлгүүрийн самбарт нэвтэрнэ.",
  registerLead: "Дэлгүүрийн мэдээллээ бүртгүүлээд дараа нь нэвтрэх хэсгээр орно.",
  heroKicker: "DELIVERHUB STORE",
  heroTitle: "STORE DASHBOARD",
  heroCopy: "Marketplace, бараа, захиалга, орлого болон хүргэлтийн workflow-г нэг самбараас удирдана.",
  signIn: "Нэвтрэх",
  signUp: "Бүртгүүлэх",
  storeName: "Дэлгүүрийн нэр",
  ownerName: "Эзэмшигчийн нэр",
  logoUrl: "Logo URL",
  address: "Хаяг",
  phone: "Утасны дугаар",
  storeType: "Дэлгүүрийн төрөл",
  searchableFeature: "Хайгдах онцлог",
  username: "Нэвтрэх ID",
  password: "Нууц үг",
  confirmPassword: "Нууц үг давтах",
  remember: "Намайг санах",
  forgot: "Нууц үг мартсан?",
  loginButton: "Нэвтрэх",
  registerButton: "Бүртгэл үүсгэх",
  noAccount: "Бүртгэлгүй юу?",
  hasAccount: "Бүртгэлтэй юу?",
  wait: "Түр хүлээнэ үү...",
  mismatch: "Нууц үг таарахгүй байна",
  success: "Бүртгэл амжилттай боллоо",
  required: "Бүх талбарыг бөглөнө үү",
  exists: "Энэ нэвтрэх нэр бүртгэлтэй байна",
  notFound: "Бүртгэл олдсонгүй",
  wrongPassword: "Нууц үг буруу байна",
  loginError: "Нэвтрэхэд алдаа гарлаа",
  gmailRequired: "Нэвтрэх ID утасны дугаар эсвэл имэйл хаяг байх ёстой. Жишээ: 99112233 эсвэл name@company.mn",
  strongPassword: "Нууц үг 8+ тэмдэгттэй, том үсэг, жижиг үсэг, тоо, тусгай тэмдэгт агуулсан байх ёстой.",
  hidePassword: "Нууц үг нуух",
  showPassword: "Нууц үг харуулах",
  storePlaceholder: "Дэлгүүрийн нэр оруулна уу",
  ownerPlaceholder: "Нэрээ оруулна уу",
  logoPlaceholder: "https://...",
  addressPlaceholder: "Дэлгүүрийн байршил",
  phonePlaceholder: "99112233",
  storeTypePlaceholder: "Жишээ: хүнс, эм, хувцас",
  searchableFeaturePlaceholder: "Жишээ: organic, 24/7, premium",
  usernamePlaceholder: "name@company.mn эсвэл 99112233",
  passwordPlaceholder: "Нууц үг оруулна уу",
  confirmPlaceholder: "Нууц үгээ давтан оруулна уу",
  copyright: "© 2026 DeliverHub Logistics Inc. Бүх эрх хуулиар хамгаалагдсан.",
};
function AuthIcon({ type }: { type: "store" | "user" | "name" | "lock" | "eye" | "eyeOff" }) {
  if (type === "store") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 10h16l-1.2-5.5H5.2z" />
        <path d="M6 10v9h12v-9" />
        <path d="M9 19v-5h6v5" />
      </svg>
    );
  }

  if (type === "name") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
        <path d="M8 9h8M8 13h5" />
      </svg>
    );
  }

  if (type === "lock") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect height="10" rx="2" width="14" x="5" y="10" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        <path d="M12 14v2" />
      </svg>
    );
  }

  if (type === "eye" || type === "eyeOff") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
        <circle cx="12" cy="12" r="2.5" />
        {type === "eyeOff" && <path d="M4 4l16 16" />}
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

function StoreAuthPage({ onAuthenticated }: { onAuthenticated: (identity: StoreIdentity) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [storeType, setStoreType] = useState("");
  const [searchableFeature, setSearchableFeature] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!success) return;
    const timeoutId = window.setTimeout(() => setSuccess(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [success]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const trimmedUsername = username.trim();
      if (
        !trimmedUsername
        || !password.trim()
        || (mode === "register" && (
          !storeName.trim()
          || !ownerName.trim()
          || !address.trim()
          || !phone.trim()
          || !storeType.trim()
          || !searchableFeature.trim()
        ))
      ) {
        throw new Error(text.required);
      }
      if (!isEmailAddress(trimmedUsername) && !isStorePhone(trimmedUsername)) {
        throw new Error(text.gmailRequired);
      }

      if (mode === "register") {
        if (password !== confirmPassword) {
          throw new Error(text.mismatch);
        }
        if (!isStrongPassword(password)) {
          throw new Error(text.strongPassword);
        }

        await postJson<StoreAuthResponse>("/auth/register", {
          storeName: storeName.trim(),
          ownerName: ownerName.trim(),
          username: trimmedUsername,
          password,
          address: address.trim(),
          phone: phone.trim(),
          storeType: storeType.trim(),
          searchableFeature: searchableFeature.trim(),
        });

        setMode("login");
        setStoreName("");
        setOwnerName("");
        setLogoUrl("");
        setAddress("");
        setPhone("");
        setStoreType("");
        setSearchableFeature("");
        setPassword("");
        setConfirmPassword("");
        setSuccess(text.success);
        return;
      }

      const response = await postJson<StoreAuthResponse>("/auth/login", {
        username: trimmedUsername,
        password,
      });

      saveAccessToken(response.accessToken, rememberMe);
      const identity: StoreIdentity = {
        id: response.store?.id ?? response.userId,
        storeName: response.store?.name ?? trimmedUsername,
      };
      saveSessionProfile(identity, rememberMe);
      onAuthenticated(identity);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : text.loginError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-auth-page store-auth-page">
      <nav className="auth-floating-nav">
        <BrandLogo showText size={32} />
        <button className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")} type="button">
          {text.signIn}
        </button>
        <button className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")} type="button">
          {text.signUp}
        </button>
      </nav>

      <section className="auth-visual">
        <div>
          <span>{text.heroKicker}</span>
          <h1>{text.heroTitle}</h1>
          <p>{text.heroCopy}</p>
          <div className="store-auth-info-grid" aria-hidden="true">
            <article><strong>01</strong><small>Marketplace дээр төрөл, онцлогоор хайгдана.</small></article>
            <article><strong>02</strong><small>Захиалга, бараа, орлого нэг самбарт орно.</small></article>
            <article><strong>03</strong><small>Courier assignment болон notification realtime.</small></article>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-copy">
          <h1>{mode === "login" ? text.title : text.registerTitle}</h1>
          <p>{mode === "login" ? text.loginLead : text.registerLead}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "register" && (
            <div className="store-register-grid">
              <label>
                {text.storeName}
                <span className="auth-input-wrap">
                  <AuthIcon type="store" />
                  <input autoComplete="organization" onChange={(event) => setStoreName(event.target.value)} placeholder={text.storePlaceholder} required value={storeName} />
                </span>
              </label>

              <label>
                {text.ownerName}
                <span className="auth-input-wrap">
                  <AuthIcon type="name" />
                  <input autoComplete="name" onChange={(event) => setOwnerName(event.target.value)} placeholder={text.ownerPlaceholder} required value={ownerName} />
                </span>
              </label>

              <label>
                {text.logoUrl}
                <span className="auth-input-wrap">
                  <AuthIcon type="store" />
                  <input autoComplete="url" onChange={(event) => setLogoUrl(event.target.value)} placeholder={text.logoPlaceholder} value={logoUrl} />
                </span>
              </label>

              <label>
                {text.address}
                <span className="auth-input-wrap">
                  <AuthIcon type="name" />
                  <input autoComplete="street-address" onChange={(event) => setAddress(event.target.value)} placeholder={text.addressPlaceholder} required value={address} />
                </span>
              </label>

              <label>
                {text.phone}
                <span className="auth-input-wrap">
                  <AuthIcon type="user" />
                  <input autoComplete="tel" onChange={(event) => setPhone(event.target.value)} placeholder={text.phonePlaceholder} required value={phone} />
                </span>
              </label>

              <label>
                {text.storeType}
                <span className="auth-input-wrap">
                  <AuthIcon type="store" />
                  <input onChange={(event) => setStoreType(event.target.value)} placeholder={text.storeTypePlaceholder} required value={storeType} />
                </span>
              </label>

              <label>
                {text.searchableFeature}
                <span className="auth-input-wrap">
                  <AuthIcon type="name" />
                  <input onChange={(event) => setSearchableFeature(event.target.value)} placeholder={text.searchableFeaturePlaceholder} required value={searchableFeature} />
                </span>
              </label>
            </div>
          )}

          <label>
            {text.username}
            <span className="auth-input-wrap">
              <AuthIcon type="user" />
              <input autoComplete="username" onChange={(event) => setUsername(event.target.value)} placeholder={text.usernamePlaceholder} required value={username} />
            </span>
          </label>

          <label>
            {text.password}
            <span className="auth-input-wrap">
              <AuthIcon type="lock" />
              <input
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={text.passwordPlaceholder}
                required
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? text.hidePassword : text.showPassword}
                className="password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                type="button"
              >
                <AuthIcon type={showPassword ? "eyeOff" : "eye"} />
              </button>
            </span>
          </label>

          {mode === "register" && (
            <label>
              {text.confirmPassword}
              <span className="auth-input-wrap">
                <AuthIcon type="lock" />
                <input
                  autoComplete="new-password"
                  minLength={8}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder={text.confirmPlaceholder}
                  required
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                />
              </span>
            </label>
          )}

          {mode === "login" && (
            <div className="auth-options">
              <label className="remember-option">
                <input checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} type="checkbox" />
                {text.remember}
              </label>
              <button className="forgot-button" type="button">
                {text.forgot}
              </button>
            </div>
          )}

          {success && <div className="auth-success">{success}</div>}
          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" disabled={submitting} type="submit">
            {submitting ? text.wait : mode === "login" ? text.loginButton : text.registerButton}
          </button>

          <button className="auth-secondary-action" onClick={() => switchMode(mode === "login" ? "register" : "login")} type="button">
            {mode === "login" ? `${text.noAccount} ${text.signUp}` : `${text.hasAccount} ${text.signIn}`}
          </button>
        </form>

        <p className="auth-footnote">{text.copyright}</p>
      </section>
    </main>
  );
}

export function StoreApp() {
  const [identity, setIdentity] = useState<StoreIdentity | null>(() => readSessionProfile());

  function handleLogout() {
    clearAccessToken();
    clearSessionProfile();
    setIdentity(null);
  }

  if (!identity) {
    return <StoreAuthPage onAuthenticated={setIdentity} />;
  }

  return <StorePage onLogout={handleLogout} store={identity} />;
}

export default StoreApp;



