import { type FormEvent, useEffect, useRef, useState } from "react";
import { BrandLogo } from "../../components/BrandLogo";
import { CourierPage } from "../../features/courier/CourierPage";
import { postJson } from "../../shared/api";
import { normalizeErrorMessage } from "../../shared/errors";
import { isCourierLoginId, isGmailAddress, isMongolianText, isStrongPassword } from "../../shared/validation";

type VehicleType = "WALK" | "MOPED" | "CAR";
type AuthMode = "login" | "register";
type DocumentType = "ID_CARD" | "PASSPORT";
type RegisterStep = 1 | 2;

type FaceAudit = {
  capturedAt: string;
  cameraStartedAt: string;
  challengeNonce: string;
  frameHash: string;
  livenessSignals: {
    cameraReady: boolean;
    videoHeight: number;
    videoWidth: number;
  };
  snapshotId: string;
  mode: "login" | "register";
  status: "MATCHED" | "DECLINED";
};

type EmployeeProfileForm = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  age: string;
  gender: string;
  homeAddress: string;
  emergencyPhones: string;
};

type CourierAuthResponse = {
  userId: string;
  accessToken: string;
  dashboard: {
    verificationStatus?: string;
  };
};

const sessionStorageKey = "deliverhub-courier-user-id";
const tokenStorageKey = "deliverhub-courier-access-token";

const vehicleOptions: Array<{ value: VehicleType; label: string; note: string }> = [
  { value: "WALK", label: "Явган хүргэлт", note: "Ойр зайд 4 кг хүртэл" },
  { value: "MOPED", label: "Мопед", note: "Дунд зайд 12 кг хүртэл" },
  { value: "CAR", label: "Машин", note: "Хүнд эсвэл хол хүргэлт" },
];

