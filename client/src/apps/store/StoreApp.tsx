import { type FormEvent, useEffect, useState } from "react";
import { BrandLogo } from "../../components/BrandLogo";
import { StorePage } from "../../features/store/StorePage";
import { isGmailAddress, isStrongPassword } from "../../shared/validation";

type StoreUser = {
  id: string;
  storeName: string;
  ownerName: string;
  username: string;
  password: string;
};

type AuthMode = "login" | "register";

const usersStorageKey = "deliverhub-store-users";
const sessionStorageKey = "deliverhub-store-session";
const defaultStorePassword = "Zk94387282@";
const defaultStoreNames = [
  "Номин Маркет",
  "Fresh Mart",
  "Pharma Plus",
  "Tech Hub",
  "Golden Bakery",
  "Coffee Corner",
  "Pet Care",
  "Beauty Box",
  "Book Nest",
  "Baby World",
  "Sport Zone",
];

const defaultStoreUsers: StoreUser[] = defaultStoreNames.map((storeName, index) => ({
  id: `Admin${index + 1}`,
  storeName,
  ownerName: `${storeName} admin`,
  username: `Admin${index + 1}`,
  password: defaultStorePassword,
}));

const text = {
  title: "DeliverHub Дэлгүүр",
  registerTitle: "Дэлгүүрийн бүртгэл үүсгэх",
  loginLead: "Нэвтрэх нэр болон нууц үгээ оруулж дэлгүүрийн самбарт нэвтэрнэ.",
  registerLead: "Дэлгүүрийн мэдээллээ бүртгүүлээд дараа нь нэвтрэх хэсгээр орно.",
  heroKicker: "DELIVERHUB",
  heroTitle: "Дэлгүүрийн захиалгын самбар",
  heroCopy: "Захиалга, бараа, орлого болон хүргэлтийн явцыг нэг цэгээс хурдан хяна.",
  signIn: "Нэвтрэх",
  signUp: "Бүртгүүлэх",
  storeName: "Дэлгүүрийн нэр",
  ownerName: "Эзэмшигчийн нэр",
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
  gmailRequired: "Нэвтрэх ID эсвэл Gmail зөв оруулна уу. Жишээ: Admin1 эсвэл name@gmail.com",
  strongPassword: "Нууц үг 8+ тэмдэгттэй, том үсэг, жижиг үсэг, тоо, тусгай тэмдэгт агуулсан байх ёстой.",
  hidePassword: "Нууц үг нуух",
  showPassword: "Нууц үг харуулах",
  storePlaceholder: "Дэлгүүрийн нэр оруулна уу",
  ownerPlaceholder: "Нэрээ оруулна уу",
  usernamePlaceholder: "Admin1",
  passwordPlaceholder: "Нууц үг оруулна уу",
  confirmPlaceholder: "Нууц үгээ давтан оруулна уу",
  copyright: "© 2026 DeliverHub Logistics Inc. Бүх эрх хуулиар хамгаалагдсан.",
};
function readUsers(): StoreUser[] {
  try {
    const raw = localStorage.getItem(usersStorageKey);
    const savedUsers = raw ? (JSON.parse(raw) as StoreUser[]) : [];
    const defaultUsernames = new Set(defaultStoreUsers.map((user) => user.username.toLowerCase()));
    return [
      ...defaultStoreUsers,
      ...savedUsers.filter((user) => !defaultUsernames.has(user.username.toLowerCase())),
    ];
  } catch {
    return defaultStoreUsers;
  }
}

function writeUsers(users: StoreUser[]) {
  localStorage.setItem(usersStorageKey, JSON.stringify(users));
}

function isStoreLoginId(value: string) {
  return /^Admin([1-9]|1[01])$/i.test(value.trim()) || isGmailAddress(value);
}

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

function StoreAuthPage({ onAuthenticated }: { onAuthenticated: (user: StoreUser) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    window.setTimeout(() => {
      try {
        const trimmedUsername = username.trim();
        if (!trimmedUsername || !password.trim() || (mode === "register" && (!storeName.trim() || !ownerName.trim()))) {
          throw new Error(text.required);
        }
        if (!isStoreLoginId(trimmedUsername)) {
          throw new Error(text.gmailRequired);
        }

        const users = readUsers();
        const existingUser = users.find((user) => user.username.toLowerCase() === trimmedUsername.toLowerCase());

        if (mode === "register") {
          if (password !== confirmPassword) {
            throw new Error(text.mismatch);
          }
          if (!isStrongPassword(password)) {
            throw new Error(text.strongPassword);
          }

          if (existingUser) {
            throw new Error(text.exists);
          }

          const nextUser: StoreUser = {
            id: crypto.randomUUID(),
            storeName: storeName.trim(),
            ownerName: ownerName.trim(),
            username: trimmedUsername,
            password,
          };

          writeUsers([...users, nextUser]);
          setMode("login");
          setStoreName("");
          setOwnerName("");
          setPassword("");
          setConfirmPassword("");
          setSuccess(text.success);
          return;
        }

        if (!existingUser) {
          throw new Error(text.notFound);
        }

        if (existingUser.password !== password) {
          throw new Error(text.wrongPassword);
        }

        if (rememberMe) {
          localStorage.setItem(sessionStorageKey, existingUser.id);
        } else {
          sessionStorage.setItem(sessionStorageKey, existingUser.id);
        }
        onAuthenticated(existingUser);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : text.loginError);
      } finally {
        setSubmitting(false);
      }
    }, 260);
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
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-copy">
          <h1>{mode === "login" ? text.title : text.registerTitle}</h1>
          <p>{mode === "login" ? text.loginLead : text.registerLead}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "register" && (
            <>
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
            </>
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
  const [user, setUser] = useState<StoreUser | null>(() => {
    const sessionId = localStorage.getItem(sessionStorageKey) ?? sessionStorage.getItem(sessionStorageKey);
    return readUsers().find((storedUser) => storedUser.id === sessionId) ?? null;
  });

  function handleLogout() {
    localStorage.removeItem(sessionStorageKey);
    sessionStorage.removeItem(sessionStorageKey);
    setUser(null);
  }

  if (!user) {
    return <StoreAuthPage onAuthenticated={setUser} />;
  }

  return <StorePage onLogout={handleLogout} />;
}

export default StoreApp;



