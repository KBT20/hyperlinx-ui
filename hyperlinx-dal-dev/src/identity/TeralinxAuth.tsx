import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  appendTeralinxActivity,
  listTeralinxActivity,
  loadTeralinxRuntimeInfo,
  loginTeralinxUser,
  type TeralinxActivityEvent,
  type TeralinxActivityInput,
  type TeralinxAuthSession,
  type TeralinxPermission,
  type TeralinxRuntimeInfo,
} from "../api/teralinxRuntime";
import { userHasPermission } from "./teralinxIdentity";

const AUTH_STORAGE_KEY = "teralinx:auth-session:v1";

type TeralinxAuthContextValue = {
  session: TeralinxAuthSession | null;
  runtimeInfo: TeralinxRuntimeInfo | null;
  activity: TeralinxActivityEvent[];
  authStatus: "checking" | "anonymous" | "authenticated";
  runtimeStatus: "loading" | "ready" | "error";
  loginError: string;
  can: (permission: TeralinxPermission) => boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshActivity: () => Promise<void>;
  recordActivity: (input: TeralinxActivityInput) => Promise<void>;
};

const TeralinxAuthContext = createContext<TeralinxAuthContextValue | null>(null);

function readStoredSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TeralinxAuthSession;
    return parsed?.token && parsed?.user ? parsed : null;
  } catch {
    return null;
  }
}

function storeSession(session: TeralinxAuthSession | null) {
  if (typeof window === "undefined") return;
  if (!session) window.localStorage.removeItem(AUTH_STORAGE_KEY);
  else window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function TeralinxLoginScreen({ login, loginError, runtimeInfo, runtimeStatus }: {
  login: (username: string, password: string) => Promise<void>;
  loginError: string;
  runtimeInfo: TeralinxRuntimeInfo | null;
  runtimeStatus: "loading" | "ready" | "error";
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(username, password);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="teralinx-login-shell">
      <section className="teralinx-login-panel" aria-label="Teralinx internal login">
        <div>
          <div className="dal-kicker">TERALINX</div>
          <h1>Teralinx Infrastructure Operating Platform</h1>
          <p>Internal alpha runtime. Each authenticated user receives an isolated workspace backed by the shared governed runtime.</p>
        </div>
        <form className="teralinx-login-form" onSubmit={handleSubmit}>
          <label>
            User
            <input value={username} onChange={(event) => setUsername(event.currentTarget.value)} autoComplete="username" placeholder="kyle, ryan, or fran" />
          </label>
          <label>
            Password
            <input value={password} onChange={(event) => setPassword(event.currentTarget.value)} autoComplete="current-password" type="password" />
          </label>
          <button type="submit" className="primary" disabled={submitting || !username.trim() || !password}>
            {submitting ? "Signing in..." : "Sign In"}
          </button>
          {loginError ? <div className="dal-status error">{loginError}</div> : null}
        </form>
        <div className="teralinx-login-runtime">
          <span>{runtimeStatus === "ready" ? "Runtime Connected" : runtimeStatus === "error" ? "Runtime Error" : "Runtime Connecting"}</span>
          <span>Version: {runtimeInfo?.runtimeVersion ?? "pending"}</span>
          <span>Environment: {runtimeInfo?.environment ?? "alpha"}</span>
          <span>Organization: Teralinx</span>
        </div>
      </section>
    </main>
  );
}

export function TeralinxAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<TeralinxAuthSession | null>(() => readStoredSession());
  const [runtimeInfo, setRuntimeInfo] = useState<TeralinxRuntimeInfo | null>(null);
  const [activity, setActivity] = useState<TeralinxActivityEvent[]>([]);
  const [loginError, setLoginError] = useState("");
  const [runtimeStatus, setRuntimeStatus] = useState<"loading" | "ready" | "error">("loading");

  const refreshRuntime = useCallback(async () => {
    setRuntimeStatus("loading");
    try {
      setRuntimeInfo(await loadTeralinxRuntimeInfo());
      setRuntimeStatus("ready");
    } catch (error) {
      console.warn("Teralinx runtime metadata unavailable", error instanceof Error ? error.message : String(error));
      setRuntimeStatus("error");
    }
  }, []);

  const refreshActivity = useCallback(async () => {
    try {
      setActivity((await listTeralinxActivity()).slice(0, 40));
    } catch (error) {
      console.warn("Teralinx activity feed unavailable", error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void refreshRuntime();
  }, [refreshRuntime]);

  useEffect(() => {
    if (!session) return;
    void refreshActivity();
  }, [session?.token, refreshActivity]);

  const login = useCallback(async (username: string, password: string) => {
    setLoginError("");
    try {
      const nextSession = await loginTeralinxUser(username, password);
      setSession(nextSession);
      storeSession(nextSession);
      await appendTeralinxActivity(nextSession, {
        action: "authenticated",
        objectType: "Runtime",
        objectId: "teralinx-shared-runtime",
        objectName: "Teralinx Shared Runtime",
        details: `${nextSession.user.name} signed in to the shared runtime.`,
      }).then((event) => setActivity((prev) => [event, ...prev].slice(0, 40))).catch(() => undefined);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    storeSession(null);
  }, []);

  const can = useCallback((permission: TeralinxPermission) => userHasPermission(session?.user, permission), [session?.user]);

  const recordActivity = useCallback(async (input: TeralinxActivityInput) => {
    if (!session) return;
    const saved = await appendTeralinxActivity(session, input);
    setActivity((prev) => [saved, ...prev.filter((event) => event.activityId !== saved.activityId)].slice(0, 40));
  }, [session]);

  const value = useMemo<TeralinxAuthContextValue>(() => ({
    session,
    runtimeInfo,
    activity,
    authStatus: session ? "authenticated" : "anonymous",
    runtimeStatus,
    loginError,
    can,
    login,
    logout,
    refreshActivity,
    recordActivity,
  }), [activity, can, login, loginError, logout, recordActivity, refreshActivity, runtimeInfo, runtimeStatus, session]);

  if (!session) {
    return (
      <TeralinxAuthContext.Provider value={value}>
        <TeralinxLoginScreen login={login} loginError={loginError} runtimeInfo={runtimeInfo} runtimeStatus={runtimeStatus} />
      </TeralinxAuthContext.Provider>
    );
  }

  return <TeralinxAuthContext.Provider value={value}>{children}</TeralinxAuthContext.Provider>;
}

export function useTeralinxAuth() {
  const context = useContext(TeralinxAuthContext);
  if (!context) throw new Error("useTeralinxAuth must be used inside TeralinxAuthProvider");
  return context;
}