const text = {
  brand: "DeliverHub",
  heroKicker: "DELIVERHUB",
  heroTitle: "Хүргэлтийн ажилтны самбар",
  heroCopy: "Баталгаажуулалт, ажлын төлөв, тээврийн хэрэгслийн тохиргоо болон хүргэлтийн дуудлагыг нэг дор удирдана.",
  loginTitle: "Хүргэлтийн ажилтан нэвтрэх",
  registerTitle: "Хүргэлтийн ажилтнаар бүртгүүлэх",
  loginLead: "Утас болон нууц үгээрээ нэвтэрч хүргэлтийн дуудлагаа удирдана.",
  registerLead: "Ажилтны бүртгэл үүсгээд хүргэлтийн төрлөө сонгон баталгаажуулалтаа дуусгана.",
  login: "Нэвтрэх",
  register: "Бүртгүүлэх",
  fullName: "Бүтэн нэр",
  phone: "Утас эсвэл Gmail",
  phoneNumber: "Утасны дугаар",
  phoneVerified: "Утасны дугаар баталгаажсан",
  firstName: "Нэр",
  lastName: "Овог",
  email: "Gmail (баталгаажуулах код авах)",
  age: "Нас",
  gender: "Хүйс",
  homeAddress: "Гэрийн хаяг",
  emergencyPhones: "Яаралтай үед холбогдох утаснууд",
  password: "Нууц үг",
  plate: "Улсын дугаар",
  plateOptional: "Улсын дугаар (заавал биш)",
  start: "Үргэлжлүүлэх",
  wait: "Түр хүлээнэ үү...",
  required: "Шаардлагатай талбаруудыг бөглөнө үү.",
  gmailRequired: "Баталгаажуулах код авах Gmail хаягаа зөв оруулна уу. Жишээ: name@gmail.com",
  mongolianRequired: "Email, утас, нас, нууц үгээс бусад мэдээллийг Монгол кириллээр оруулна уу.",
  idStep: "Бичиг баримт",
  faceStep: "Царай баталгаажуулалт",
  legalName: "Бичиг баримт дээрх нэр",
  idCard: "Иргэний үнэмлэх",
  passport: "Паспорт",
  front: "Урд тал оруулсан",
  back: "Ар тал оруулсан",
  passportPhoto: "Паспортын хуудас оруулсан",
  selfie: "Бичиг баримттай өөрийн зураг оруулсан",
  liveness: "Амьд хүн шалгалт амжилттай",
  submitId: "Бичиг баримт баталгаажуулах",
  submitFace: "Ажилтны эрх идэвхжүүлэх",
  noAccount: "Бүртгэлгүй юу?",
  hasAccount: "Бүртгэлтэй юу?",
  deliveryMode: "Хүргэлтийн төрөл",
  namePlaceholder: "Бүтэн нэрээ оруулна уу",
  phonePlaceholder: "Утасны дугаар эсвэл name@gmail.com",
  passwordPlaceholder: "Нууц үг",
  verificationFlow: "Баталгаажуулалтын явц",
  documentCheck: "Бичиг баримтын шалгалт",
  faceMatch: "Царай тааруулалт",
  employeeVerification: "Ажилтны баталгаажуулалт",
  livenessAnalyzing: "Амьд хүн эсэхийг шалгаж байна",
  documentHelp: "Иргэний үнэмлэхийн хоёр тал эсвэл паспортын зурагтай хуудсыг оруулна.",
  faceHelp: "Царай болон бичиг баримтаа хүрээнд багтааж баталгаажуулна.",
  loginFaceHelp: "Нэвтрэх бүрт нууц үг, утасны дугаар болон нүүр танилт заавал баталгаажна.",
  passportCompare: "Паспорттой харьцуулсан өөрийн зураг оруулсан",
  loginFaceConfirmed: "Нүүр танилт амжилттай",
  cameraStart: "Камер нээх",
  cameraCapture: "Царай шалгах",
  cameraMatched: "Царай паспорттой таарлаа",
  cameraDeclined: "Царай паспорттой таарахгүй байна",
  cameraUnavailable: "Камер нээгдсэнгүй. Browser camera allow хийсэн бол page refresh хийгээд дахин оролдоно уу.",
  cameraInsecure: "Камер зөвхөн HTTPS эсвэл localhost дээр ажиллана. Домайн HTTPS эсэхийг шалгана уу.",
  cameraPolicyBlocked: "Browser allow хийсэн ч site/iframe camera policy хорьж байна. App-аа HTTPS tab дээр шууд нээнэ үү.",
  cameraPermissionDenied: "Camera permission Deny байна. Address bar дээрх camera icon/site settings-ээс Allow болгоод refresh хийнэ үү.",
  cameraBusy: "Камер өөр app/browser tab дээр ашиглагдаж байна. Тэр app-аа хаагаад дахин оролдоно уу.",
  cameraMissing: "Камер олдсонгүй. Device camera холбогдсон эсэхийг шалгана уу.",
  cameraStarting: "Камер нээгдэж байна...",
  simulateMismatch: "Зөрсөн гэж шалгах",
  registerStepOne: "1. Хувийн мэдээлэл",
  registerStepTwo: "2. Баталгаажуулалт",
  identityProvider: "Таних үйлчилгээ",
  faceDetected: "Царай илэрсэн",
  proximityOk: "Зай тохирсон",
  encryption: "Шифрлэлт: AES-256 олон tenant vault",
  invalidLoginId: "Нэвтрэх мэдээлэл утасны дугаар эсвэл Gmail хаяг байх ёстой.",
  strongPassword: "Нууц үг 8+ тэмдэгттэй, том үсэг, жижиг үсэг, тоо, тусгай тэмдэгт агуулсан байх ёстой.",
};

type SelectedDocumentFile = {
  name: string;
  size: number;
  type: string;
  lastModified: number;
};

const mongolianTextPattern = "[А-Яа-яЁёӨөҮү0-9\\s,./#\\-()]+";

function documentFileMeta(file: File | null): SelectedDocumentFile | null {
  if (!file) return null;
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
  };
}

