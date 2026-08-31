import Link from "next/link";

import { login, logout } from "./actions";
import styles from "./admin.module.css";

const ERRORS: Record<string, string> = {
  invalid: "That token is not correct.",
  throttled: "Too many attempts. Try again in a few minutes.",
  unconfigured: "ADMIN_TOKEN is not set on the server.",
};

export function LoginScreen({ error }: { error?: string }) {
  return (
    <main className={styles.page}>
      <div className={`${styles.card} ${styles.login}`}>
        <h1>GLYDE admin</h1>
        <p>Enter the admin token to continue.</p>
        {error ? <p className={styles.error}>{ERRORS[error] ?? "Sign-in failed."}</p> : null}
        <form action={login}>
          <label className={styles.field}>
            <span>Admin token</span>
            <input
              type="password"
              name="token"
              autoComplete="off"
              autoFocus
              required
              aria-label="Admin token"
            />
          </label>
          <button className={styles.submit} type="submit">
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}

const TABS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/subscribers", label: "Subscribers" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/events", label: "Events" },
];

export function AdminShell({
  active,
  title,
  subtitle,
  toolbar,
  children,
}: {
  active: string;
  title: string;
  subtitle?: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.tabs} aria-label="Admin sections">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={tab.href === active ? styles.tabActive : styles.tab}
              aria-current={tab.href === active ? "page" : undefined}
            >
              {tab.label}
            </Link>
          ))}
          <form action={logout} className={styles.signOutForm}>
            <button className={styles.signOut} type="submit">
              Sign out
            </button>
          </form>
        </nav>

        <header className={styles.header}>
          <div>
            <h1>{title}</h1>
            {subtitle ? <p className={styles.count}>{subtitle}</p> : null}
          </div>
          {toolbar}
        </header>

        {children}
      </div>
    </main>
  );
}

export function RangePicker({ active, basePath }: { active: number; basePath: string }) {
  const ranges = [7, 14, 30, 90];

  return (
    <div className={styles.rangePicker} role="group" aria-label="Time range">
      {ranges.map((days) => (
        <Link
          key={days}
          href={`${basePath}?days=${days}`}
          className={days === active ? styles.rangeActive : styles.range}
          aria-current={days === active ? "true" : undefined}
        >
          {days}d
        </Link>
      ))}
    </div>
  );
}
