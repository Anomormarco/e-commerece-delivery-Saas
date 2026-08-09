import { type FormEvent, useEffect, useState } from "react";
import { BrandLogo } from "../../components/BrandLogo";
import { AdminPage } from "../../features/admin/AdminPage";
import { getJson, postJson } from "../../shared/api";
import { isGmailAddress, isStrongPassword } from "../../shared/validation";

type AdminUser = {
  id: string;
  username: string;
  fullName: string;
  role: string;
};

type AuthMode = "login" | "register";

const text = {
  loginTitle: "DeliverHub \u0410\u0434\u043C\u0438\u043D",
  registerTitle: "\u0411\u04AF\u0440\u0442\u0433\u044D\u043B \u04AF\u04AF\u0441\u0433\u044D\u0445",
  loginLead: "\u041D\u044D\u0432\u0442\u0440\u044D\u0445 \u043D\u044D\u0440 \u0431\u043E\u043B\u043E\u043D \u043D\u0443\u0443\u0446 \u04AF\u0433\u044D\u044D\u0440 \u043D\u044D\u0432\u0442\u044D\u0440\u043D\u044D.",
  registerLead: "\u0428\u0438\u043D\u044D \u0430\u0434\u043C\u0438\u043D \u0431\u04AF\u0440\u0442\u0433\u044D\u043B\u0438\u0439\u043D \u043C\u044D\u0434\u044D\u044D\u043B\u043B\u044D\u044D \u043E\u0440\u0443\u0443\u043B\u043D\u0430 \u0443\u0443.",
  heroKicker: "DELIVERHUB",
  heroTitle: "\u0425\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u043D \u0445\u044F\u043D\u0430\u043B\u0442\u044B\u043D \u0441\u0430\u043C\u0431\u0430\u0440",
  heroCopy: "\u0414\u044D\u043B\u0433\u04AF\u04AF\u0440, \u0430\u0436\u0438\u043B\u0442\u0430\u043D, \u044D\u0440\u0445 \u0431\u043E\u043B\u043E\u043D \u0445\u04AF\u0440\u0433\u044D\u043B\u0442\u0438\u0439\u043D \u0443\u0440\u0441\u0433\u0430\u043B\u044B\u0433 \u043D\u044D\u0433 \u0434\u044D\u043B\u0433\u044D\u0446\u044D\u044D\u0441 \u0443\u0434\u0438\u0440\u0434.",
  dashboard: "\u0421\u0430\u043C\u0431\u0430\u0440",
  profile: "\u041F\u0440\u043E\u0444\u0430\u0439\u043B",
  signUp: "\u0411\u04AF\u0440\u0442\u0433\u04AF\u04AF\u043B\u044D\u0445",
  signIn: "\u041D\u044D\u0432\u0442\u0440\u044D\u0445",
  name: "\u041D\u044D\u0440",
  username: "Gmail хаяг",
  password: "\u041D\u0443\u0443\u0446 \u04AF\u0433",
  confirmPassword: "\u041D\u0443\u0443\u0446 \u04AF\u0433 \u0434\u0430\u0432\u0442\u0430\u0445",
  remember: "\u041D\u0430\u043C\u0430\u0439\u0433 \u0441\u0430\u043D\u0430\u0445",
  forgot: "\u041D\u0443\u0443\u0446 \u04AF\u0433 \u043C\u0430\u0440\u0442\u0441\u0430\u043D?",
  loginButton: "\u041D\u044D\u0432\u0442\u0440\u044D\u0445",
  registerButton: "\u0411\u04AF\u0440\u0442\u0433\u044D\u043B \u04AF\u04AF\u0441\u0433\u044D\u0445",
  noAccount: "\u0411\u04AF\u0440\u0442\u0433\u044D\u043B\u0433\u04AF\u0439 \u044E\u0443?",
  hasAccount: "\u0411\u04AF\u0440\u0442\u0433\u044D\u043B\u0442\u044D\u0439 \u044E\u0443?",
  wait: "\u0422\u04AF\u0440 \u0445\u04AF\u043B\u044D\u044D\u043D\u044D \u04AF\u04AF...",
  mismatch: "Нууц үг таарахгүй байна",
  gmailRequired: "Gmail хаяг оруулна уу. Жишээ: name@gmail.com",
  strongPassword: "Нууц үг 8+ тэмдэгттэй, том үсэг, жижиг үсэг, тоо, тусгай тэмдэгт агуулсан байх ёстой.",
  success: "\u0411\u04AF\u0440\u0442\u0433\u044D\u043B \u0430\u043C\u0436\u0438\u043B\u0442\u0442\u0430\u0439 \u0431\u043E\u043B\u043B\u043E\u043E",
  loginError: "\u041D\u044D\u0432\u0442\u0440\u044D\u0445\u044D\u0434 \u0430\u043B\u0434\u0430\u0430 \u0433\u0430\u0440\u043B\u0430\u0430",
  checking: "\u041D\u044D\u0432\u0442\u0440\u044D\u043B\u0442\u0438\u0439\u043D \u0442\u04E9\u043B\u04E9\u0432 \u0448\u0430\u043B\u0433\u0430\u0436 \u0431\u0430\u0439\u043D\u0430...",
  hidePassword: "\u041D\u0443\u0443\u0446 \u04AF\u0433 \u043D\u0443\u0443\u0445",
  showPassword: "\u041D\u0443\u0443\u0446 \u04AF\u0433 \u0445\u0430\u0440\u0443\u0443\u043B\u0430\u0445",
  namePlaceholder: "\u041D\u044D\u0440\u044D\u044D \u043E\u0440\u0443\u0443\u043B\u043D\u0430 \u0443\u0443",
  usernamePlaceholder: "name@gmail.com",
  passwordPlaceholder: "\u041D\u0443\u0443\u0446 \u04AF\u0433 \u043E\u0440\u0443\u0443\u043B\u043D\u0430 \u0443\u0443",
  confirmPlaceholder: "\u041D\u0443\u0443\u0446 \u04AF\u0433\u044D\u044D \u0434\u0430\u0432\u0442\u0430\u043D \u043E\u0440\u0443\u0443\u043B\u043D\u0430 \u0443\u0443",
  copyright: "\u00A9 2026 DeliverHub Logistics Inc. \u0411\u04AF\u0445 \u044D\u0440\u0445 \u0445\u0443\u0443\u043B\u0438\u0430\u0440 \u0445\u0430\u043C\u0433\u0430\u0430\u043B\u0430\u0433\u0434\u0441\u0430\u043D.",
};