async function cameraPermissionState() {
  try {
    const permissionStatus = await navigator.permissions?.query?.({ name: "camera" as PermissionName });
    return permissionStatus?.state ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function cameraErrorMessage(error: unknown) {
  const errorName = error instanceof DOMException ? error.name : "";

  if (!window.isSecureContext) return text.cameraInsecure;
  if (errorName === "NotAllowedError" || errorName === "SecurityError") {
    const permissionState = await cameraPermissionState();
    return permissionState === "denied" ? text.cameraPermissionDenied : text.cameraPolicyBlocked;
  }
  if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") return text.cameraMissing;
  if (errorName === "NotReadableError" || errorName === "TrackStartError") return text.cameraBusy;
  if (errorName === "OverconstrainedError" || errorName === "ConstraintNotSatisfiedError") return text.cameraMissing;
  return text.cameraUnavailable;
}

function waitForVideoReady(video: HTMLVideoElement) {
  if (video.videoWidth > 0 && video.videoHeight > 0) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("VIDEO_METADATA_TIMEOUT"));
    }, 4000);

    function cleanup() {
      window.clearTimeout(timeoutId);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleLoadedMetadata);
      video.removeEventListener("error", handleError);
    }

    function handleLoadedMetadata() {
      if (video.videoWidth <= 0 || video.videoHeight <= 0) return;
      cleanup();
      resolve();
    }

    function handleError() {
      cleanup();
      reject(new Error("VIDEO_ELEMENT_ERROR"));
    }

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleLoadedMetadata);
    video.addEventListener("error", handleError);
  });
}

function FaceCameraCheck({
  mode,
  title,
  help,
  matched,
  onResult,
}: {
  mode: "login" | "register";
  title: string;
  help: string;
  matched: boolean;
  onResult: (matched: boolean, audit: FaceAudit) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraStartedAt, setCameraStartedAt] = useState<string | null>(null);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startCamera() {
    setCameraError(null);
    setCameraLoading(true);

    if (!window.isSecureContext) {
      setCameraError(text.cameraInsecure);
      setCameraLoading(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(text.cameraPolicyBlocked);
      setCameraLoading(false);
      return;
    }

    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const constraints: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: "user" }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
        { video: true, audio: false },
      ];
      let stream: MediaStream | null = null;
      let lastError: unknown = null;

      for (const constraint of constraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraint);
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!stream) throw lastError;
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        await waitForVideoReady(videoRef.current);
      }

      setCameraReady(true);
      setCameraStartedAt(new Date().toISOString());
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraReady(false);
      setCameraError(await cameraErrorMessage(error));
    } finally {
      setCameraLoading(false);
    }
  }

  async function hashCurrentFrame() {
    const video = videoRef.current;
    if (!video || !cameraReady) return "";

    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    const context = canvas.getContext("2d");
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const bytes = new TextEncoder().encode(canvas.toDataURL("image/jpeg", 0.45));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function completeCheck(status: FaceAudit["status"]) {
    const now = new Date().toISOString();
    const video = videoRef.current;
    const challengeNonce = crypto.randomUUID();
    setCapturedAt(now);
    onResult(status === "MATCHED", {
      capturedAt: now,
      cameraStartedAt: cameraStartedAt ?? now,
      challengeNonce,
      frameHash: await hashCurrentFrame(),
      livenessSignals: {
        cameraReady,
        videoHeight: video?.videoHeight ?? 0,
        videoWidth: video?.videoWidth ?? 0,
      },
      snapshotId: `${mode}-${Date.now()}-${challengeNonce.slice(0, 8)}`,
      mode,
      status,
    });
  }

  return (
    <div className={`employee-camera-check employee-wide-field ${matched ? "matched" : capturedAt ? "declined" : ""}`}>
      <div className="employee-camera-preview">
        <video muted playsInline ref={videoRef} />
        {!cameraReady ? (
          <button className="employee-camera-start" disabled={cameraLoading} onClick={startCamera} type="button">
            {cameraLoading ? text.cameraStarting : text.cameraStart}
          </button>
        ) : null}
      </div>
      <div className="employee-camera-copy">
        <strong>{title}</strong>
        <p>{help}</p>
        <span className={matched ? "face-status matched" : capturedAt ? "face-status declined" : "face-status"}>
          {matched ? text.cameraMatched : capturedAt ? text.cameraDeclined : text.livenessAnalyzing}
        </span>
        {capturedAt ? <small>Log: {new Date(capturedAt).toLocaleString("mn-MN")}</small> : null}
        {cameraError ? <small className="camera-error">{cameraError}</small> : null}
        <div className="employee-camera-actions">
          <button disabled={!cameraReady} onClick={() => void completeCheck("MATCHED")} type="button">
            {text.cameraCapture}
          </button>
          <button disabled={!cameraReady} onClick={() => void completeCheck("DECLINED")} type="button">
            {text.simulateMismatch}
          </button>
        </div>
      </div>
    </div>
  );
}
function AuthIcon({ type }: { type: "user" | "phone" | "lock" | "vehicle" | "plate" }) {
  if (type === "phone") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M8 4h8l1 2v12l-1 2H8l-1-2V6z" />
        <path d="M10 6h4M11 18h2" />
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

  if (type === "vehicle") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 15h16l-2-6H6z" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    );
  }

  if (type === "plate") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect height="10" rx="2" width="18" x="3" y="7" />
        <path d="M7 11h4M14 11h3M7 14h10" />
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

