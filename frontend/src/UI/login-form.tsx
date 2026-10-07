"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AuthMode = "login" | "signup" | "forgot" | "reset";

export interface AuthValues {
  email: string;
  password: string;
}

/** Return `{ error }` to show a red message, `{ message }` to show a green one, `{}` on silent success (e.g. you redirect). */
export interface AuthResult {
  error?: string;
  message?: string;
}

interface AuthFormProps {
  mode: AuthMode;
  onSubmit: (values: AuthValues) => Promise<AuthResult>;
  brand?: string;
  className?: string;
}

const COPY: Record<AuthMode, { title: string; subtitle: string; button: string }> = {
  login: { title: "Welcome back", subtitle: "Sign in to continue", button: "Sign in" },
  signup: {
    title: "Create your account",
    subtitle: "Your email is your login ID",
    button: "Create account",
  },
  forgot: {
    title: "Reset password",
    subtitle: "We will email you a reset link",
    button: "Send reset link",
  },
  reset: {
    title: "Set a new password",
    subtitle: "Choose at least 8 characters",
    button: "Update password",
  },
};

const MIN_PASSWORD = 8;

function FloatingField({
  id,
  type,
  label,
  icon: Icon,
  value,
  onChange,
  autoComplete,
  trailing,
}: {
  id: string;
  type: string;
  label: string;
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="relative z-0">
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder=" "
        required
        className="peer block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 pr-10 text-sm text-foreground outline-none transition placeholder:text-transparent focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/30"
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-3 top-3 z-10 origin-[0] -translate-y-6 scale-75 bg-background px-1 text-sm text-slate-300 transition duration-300 peer-focus:text-cyan-200 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-6 peer-focus:scale-75"
      >
        <Icon className="inline-block mr-2 -mt-1" size={16} />
        {label}
      </label>
      {trailing}
    </div>
  );
}

function FooterLinks({ mode }: { mode: AuthMode }) {
  const link = "font-semibold text-cyan-200 transition hover:text-cyan-100";
  const text = "text-center text-xs text-muted-foreground";
  if (mode === "login") {
    return (
      <p className={text}>
        Don&apos;t have an account?{" "}
        <Link href="/signup" className={link}>
          Sign up
        </Link>
      </p>
    );
  }
  if (mode === "signup") {
    return (
      <p className={text}>
        Already have an account?{" "}
        <Link href="/login" className={link}>
          Log in
        </Link>
      </p>
    );
  }
  if (mode === "forgot") {
    return (
      <p className={text}>
        <Link href="/login" className={link}>
          Back to log in
        </Link>
      </p>
    );
  }
  return null;
}

/**
 * Glassmorphism auth card. UI only: the page decides what happens on submit
 * (Supabase sign in / sign up / reset) by passing `onSubmit`.
 */
export function AuthForm({
  mode,
  onSubmit,
  brand = "Trader Invoice Mailer",
  className = "",
}: AuthFormProps) {
  const copy = COPY[mode];
  const needsEmail = mode !== "reset";
  const needsPassword = mode !== "forgot";
  const needsConfirm = mode === "signup" || mode === "reset";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setMessage(null);

    if (needsPassword && password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (needsConfirm && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const result = await onSubmit({ email: email.trim(), password });
      if (result.error) setError(result.error);
      else if (result.message) setMessage(result.message);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      aria-label={showPassword ? "Hide password" : "Show password"}
      className="absolute right-3 top-3.5 text-slate-300 transition hover:text-white focus-visible:text-white"
    >
      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );

  return (
    <div
      className={`w-full max-w-sm space-y-6 rounded-2xl border border-cyan-200/15 bg-slate-950/75 p-8 shadow-2xl shadow-cyan-950/30 backdrop-blur-2xl ${className}`}
    >
      <div className="text-center">
        <Link href="/" className="text-xs font-medium tracking-wide text-cyan-200 hover:text-cyan-100">
          {brand}
        </Link>
        <h2 className="mt-2 text-3xl font-bold text-foreground">{copy.title}</h2>
        <p className="mt-2 text-sm text-slate-300">{copy.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8" noValidate={false}>
        {needsEmail && (
          <FloatingField
            id="email"
            type="email"
            label="Email address"
            icon={Mail}
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
        )}

        {needsPassword && (
          <FloatingField
            id="password"
            type={showPassword ? "text" : "password"}
            label={mode === "reset" ? "New password" : "Password"}
            icon={Lock}
            value={password}
            onChange={setPassword}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            trailing={passwordToggle}
          />
        )}

        {needsConfirm && (
          <FloatingField
            id="confirm"
            type={showPassword ? "text" : "password"}
            label="Confirm password"
            icon={Lock}
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
        )}

        {mode === "login" && (
          <div className="flex items-center justify-between">
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground transition hover:text-cyan-100"
            >
              Forgot password?
            </Link>
          </div>
        )}

        <div aria-live="polite" className="space-y-3">
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200"
            >
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              {message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="group flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground shadow-lg shadow-cyan-500/20 transition-all duration-300 hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-label="Please wait" />
          ) : (
            <>
              {copy.button}
              <ArrowRight className="ml-2 h-5 w-5 transform group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>

      <FooterLinks mode={mode} />
    </div>
  );
}

// Kept so code that imported the original name still works.
export { AuthForm as LoginForm };