function AuthIcon({ type }: { type: "user" | "name" | "lock" | "eye" | "eyeOff" }) {
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

function AdminAuthPage({ onAuthenticated }: { onAuthenticated: (user: AdminUser) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
    setSuccess(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === "register") {
        if (!isGmailAddress(username)) {
          throw new Error(text.gmailRequired);
        }
        if (!isStrongPassword(password)) {
          throw new Error(text.strongPassword);
        }
        if (password !== confirmPassword) {
          throw new Error(text.mismatch);
        }

        await postJson<{ user: AdminUser }>("/auth/register", { fullName, username, password });
        setMode("login");
        setFullName("");
        setPassword("");
        setConfirmPassword("");
        setSuccess(text.success);
        return;
      }

      if (!isGmailAddress(username)) {
        throw new Error(text.gmailRequired);
      }
      const result = await postJson<{ user: AdminUser }>("/auth/login", { username, password });
      onAuthenticated(result.user);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : text.loginError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-auth-page">
      <nav className="auth-floating-nav">
        <BrandLogo showText size={32} />
        <button type="button">
          <span aria-hidden="true">▦</span>
          {text.dashboard}
        </button>
        <button type="button">
          <span aria-hidden="true">◎</span>
          {text.profile}
        </button>
        <button className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")} type="button">
          {text.signIn}
        </button>
        <button className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")} type="button">
          {text.signUp}
        </button>
        <button className="auth-download-button" type="button">FREE DOWNLOAD</button>
      </nav>

      <section className="auth-visual">
        <div>
          <span>INSPIRED BY THE FUTURE:</span>
          <h1>THE VISION UI DASHBOARD</h1>
          <p>{text.heroCopy}</p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-copy">
          <h1>{mode === "login" ? text.loginTitle : text.registerTitle}</h1>
          <p>{mode === "login" ? text.loginLead : text.registerLead}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "register" && (
            <label>
              {text.name}
              <span className="auth-input-wrap">
                <AuthIcon type="name" />
                <input autoComplete="name" onChange={(event) => setFullName(event.target.value)} placeholder={text.namePlaceholder} required value={fullName} />
              </span>
            </label>
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
        <div className="auth-footer-links">
          <button type="button">Marketplace</button>
          <button type="button">Blog</button>
          <button type="button">License</button>
        </div>
      </section>
    </main>
  );
}

export function AdminApp() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    getJson<{ user: AdminUser }>("/auth/me")
      .then((result) => setUser(result.user))
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false));
  }, []);

  if (checkingSession) {
    return (
      <main className="admin-auth-page">
        <div className="state-card auth-loading">{text.checking}</div>
      </main>
    );
  }

  if (!user) {
    return <AdminAuthPage onAuthenticated={setUser} />;
  }

  async function handleLogout() {
    await postJson<{ ok?: boolean }>("/auth/logout").catch(() => null);
    setUser(null);
  }

  return <AdminPage onLogout={handleLogout} onUserChange={setUser} user={user} />;
}

export default AdminApp;
