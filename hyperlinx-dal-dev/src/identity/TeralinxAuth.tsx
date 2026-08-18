import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  appendTeralinxActivity,
  activateWildcardAuthority,
  changeTeralinxPassword,
  listTeralinxActivity,
  loadAuthenticatedTeralinxUser,
  loadTeralinxRuntimeInfo,
  loginTeralinxUser,
  logoutTeralinxUser,
  deactivateWildcardAuthority,
  enrollCustomerPortalInvitation,
  type TeralinxActivityEvent,
  type TeralinxActivityInput,
  type TeralinxAuthSession,
  type TeralinxPermission,
  type TeralinxRuntimeInfo,
} from "../api/teralinxRuntime";
import { userHasPermission } from "./teralinxIdentity";
import { setPrincipalStorageScope } from "./principalScopedStorage";

type TeralinxAuthContextValue = {
  session: TeralinxAuthSession | null;
  runtimeInfo: TeralinxRuntimeInfo | null;
  activity: TeralinxActivityEvent[];
  authStatus: "checking" | "anonymous" | "authenticated";
  runtimeStatus: "loading" | "ready" | "error";
  loginError: string;
  can: (permission: TeralinxPermission) => boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshActivity: () => Promise<void>;
  recordActivity: (input: TeralinxActivityInput) => Promise<void>;
  assumeAuthority: (assumedAuthority: string, reasonCode: string, reasonDetail?: string) => Promise<void>;
  exitAssumedAuthority: () => Promise<void>;
};

const TeralinxAuthContext = createContext<TeralinxAuthContextValue | null>(null);
const LEGACY_AUTH_STORAGE_KEY = "teralinx:auth-session:v1";

