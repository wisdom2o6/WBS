import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../utils/api";
import { errorMessage } from "../../services/workspace";
import {
  Badge,
  Button,
  Field,
  Heading,
  IconButton,
  Input,
  Logo,
  Modal,
  Notice,
} from "../../components/ui";
import { Icon } from "../../components/Icon";

export function AuthScreen({
  mode,
}: {
  mode: "login" | "register" | "forgot" | "verify";
}) {
  const [values, setValues] = useState({
    fullName: "",
    username: "",
    email: "",
    usernameOrEmail: "",
    password: "",
    confirm: "",
  });
  const [visible, setVisible] = useState(false);
  const [remember, setRemember] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [terms, setTerms] = useState(false);
  const [year] = useState(() => new Date().getFullYear());
  const { login } = useAuth();
  const navigate = useNavigate();
  const registering = mode === "register";
  const set = (key: keyof typeof values, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));
  const title = {
    login: "Good to have you back.",
    register: "Make room for your ideas.",
    forgot: "Let’s get you back in.",
    verify: "Check your email status.",
  }[mode];
  return (
    <div className="auth-layout">
      <div className="auth-editorial">
        <Link to="/demo/workspace" aria-label="Explore WBS">
          <Logo />
        </Link>
        <div className="auth-editorial-copy">
          <span className="eyebrow">THINK CLEARLY. CREATE TOGETHER.</span>
          <Heading level={1}>
            Great work
            <br />
            starts with
            <br />
            <span>shared space.</span>
          </Heading>
          <p>
            A home for your projects, your people,
            <br />
            and the ideas that bring them together.
          </p>
          <div className="auth-geometric" aria-hidden="true">
            <div />
            <div />
            <div />
            <span>W / 01</span>
          </div>
        </div>
        <div className="auth-editorial-footer">
          <span>COLLABORATIVE VISUAL WORKSPACE</span>
          <span>© {year} WBS</span>
        </div>
      </div>
      <div className="auth-main">
        <div className="auth-top">
          <span>
            {registering ? "Already have an account?" : "New to WBS?"}
          </span>
          <Link to={registering ? "/login" : "/register"}>
            {registering ? "Sign in" : "Create an account"}
            <Icon name="arrow" size={15} />
          </Link>
        </div>
        <div className="auth-form-wrap">
          <Badge>YOUR SPACE TO DO GREAT THINGS</Badge>
          <Heading level={1}>{title}</Heading>
          <p className="muted">
            {mode === "login"
              ? "Sign in to pick up where you left off."
              : registering
                ? "Create your account and build something together."
                : mode === "forgot"
                  ? "Enter your email to see the available recovery options."
                  : "Email verification is not available on this server yet."}
          </p>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setNotice("");
              if (mode === "forgot") {
                setNotice(
                  "Password recovery is not implemented by the current WBS backend. No recovery email was sent. Please contact your workspace administrator.",
                );
                return;
              }
              if (mode === "verify") {
                setNotice(
                  "The server does not expose verification or resend endpoints. Your email status cannot be confirmed here; no email has been sent.",
                );
                return;
              }
              if (registering && values.password !== values.confirm) {
                setError("Passwords do not match.");
                return;
              }
              if (registering && !accepted) {
                setError("Please acknowledge the account information.");
                return;
              }
              setBusy(true);
              try {
                const response = await api.post(
                  `/auth/${registering ? "register" : "login"}`,
                  registering
                    ? {
                        fullName: values.fullName.trim(),
                        username: values.username.trim(),
                        email: values.email.trim(),
                        password: values.password,
                      }
                    : {
                        usernameOrEmail: values.usernameOrEmail.trim(),
                        password: values.password,
                      },
                );
                if (
                  typeof response.data?.accessToken !== "string" ||
                  !response.data.accessToken
                )
                  throw new Error(
                    "The server did not return a valid sign-in session.",
                  );
                login(response.data.accessToken, response.data, remember);
                navigate("/workspace");
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            {error && <Notice tone="error">{error}</Notice>}
            {notice && <Notice>{notice}</Notice>}
            {registering && (
              <>
                <Field label="Full name">
                  <Input
                    required
                    autoComplete="name"
                    value={values.fullName}
                    onChange={(e) => set("fullName", e.target.value)}
                    placeholder="Alex Morgan"
                  />
                </Field>
                <div className="form-two-col">
                  <Field label="Username">
                    <Input
                      required
                      minLength={3}
                      maxLength={50}
                      autoComplete="username"
                      value={values.username}
                      onChange={(e) => set("username", e.target.value)}
                      placeholder="alexmorgan"
                    />
                  </Field>
                  <Field label="Email address">
                    <Input
                      required
                      type="email"
                      autoComplete="email"
                      value={values.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="you@company.com"
                    />
                  </Field>
                </div>
              </>
            )}
            {mode === "login" && (
              <Field label="Username or email">
                <Input
                  required
                  autoComplete="username"
                  value={values.usernameOrEmail}
                  onChange={(e) => set("usernameOrEmail", e.target.value)}
                  placeholder="you@company.com"
                />
              </Field>
            )}
            {(mode === "forgot" || mode === "verify") && (
              <Field label="Email address">
                <Input
                  required
                  type="email"
                  value={values.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </Field>
            )}
            {(mode === "login" || registering) && (
              <Field label="Password">
                <div className="password-field">
                  <Input
                    required
                    minLength={registering ? 6 : undefined}
                    maxLength={100}
                    type={visible ? "text" : "password"}
                    autoComplete={
                      registering ? "new-password" : "current-password"
                    }
                    value={values.password}
                    onChange={(e) => set("password", e.target.value)}
                    placeholder={
                      registering
                        ? "At least 6 characters"
                        : "Enter your password"
                    }
                  />
                  <IconButton
                    icon={visible ? "eyeoff" : "eye"}
                    label={visible ? "Hide password" : "Show password"}
                    onClick={() => setVisible(!visible)}
                  />
                </div>
              </Field>
            )}
            {registering && (
              <Field label="Confirm password">
                <Input
                  required
                  type={visible ? "text" : "password"}
                  value={values.confirm}
                  onChange={(e) => set("confirm", e.target.value)}
                  autoComplete="new-password"
                  placeholder="One more time"
                />
              </Field>
            )}
            {mode === "login" && (
              <div className="auth-form-options">
                <label className="checkbox-label">
                  <Input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Remember me
                </label>
                <Link to="/forgot-password">Forgot password?</Link>
              </div>
            )}
            {registering && (
              <label className="checkbox-label">
                <Input
                  required
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                <span>
                  I agree to the{" "}
                  <Button
                    variant="ghost"
                    className="inline-button"
                    onClick={() => setTerms(true)}
                  >
                    account terms
                  </Button>
                  .
                </span>
              </label>
            )}
            <Button
              variant="primary"
              type="submit"
              disabled={busy}
              className="auth-submit"
            >
              {busy
                ? "Connecting…"
                : mode === "login"
                  ? "Sign in to your workspace"
                  : registering
                    ? "Create your account"
                    : mode === "forgot"
                      ? "Check recovery options"
                      : "Check verification status"}
              <Icon name="arrow" size={17} />
            </Button>
          </form>
          {(mode === "forgot" || mode === "verify") && (
            <Link className="back-link" to="/login">
              Back to sign in
            </Link>
          )}
          <div className="auth-demo">
            <span>Just looking around?</span>
            <Link to="/demo/workspace">
              Explore the demo workspace
              <Icon name="arrow" size={15} />
            </Link>
          </div>
        </div>
        <div className="auth-main-footer">
          <Icon name="lock" size={13} />
          <span>A considered space for your best work.</span>
          <Link to="/verify-email">Email status</Link>
        </div>
      </div>
      {terms && (
        <Modal title="Account information" onClose={() => setTerms(false)}>
          <div className="form-stack">
            <p>
              Creating an account submits your name, username, email and
              password to the connected WBS authentication service. Your
              workspace administrator manages access and data retention.
            </p>
            <Notice>
              This imported project does not yet provide published legal terms
              or a privacy policy. Review your organization's policies before
              using it with sensitive information.
            </Notice>
            <Button onClick={() => setTerms(false)}>Understood</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