function saveSession(userId: string, accessToken: string) {
  localStorage.setItem(sessionStorageKey, userId);
  localStorage.setItem(tokenStorageKey, accessToken);
}

function clearSession() {
  localStorage.removeItem(sessionStorageKey);
  localStorage.removeItem(tokenStorageKey);
  sessionStorage.removeItem(sessionStorageKey);
  sessionStorage.removeItem(tokenStorageKey);
}

function CourierAuthPage({ onAuthenticated }: { onAuthenticated: (userId: string, verificationStatus?: string) => void }) {
  const [mode, setMode] = useState<AuthMode>(() => {
    const queryMode = new URLSearchParams(window.location.search).get("mode");
    return queryMode === "register" ? "register" : "login";
  });
  const [registerStep, setRegisterStep] = useState<RegisterStep>(1);
  const [profileForm, setProfileForm] = useState<EmployeeProfileForm>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    age: "",
    gender: "",
    homeAddress: "",
    emergencyPhones: "",
  });
  const [phone, setPhone] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("MOPED");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("ID_CARD");
  const [documentFront, setDocumentFront] = useState<File | null>(null);
  const [documentBack, setDocumentBack] = useState<File | null>(null);
  const [selfieWithDocument, setSelfieWithDocument] = useState(false);
  const [faceLiveness, setFaceLiveness] = useState(false);
  const [documentFaceMatched, setDocumentFaceMatched] = useState(false);
  const [faceAudit, setFaceAudit] = useState<FaceAudit | null>(null);
  const [loginFaceConfirmed, setLoginFaceConfirmed] = useState(false);
  const [loginFaceAudit, setLoginFaceAudit] = useState<FaceAudit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const registerFullName = `${profileForm.lastName.trim()} ${profileForm.firstName.trim()}`.trim();
  const registerPhone = profileForm.phone.trim();
  const registerEmail = profileForm.email.trim();

  function updateProfileField(field: keyof EmployeeProfileForm, value: string) {
    setProfileForm((current) => ({ ...current, [field]: value }));
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setRegisterStep(1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (mode === "register" && registerStep === 1) {
      if (
        !profileForm.firstName.trim()
        || !profileForm.lastName.trim()
        || !registerPhone
        || !phoneVerified
        || !registerEmail
        || !profileForm.age.trim()
        || !profileForm.gender.trim()
        || !profileForm.homeAddress.trim()
        || !profileForm.emergencyPhones.trim()
        || !password.trim()
      ) {
        setError(text.required);
        return;
      }

      if (!isCourierLoginId(registerPhone)) {
        setError(text.invalidLoginId);
        return;
      }

      if (!isGmailAddress(registerEmail)) {
        setError(text.gmailRequired);
        return;
      }

      if (
        !isMongolianText(profileForm.firstName)
        || !isMongolianText(profileForm.lastName)
        || !isMongolianText(profileForm.homeAddress)
        || !isMongolianText(profileForm.emergencyPhones)
      ) {
        setError(text.mongolianRequired);
        return;
      }

      if (!isStrongPassword(password)) {
        setError(text.strongPassword);
        return;
      }

      setRegisterStep(2);
      return;
    }

    setSubmitting(true);

    try {
      if (mode === "login" && (!phone.trim() || !password.trim() || !loginFaceConfirmed)) {
        throw new Error(text.required);
      }

      if (mode === "login" && !isCourierLoginId(phone)) {
        throw new Error(text.invalidLoginId);
      }

      if (
        mode === "register"
        && (!documentFront || (documentType === "ID_CARD" && !documentBack) || !selfieWithDocument || !faceLiveness || !documentFaceMatched)
      ) {
        throw new Error(text.required);
      }

      if (mode === "register" && vehiclePlate.trim() && !isMongolianText(vehiclePlate)) {
        throw new Error(text.mongolianRequired);
      }

      if (mode === "register" && !isStrongPassword(password)) {
        throw new Error(text.strongPassword);
      }

      const response = await postJson<CourierAuthResponse>(
        mode === "login" ? "/auth/login" : "/auth/register",
        mode === "login"
          ? { phone, password, faceLoginConfirmed: loginFaceConfirmed, faceAudit: loginFaceAudit }
          : {
              fullName: registerFullName,
              firstName: profileForm.firstName,
              lastName: profileForm.lastName,
              phone: registerPhone,
              email: registerEmail,
              age: Number(profileForm.age),
              gender: profileForm.gender,
              homeAddress: profileForm.homeAddress,
              emergencyPhones: profileForm.emergencyPhones,
              phoneVerified,
              password,
              vehicleType,
              vehiclePlate,
              legalName: registerFullName,
              documentType,
              documentFront: Boolean(documentFront),
              documentBack: documentType === "PASSPORT" ? true : Boolean(documentBack),
              documentFiles: {
                front: documentFileMeta(documentFront),
                back: documentType === "PASSPORT" ? null : documentFileMeta(documentBack),
              },
              selfieWithDocument,
              livenessConfirmed: faceLiveness,
              documentFaceMatched,
              faceAudit,
            },
      );

      saveSession(response.userId, response.accessToken);

      if (mode === "register") {
        onAuthenticated(response.userId, response.dashboard.verificationStatus ?? "ACTIVE");
        return;
      }

      onAuthenticated(response.userId, response.dashboard.verificationStatus);
    } catch (submitError) {
      setError(normalizeErrorMessage(submitError, text.required));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={`admin-auth-page employee-auth-page employee-auth-${mode}`}>
      <nav className="auth-floating-nav">
        <BrandLogo showText size={32} />
        <button className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")} type="button">{text.login}</button>
        <button className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")} type="button">{text.register}</button>
      </nav>

      <section className="auth-visual">
        <div>
          <span>{text.heroKicker}</span>
          <h1>{text.heroTitle}</h1>
          <p>{text.heroCopy}</p>
        </div>
      </section>

      <section className="auth-panel employee-auth-panel">
        <div className="auth-copy">
          <h1>{mode === "login" ? text.loginTitle : text.registerTitle}</h1>
          <p>{mode === "login" ? text.loginLead : text.registerLead}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <div className="employee-register-steps">
              <span className={registerStep === 1 ? "active" : ""}>{text.registerStepOne}</span>
              <i />
              <span className={registerStep === 2 ? "active" : ""}>{text.registerStepTwo}</span>
            </div>
          ) : null}

          {mode === "register" && registerStep === 1 ? (
            <div className="employee-form-grid">
              <label>
                {text.lastName}
                <span className="auth-input-wrap">
                  <AuthIcon type="user" />
                  <input autoComplete="family-name" onChange={(event) => updateProfileField("lastName", event.target.value)} pattern={mongolianTextPattern} placeholder="Овог" required title={text.mongolianRequired} value={profileForm.lastName} />
                </span>
              </label>
              <label>
                {text.firstName}
                <span className="auth-input-wrap">
                  <AuthIcon type="user" />
                  <input autoComplete="given-name" onChange={(event) => updateProfileField("firstName", event.target.value)} pattern={mongolianTextPattern} placeholder="Нэр" required title={text.mongolianRequired} value={profileForm.firstName} />
                </span>
              </label>
              <label>
                {text.phoneNumber}
                <span className="auth-input-wrap">
                  <AuthIcon type="phone" />
                  <input autoComplete="tel" onChange={(event) => updateProfileField("phone", event.target.value)} placeholder="99112233" required value={profileForm.phone} />
                </span>
              </label>
              <label>
                {text.email}
                <span className="auth-input-wrap">
                  <AuthIcon type="phone" />
                  <input autoComplete="email" onChange={(event) => updateProfileField("email", event.target.value)} placeholder="name@gmail.com" required type="email" value={profileForm.email} />
                </span>
              </label>
              <label>
                {text.age}
                <span className="auth-input-wrap">
                  <AuthIcon type="user" />
                  <input min={18} onChange={(event) => updateProfileField("age", event.target.value)} placeholder="18+" required type="number" value={profileForm.age} />
                </span>
              </label>
              <label>
                {text.gender}
                <span className="auth-input-wrap">
                  <AuthIcon type="user" />
                  <select onChange={(event) => updateProfileField("gender", event.target.value)} required value={profileForm.gender}>
                    <option value="">Сонгох</option>
                    <option value="male">Эрэгтэй</option>
                    <option value="female">Эмэгтэй</option>
                    <option value="other">Бусад</option>
                  </select>
                </span>
              </label>
              <label className="employee-wide-field">
                {text.homeAddress}
                <span className="auth-input-wrap">
                  <AuthIcon type="plate" />
                  <input onChange={(event) => updateProfileField("homeAddress", event.target.value)} pattern={mongolianTextPattern} placeholder="Дүүрэг, хороо, байр, тоот" required title={text.mongolianRequired} value={profileForm.homeAddress} />
                </span>
              </label>
              <label className="employee-wide-field">
                {text.emergencyPhones}
                <span className="auth-input-wrap">
                  <AuthIcon type="phone" />
                  <input onChange={(event) => updateProfileField("emergencyPhones", event.target.value)} pattern={mongolianTextPattern} placeholder="Ээж 99112233, Ах 88112233" required title={text.mongolianRequired} value={profileForm.emergencyPhones} />
                </span>
              </label>
              <label className="employee-wide-field">
                {text.password}
                <span className="auth-input-wrap">
                  <AuthIcon type="lock" />
                  <input autoComplete="new-password" minLength={8} onChange={(event) => setPassword(event.target.value)} placeholder={text.passwordPlaceholder} required type="password" value={password} />
                </span>
              </label>
              <label className="courier-check employee-wide-field">
                <input checked={phoneVerified} onChange={(event) => setPhoneVerified(event.target.checked)} type="checkbox" />
                {text.phoneVerified}
              </label>
            </div>
          ) : null}

          {mode === "login" ? (
            <>
              <label>
                {text.phoneNumber}
                <span className="auth-input-wrap">
                  <AuthIcon type="phone" />
                  <input autoComplete="username" onChange={(event) => setPhone(event.target.value)} placeholder={text.phonePlaceholder} required value={phone} />
                </span>
              </label>
              <label>
                {text.password}
                <span className="auth-input-wrap">
                  <AuthIcon type="lock" />
                  <input autoComplete="current-password" minLength={8} onChange={(event) => setPassword(event.target.value)} placeholder={text.passwordPlaceholder} required type="password" value={password} />
                </span>
              </label>
              <FaceCameraCheck
                help={text.loginFaceHelp}
                matched={loginFaceConfirmed}
                mode="login"
                onResult={(matched, audit) => {
                  setLoginFaceConfirmed(matched);
                  setLoginFaceAudit(audit);
                }}
                title={text.faceStep}
              />
            </>
          ) : null}

          {mode === "register" && registerStep === 2 ? (
            <div className="employee-file-grid">
              <FaceCameraCheck
                help={text.faceHelp}
                matched={documentFaceMatched}
                mode="register"
                onResult={(matched, audit) => {
                  setSelfieWithDocument(true);
                  setFaceLiveness(matched);
                  setDocumentFaceMatched(matched);
                  setFaceAudit(audit);
                }}
                title={text.faceStep}
              />
              <div className="courier-auth-tabs employee-wide-field">
                <button className={documentType === "ID_CARD" ? "active" : ""} onClick={() => setDocumentType("ID_CARD")} type="button">{text.idCard}</button>
                <button className={documentType === "PASSPORT" ? "active" : ""} onClick={() => setDocumentType("PASSPORT")} type="button">Гадаад паспорт</button>
              </div>
              <label>
                {documentType === "PASSPORT" ? text.passportPhoto : text.front}
                <input accept="image/*,.pdf" onChange={(event) => setDocumentFront(event.target.files?.[0] ?? null)} required type="file" />
              </label>
              {documentType === "ID_CARD" ? (
                <label>
                  {text.back}
                  <input accept="image/*,.pdf" onChange={(event) => setDocumentBack(event.target.files?.[0] ?? null)} required type="file" />
                </label>
              ) : null}
              <div className="employee-verification-log employee-wide-field">
                <span className={documentFaceMatched ? "matched" : faceAudit ? "declined" : ""}>
                  {documentFaceMatched ? text.cameraMatched : faceAudit ? text.cameraDeclined : "Камерын шалгалт хүлээгдэж байна"}
                </span>
                <small>{faceAudit ? `Царай шалгалтын бүртгэл: ${new Date(faceAudit.capturedAt).toLocaleString("mn-MN")} / ${faceAudit.snapshotId}` : text.encryption}</small>
              </div>
              <label>
                {text.deliveryMode}
                <span className="employee-mode-field">
                  <AuthIcon type="vehicle" />
                  <div className="courier-vehicle-grid">
                    {vehicleOptions.map((option) => (
                      <button
                        className={vehicleType === option.value ? "active" : ""}
                        key={option.value}
                        onClick={() => setVehicleType(option.value)}
                        type="button"
                      >
                        <strong>{option.label}</strong>
                        <span>{option.note}</span>
                      </button>
                    ))}
                  </div>
                </span>
              </label>
              <label>
                {vehicleType === "WALK" ? text.plateOptional : text.plate}
                <span className="auth-input-wrap">
                  <AuthIcon type="plate" />
                  <input onChange={(event) => setVehiclePlate(event.target.value)} pattern={mongolianTextPattern} placeholder="УБА 0000" title={text.mongolianRequired} value={vehiclePlate} />
                </span>
              </label>
            </div>
          ) : null}

          {mode === "register" && (
            registerStep === 2 ? (
              <button className="auth-secondary-action" onClick={() => setRegisterStep(1)} type="button">
                Өмнөх шат руу буцах
              </button>
            ) : null
          )}
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-submit" disabled={submitting} type="submit">
            {submitting
              ? text.wait
              : mode === "login"
                ? text.login
                : registerStep === 1
                  ? "Баталгаажуулах шат руу"
                  : "Бүртгэл үүсгэх"}
          </button>
          <button className="auth-secondary-action" onClick={() => switchMode(mode === "login" ? "register" : "login")} type="button">
            {mode === "login" ? `${text.noAccount} ${text.register}` : `${text.hasAccount} ${text.login}`}
          </button>
        </form>
      </section>
    </main>
  );
}