function CustomerEnrollmentScreen() {
  const enrollmentParameters = new URLSearchParams(window.location.search);
  const token = enrollmentParameters.get("token") ?? "";
  const opportunityId = enrollmentParameters.get("opportunityId") ?? "";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("");
  const [complete, setComplete] = useState(false);
  async function enroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) { setStatus("Passwords do not match."); return; }
    setStatus("Securing your customer account...");
    try {
      const result = await enrollCustomerPortalInvitation({ token, username, password });
      setComplete(true); setStatus(`Account ready for ${result.username}. You may now sign in.`);
      const destination = new URL("/", window.location.origin);
      if (opportunityId) destination.searchParams.set("opportunityId", opportunityId);
      window.history.replaceState({}, "", `${destination.pathname}${destination.search}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  }
  return <main className="teralinx-login-shell"><section className="teralinx-login-panel" aria-label="Customer account enrollment">
    <div><div className="dal-kicker">TERALINX CUSTOMER</div><h1>Activate your project portal</h1><p>Confirm the invited identity and create a private password. Invitation links are single-use and do not grant authority by themselves.</p></div>
    {!complete ? <form className="teralinx-login-form" onSubmit={enroll}>
      <label>Invited username or email<input value={username} onChange={(event) => setUsername(event.currentTarget.value)} autoComplete="username" /></label>
      <label>New password<input type="password" minLength={14} value={password} onChange={(event) => setPassword(event.currentTarget.value)} autoComplete="new-password" /></label>
      <label>Confirm password<input type="password" minLength={14} value={confirm} onChange={(event) => setConfirm(event.currentTarget.value)} autoComplete="new-password" /></label>
      <button className="primary" disabled={!token || !username || password.length < 14 || !confirm}>Activate account</button>
    </form> : <button className="primary" onClick={() => window.location.assign(window.location.href)}>Continue to sign in</button>}
    {status ? <div className={`dal-status ${complete ? "" : "error"}`}>{status}</div> : null}
  </section></main>;
}

function removeLegacyClientIdentity() {
  try {
    window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    window.sessionStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  } catch {
    // Storage may be disabled; authentication remains cookie-backed.
  }
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
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="teralinx-login-shell">
      <section className="teralinx-login-panel" aria-label="Teralinx login">
        <div>
          <div className="dal-kicker">TERALINX</div>
          <h1>Teralinx Infrastructure Operating Platform</h1>
          <p>Sign in with your individual Teralinx account. Governed company truth is shared according to your role; personal workspace state remains private.</p>
        </div>
        <form className="teralinx-login-form" onSubmit={handleSubmit}>
          <label>
            Username
            <input value={username} onChange={(event) => setUsername(event.currentTarget.value)} autoComplete="username" />
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

function PasswordChangeScreen({ session, onComplete, onLogout }: {
  session: TeralinxAuthSession;
  onComplete: () => void;
  onLogout: () => Promise<void>;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await changeTeralinxPassword(currentPassword, newPassword);
      onComplete();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="teralinx-login-shell">
      <section className="teralinx-login-panel" aria-label="Password change required">
        <div>
          <div className="dal-kicker">SECURE YOUR ACCOUNT</div>
          <h1>Password change required</h1>
          <p>{session.user.name}, set a private password before entering the Teralinx workspace.</p>
        </div>
        <form className="teralinx-login-form" onSubmit={submit}>
          <label>Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.currentTarget.value)} /></label>
          <label>New password<input type="password" autoComplete="new-password" minLength={14} value={newPassword} onChange={(event) => setNewPassword(event.currentTarget.value)} /></label>
          <label>Confirm new password<input type="password" autoComplete="new-password" minLength={14} value={confirmPassword} onChange={(event) => setConfirmPassword(event.currentTarget.value)} /></label>
          <button type="submit" className="primary" disabled={submitting || !currentPassword || newPassword.length < 14 || !confirmPassword}>{submitting ? "Updating..." : "Update Password"}</button>
          <button type="button" onClick={() => void onLogout()}>Sign Out</button>
          {error ? <div className="dal-status error">{error}</div> : null}
        </form>
      </section>
    </main>
  );
}

export function TeralinxAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<TeralinxAuthSession | null>(null);
  const [authStatus, setAuthStatus] = useState<"checking" | "anonymous" | "authenticated">("checking");
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
    removeLegacyClientIdentity();
    void refreshRuntime();
    void loadAuthenticatedTeralinxUser()
      .then((current) => {
        setPrincipalStorageScope(current.user.principalId);
        setSession(current);
        setAuthStatus("authenticated");
      })
      .catch(() => {
        setPrincipalStorageScope(null);
        setSession(null);
        setAuthStatus("anonymous");
      });
  }, [refreshRuntime]);

  useEffect(() => {
    if (authStatus !== "authenticated" || !session || session.user.passwordChangeRequired) return;
    void refreshActivity();
  }, [authStatus, session?.session?.sessionId, session?.user.passwordChangeRequired, refreshActivity]);

  const login = useCallback(async (username: string, password: string) => {
    setLoginError("");
    try {
      const nextSession = await loginTeralinxUser(username, password);
      setPrincipalStorageScope(nextSession.user.principalId);
      setSession(nextSession);
      setAuthStatus("authenticated");
      if (!nextSession.user.passwordChangeRequired) {
        await appendTeralinxActivity(nextSession, {
          action: "authenticated",
          objectType: "Runtime",
          objectId: "teralinx-shared-runtime",
          objectName: "Teralinx Shared Runtime",
          details: `${nextSession.user.name} signed in to the shared runtime.`,
        }).then((event) => setActivity((previous) => [event, ...previous].slice(0, 40))).catch(() => undefined);
      }
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (session) await logoutTeralinxUser();
    } catch {
      // The server may already have expired or revoked the session.
    } finally {
      setPrincipalStorageScope(null);
      setSession(null);
      setActivity([]);
      setAuthStatus("anonymous");
    }
  }, [session]);

  const can = useCallback((permission: TeralinxPermission) => userHasPermission(session?.user, permission), [session?.user]);

  const refreshAuthenticatedSession = useCallback(async () => {
    const current = await loadAuthenticatedTeralinxUser();
    setSession(current);
  }, []);

  const assumeAuthority = useCallback(async (assumedAuthority: string, reasonCode: string, reasonDetail = "") => {
    await activateWildcardAuthority(assumedAuthority, reasonCode, reasonDetail);
    await refreshAuthenticatedSession();
  }, [refreshAuthenticatedSession]);

  const exitAssumedAuthority = useCallback(async () => {
    await deactivateWildcardAuthority();
    await refreshAuthenticatedSession();
  }, [refreshAuthenticatedSession]);

  const recordActivity = useCallback(async (input: TeralinxActivityInput) => {
    if (!session) return;
    const saved = await appendTeralinxActivity(session, input);
    setActivity((previous) => [saved, ...previous.filter((event) => event.activityId !== saved.activityId)].slice(0, 40));
  }, [session]);

  const value = useMemo<TeralinxAuthContextValue>(() => ({
    session, runtimeInfo, activity, authStatus, runtimeStatus, loginError,
    can, login, logout, refreshActivity, recordActivity, assumeAuthority, exitAssumedAuthority,
  }), [activity, authStatus, can, login, loginError, logout, recordActivity, refreshActivity, runtimeInfo, runtimeStatus, session, assumeAuthority, exitAssumedAuthority]);

  if (authStatus === "checking") {
    return <main className="teralinx-login-shell"><section className="teralinx-login-panel"><div className="dal-status">Verifying secure session...</div></section></main>;
  }

  if (!session) {
    if (window.location.pathname === "/customer/enroll") return <TeralinxAuthContext.Provider value={value}><CustomerEnrollmentScreen /></TeralinxAuthContext.Provider>;
    return <TeralinxAuthContext.Provider value={value}><TeralinxLoginScreen login={login} loginError={loginError} runtimeInfo={runtimeInfo} runtimeStatus={runtimeStatus} /></TeralinxAuthContext.Provider>;
  }

  if (session.user.passwordChangeRequired) {
    return <TeralinxAuthContext.Provider value={value}><PasswordChangeScreen session={session} onComplete={() => void logout()} onLogout={logout} /></TeralinxAuthContext.Provider>;
  }

  return <TeralinxAuthContext.Provider value={value}>{children}</TeralinxAuthContext.Provider>;
}

export function useTeralinxAuth() {
  const context = useContext(TeralinxAuthContext);
  if (!context) throw new Error("useTeralinxAuth must be used inside TeralinxAuthProvider");
  return context;
}