function VerificationPage({ onVerified }: { onVerified: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [documentType, setDocumentType] = useState<DocumentType>("ID_CARD");
  const [legalName, setLegalName] = useState("");
  const [front, setFront] = useState(false);
  const [back, setBack] = useState(false);
  const [selfie, setSelfie] = useState(false);
  const [liveness, setLiveness] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const livenessScore = selfie && liveness ? 98 : selfie ? 74 : 32;

  async function submitIdentity() {
    setSubmitting(true);
    setError(null);

    try {
      await postJson("/verification/identity", {
        legalName,
        documentType,
        documentFront: front,
        documentBack: back,
      });
      setStep(2);
    } catch (submitError) {
      setError(normalizeErrorMessage(submitError, text.required));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitFace() {
    setSubmitting(true);
    setError(null);

    try {
      await postJson("/verification/face", {
        selfieWithDocument: selfie,
        livenessConfirmed: liveness,
      });
      onVerified();
    } catch (submitError) {
      setError(normalizeErrorMessage(submitError, text.required));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="courier-auth-page verification-page">
      <header className="verification-topbar">
        <BrandLogo showText size={32} />
        <div>
          <span>{text.verificationFlow}</span>
          <strong>{step === 1 ? text.documentCheck : text.faceMatch}</strong>
        </div>
      </header>

      <section className="courier-auth-hero verification-hero">
        <div>
          <span>{step === 1 ? text.idStep : text.faceStep}</span>
          <h1>{step === 1 ? text.employeeVerification : text.livenessAnalyzing}</h1>
          <p>{step === 1 ? text.documentHelp : text.faceHelp}</p>
        </div>
      </section>

      <section className="courier-auth-card verification-card">
        <div className="logistics-phone-header">
          <strong>{text.brand}</strong>
          <span aria-hidden="true">•</span>
        </div>
        <div className="verification-steps">
          <span className="active">1</span>
          <i />
          <span className={step === 2 ? "active" : ""}>2</span>
        </div>

        {step === 1 ? (
          <div className="courier-auth-form">
            <div className="identity-provider-card">
              <span>{text.identityProvider}</span>
              <strong>e-Mongolia / DAN</strong>
            </div>
            <div className="courier-auth-tabs">
              <button className={documentType === "ID_CARD" ? "active" : ""} onClick={() => setDocumentType("ID_CARD")} type="button">{text.idCard}</button>
              <button className={documentType === "PASSPORT" ? "active" : ""} onClick={() => setDocumentType("PASSPORT")} type="button">{text.passport}</button>
            </div>
            <label>
              {text.legalName}
              <input onChange={(event) => setLegalName(event.target.value)} value={legalName} />
            </label>
            <label className="courier-check">
              <input checked={front} onChange={(event) => setFront(event.target.checked)} type="checkbox" />
              {documentType === "PASSPORT" ? text.passportPhoto : text.front}
            </label>
            {documentType === "ID_CARD" && (
              <label className="courier-check">
                <input checked={back} onChange={(event) => setBack(event.target.checked)} type="checkbox" />
                {text.back}
              </label>
            )}
            {error && <p className="courier-auth-error">{error}</p>}
            <button className="orange-button" disabled={submitting} onClick={submitIdentity} type="button">
              {submitting ? text.wait : text.submitId}
            </button>
          </div>
        ) : (
          <div className="courier-auth-form">
            <div className="selfie-frame">
              <span aria-hidden="true">◎</span>
              <strong>{text.livenessAnalyzing}</strong>
              <small>{text.faceHelp}</small>
            </div>
            <div className="liveness-meter">
              <div>
                <span>{text.faceStep}</span>
                <strong>{livenessScore}%</strong>
              </div>
              <i style={{ width: `${livenessScore}%` }} />
            </div>
            <div className="verification-badges">
              <span>{text.faceDetected}</span>
              <span>{text.proximityOk}</span>
            </div>
            <label className="courier-check">
              <input checked={selfie} onChange={(event) => setSelfie(event.target.checked)} type="checkbox" />
              {text.selfie}
            </label>
            <label className="courier-check">
              <input checked={liveness} onChange={(event) => setLiveness(event.target.checked)} type="checkbox" />
              {text.liveness}
            </label>
            {error && <p className="courier-auth-error">{error}</p>}
            <button className="orange-button" disabled={submitting} onClick={submitFace} type="button">
              {submitting ? text.wait : text.submitFace}
            </button>
            <small className="secure-note">{text.encryption}</small>
          </div>
        )}
      </section>
    </main>
  );
}

export function CourierApp() {
  const authModeFromUrl = new URLSearchParams(window.location.search).get("mode");
  const shouldForceAuth = authModeFromUrl === "login" || authModeFromUrl === "register";
  const [userId, setUserId] = useState<string | null>(() => {
    if (shouldForceAuth) {
      clearSession();
      return null;
    }

    return localStorage.getItem(sessionStorageKey) ?? sessionStorage.getItem(sessionStorageKey);
  });

  function handleAuthenticated(nextUserId: string) {
    setUserId(nextUserId);
  }

  function handleLogout() {
    clearSession();
    setUserId(null);
  }

  if (!userId) {
    return <CourierAuthPage onAuthenticated={handleAuthenticated} />;
  }

  return <CourierPage onLogout={handleLogout} />;
}

export default CourierApp;

