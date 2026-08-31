"use client";

import {
  PayPalOneTimePaymentButton,
  PayPalProvider,
  VenmoOneTimePaymentButton,
  INSTANCE_LOADING_STATE,
  usePayPal,
  usePayPalOneTimePaymentSession,
  type OnApproveDataOneTimePayments,
  type OnCancelDataOneTimePayments,
} from "@paypal/react-paypal-js/sdk-v6";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { trackEvent } from "@/components/Analytics";
import { CHECKOUT_PRODUCT } from "@/lib/checkout";
import { PRIVACY_POLICY_URL } from "@/lib/links";

import styles from "./checkout.module.css";

type PayPalEnvironment = "sandbox" | "production";
type PaymentMethod = "paypal" | "venmo";
type CheckoutMode = "express" | "form";
type FlowState = "idle" | "creating" | "approval" | "capturing";

type CheckoutClientProps = {
  clientId: string | null;
  environment: PayPalEnvironment;
  checkoutEnabled: boolean;
  credentialsConfigured: boolean;
  productionRequirementsConfigured: boolean;
  newOrdersPaused: boolean;
};

const COUNTRIES = [
  ["US", "United States"],
  ["CA", "Canada"],
  ["GB", "United Kingdom"],
  ["AU", "Australia"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["NL", "Netherlands"],
  ["ES", "Spain"],
  ["IT", "Italy"],
  ["SG", "Singapore"],
  ["JP", "Japan"],
] as const;

const US_STATES = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"],
  ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
  ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"],
  ["WI", "Wisconsin"], ["WY", "Wyoming"], ["DC", "District of Columbia"],
] as const;

function BagIcon() {
  return (
    <span className={styles.bag} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M6.4 8.2h11.2l.8 12H5.6l.8-12Z" stroke="currentColor" strokeWidth="1.7" />
        <path d="M9 9V6.6a3 3 0 0 1 6 0V9" stroke="currentColor" strokeWidth="1.7" />
      </svg>
      <span>1</span>
    </span>
  );
}

function Chevron() {
  return (
    <svg className={styles.chevron} viewBox="0 0 14 8" fill="none" aria-hidden="true">
      <path d="m1 1 6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ProductLine({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? styles.productLineCompact : styles.productLine}>
      <div className={compact ? styles.productImageCompact : styles.productImage}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/checkout-product.png"
          alt="GLYDE Smart Hair Clipper VIP prelaunch offer"
        />
        {!compact ? <span className={styles.quantity}>1</span> : null}
      </div>
      <p>{CHECKOUT_PRODUCT.name}</p>
      {!compact ? <strong>${CHECKOUT_PRODUCT.amount}</strong> : null}
    </div>
  );
}

function OrderTotals({ mobile = false }: { mobile?: boolean }) {
  if (mobile) {
    return (
      <div className={styles.mobileTotal}>
        <ProductLine compact />
        <div>
          <span>Total · 1 item</span>
          <strong><small>{CHECKOUT_PRODUCT.currency}</small> ${CHECKOUT_PRODUCT.amount}</strong>
        </div>
        <Chevron />
      </div>
    );
  }

  return (
    <div className={styles.orderTotals}>
      <div><span>Subtotal</span><span>${CHECKOUT_PRODUCT.amount}</span></div>
      <div className={styles.grandTotal}>
        <strong>Total</strong>
        <span><small>{CHECKOUT_PRODUCT.currency}</small> <strong>${CHECKOUT_PRODUCT.amount}</strong></span>
      </div>
    </div>
  );
}

type PaymentControlsProps = {
  busy: boolean;
  createOrder: (method: PaymentMethod) => Promise<{ orderId: string }>;
  onApprove: (data: OnApproveDataOneTimePayments) => Promise<void>;
  onCancel: (data: OnCancelDataOneTimePayments) => void | Promise<void>;
  onError: () => void;
};

function ExpressPaymentButtons({
  busy,
  createOrder,
  onApprove,
  onCancel,
  onError,
}: PaymentControlsProps) {
  const { loadingStatus, error } = usePayPal();

  if (loadingStatus === INSTANCE_LOADING_STATE.PENDING) {
    return (
      <div className={styles.sdkLoading} role="status" aria-live="polite">
        <span />
        <span />
        <span className={styles.srOnly}>Loading secure payment methods</span>
      </div>
    );
  }

  if (loadingStatus === INSTANCE_LOADING_STATE.REJECTED || error) {
    return (
      <p className={styles.sdkUnavailable} role="alert">
        PayPal could not load. Refresh this page to try again.
      </p>
    );
  }

  return (
    <div className={styles.expressButtons}>
      <PayPalOneTimePaymentButton
        type="checkout"
        createOrder={() => createOrder("paypal")}
        onApprove={onApprove}
        onCancel={onCancel}
        onError={onError}
        disabled={busy}
        presentationMode="auto"
        commit
        aria-label="Pay with PayPal"
      />
      <VenmoOneTimePaymentButton
        type="checkout"
        createOrder={() => createOrder("venmo")}
        onApprove={onApprove}
        onCancel={onCancel}
        onError={onError}
        disabled={busy}
        presentationMode="auto"
        aria-label="Pay with Venmo"
      />
    </div>
  );
}

function FinalPaymentButton({
  busy,
  createOrder,
  onApprove,
  onCancel,
  onError,
  validate,
}: PaymentControlsProps & { validate: () => boolean }) {
  const provider = usePayPal();
  const finalSession = usePayPalOneTimePaymentSession({
    createOrder: () => createOrder("paypal"),
    onApprove,
    onCancel,
    onError,
    presentationMode: "auto",
  });

  const payNow = async () => {
    if (!validate()) return;
    trackEvent("checkout_pay_now", {
      label: "form:paypal",
      value: CHECKOUT_PRODUCT.amountMinor,
    });
    try {
      await finalSession.handleClick();
    } catch {
      onError();
    }
  };

  return (
    <button
      className={styles.payNow}
      type="button"
      onClick={payNow}
      disabled={
        busy ||
        finalSession.isPending ||
        provider.loadingStatus !== INSTANCE_LOADING_STATE.RESOLVED ||
        Boolean(provider.error)
      }
      data-track="checkout_pay_now"
    >
      {busy ? "Processing…" : "Pay now"}
    </button>
  );
}

export function CheckoutClient({
  clientId,
  environment,
  checkoutEnabled,
  credentialsConfigured,
  productionRequirementsConfigured,
  newOrdersPaused,
}: CheckoutClientProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const activeCheckoutRef = useRef<{
    mode: CheckoutMode;
    method: PaymentMethod;
  } | null>(null);
  const router = useRouter();
  const [country, setCountry] = useState("US");
  const [flow, setFlow] = useState<FlowState>("idle");
  const [message, setMessage] = useState("");

  const validate = useCallback(() => {
    const form = formRef.current;
    if (!form) return false;
    const valid = form.reportValidity();
    if (!valid) {
      setMessage("Enter your contact and billing details before continuing to PayPal.");
      trackEvent("checkout_validation_error", { label: "billing" });
    }
    return valid;
  }, []);

  const postOrder = useCallback(
    async (paymentMethod: PaymentMethod, checkoutMode: CheckoutMode) => {
      let payload: Record<string, unknown> = { checkoutMode, paymentMethod };
      if (checkoutMode === "form") {
        if (!validate() || !formRef.current) throw new Error("CHECKOUT_DETAILS_REQUIRED");

        const formData = new FormData(formRef.current);
        payload = {
          checkoutMode,
          email: formData.get("email"),
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          addressLine1: formData.get("addressLine1"),
          addressLine2: formData.get("addressLine2"),
          city: formData.get("city"),
          state: formData.get("state"),
          postalCode: formData.get("postalCode"),
          countryCode: formData.get("countryCode"),
          paymentMethod,
        };
      }

      activeCheckoutRef.current = { mode: checkoutMode, method: paymentMethod };
      setMessage("");
      setFlow("creating");
      trackEvent("checkout_order_create", {
        label: `${checkoutMode}:${paymentMethod}`,
        value: CHECKOUT_PRODUCT.amountMinor,
      });

      try {
        const response = await fetch("/api/paypal/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = (await response.json()) as { ok?: boolean; id?: string; code?: string };
        if (!response.ok || !result.ok || !result.id) throw new Error(result.code || "CREATE_FAILED");
        setFlow("approval");
        return { orderId: result.id };
      } catch (error) {
        setFlow("idle");
        setMessage(
          error instanceof Error && error.message === "rate_limited"
            ? "Too many payment attempts. Please wait a minute and try again."
            : "PayPal could not start this payment. No charge was made. Please try again.",
        );
        trackEvent("checkout_order_error", {
          label: `create:${checkoutMode}:${paymentMethod}`,
        });
        throw error;
      }
    },
    [validate],
  );

  const createExpressOrder = useCallback(
    (paymentMethod: PaymentMethod) => postOrder(paymentMethod, "express"),
    [postOrder],
  );

  const createFormOrder = useCallback(
    (paymentMethod: PaymentMethod) => postOrder(paymentMethod, "form"),
    [postOrder],
  );

  const onApprove = useCallback(async (data: OnApproveDataOneTimePayments) => {
    setFlow("capturing");
    setMessage("Finalizing your secure payment…");
    try {
      const response = await fetch(
        `/api/paypal/orders/${encodeURIComponent(data.orderId)}/capture`,
        { method: "POST" },
      );
      const result = (await response.json()) as {
        ok?: boolean;
        status?: "completed" | "pending";
        code?: string;
      };
      if (!response.ok || !result.ok || !result.status) throw new Error(result.code || "CAPTURE_FAILED");

      trackEvent("checkout_payment_captured", {
        label: activeCheckoutRef.current
          ? `${activeCheckoutRef.current.mode}:${activeCheckoutRef.current.method}:${result.status}`
          : `unknown:${result.status}`,
        value: CHECKOUT_PRODUCT.amountMinor,
      });
      router.push(`/checkout/success?order=${encodeURIComponent(data.orderId)}`);
    } catch (error) {
      setFlow("idle");
      setMessage(
        "We could not confirm the payment result. Do not retry immediately; contact support if PayPal shows a charge.",
      );
      trackEvent("checkout_order_error", {
        label: activeCheckoutRef.current
          ? `capture:${activeCheckoutRef.current.mode}:${activeCheckoutRef.current.method}`
          : "capture:unknown",
      });
      throw error;
    }
  }, [router]);

  const onCancel = useCallback(async (data: OnCancelDataOneTimePayments) => {
    trackEvent("checkout_payment_cancelled", {
      label: activeCheckoutRef.current
        ? `${activeCheckoutRef.current.mode}:${activeCheckoutRef.current.method}`
        : "unknown",
    });
    if (data.orderId) {
      await fetch(`/api/paypal/orders/${encodeURIComponent(data.orderId)}/cancel`, {
        method: "POST",
        keepalive: true,
      }).catch(() => undefined);
    }
    router.push("/checkout/cancelled");
  }, [router]);

  const onError = useCallback(() => {
    setFlow("idle");
    setMessage("PayPal could not complete this request. No confirmed charge was recorded.");
    trackEvent("checkout_order_error", {
      label: activeCheckoutRef.current
        ? `sdk:${activeCheckoutRef.current.mode}:${activeCheckoutRef.current.method}`
        : "sdk:unknown",
    });
  }, []);

  const busy = flow !== "idle";
  const setupMessage = !credentialsConfigured
    ? "PayPal checkout is ready for credentials. Payments are disabled, so no charge can be submitted yet."
    : environment === "production" && !productionRequirementsConfigured
      ? "Live checkout is disabled until the PayPal webhook and merchant ID are configured."
      : newOrdersPaused
        ? "Checkout is temporarily paused. Please try again later."
      : "PayPal checkout is temporarily unavailable.";

  const checkout = (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" aria-label="GLYDE home" className={styles.logo}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/checkout-logo.png" alt="GLYDE" width="80" height="15" />
          </Link>
          <span role="img" aria-label="One item in this checkout"><BagIcon /></span>
        </div>
      </header>

      <details className={styles.mobileOrderSummary}>
        <summary>
          <span>Order summary <Chevron /></span>
          <strong>${CHECKOUT_PRODUCT.amount}</strong>
        </summary>
        <div className={styles.mobileOrderDetails}>
          <ProductLine />
          <OrderTotals />
        </div>
      </details>

      <main className={styles.page}>
        <div className={styles.checkoutShell}>
          <form
            ref={formRef}
            className={styles.checkoutMain}
            onSubmit={(event) => event.preventDefault()}
            noValidate={false}
          >
            {environment === "sandbox" && checkoutEnabled ? (
              <p className={styles.sandboxBanner} role="status">
                PayPal Sandbox · no real money will be charged
              </p>
            ) : null}

            <section className={styles.express} aria-labelledby="express-title">
              <h1 id="express-title">Express checkout</h1>
              {checkoutEnabled ? (
                <div className={styles.expressSlot}>
                  <ExpressPaymentButtons
                    busy={busy}
                    createOrder={createExpressOrder}
                    onApprove={onApprove}
                    onCancel={onCancel}
                    onError={onError}
                  />
                </div>
              ) : (
                <div className={styles.disabledExpress} aria-disabled="true">
                  <span><b>PayPal</b><small>Setup pending</small></span>
                  <span><b>Venmo</b><small>Unavailable</small></span>
                </div>
              )}
            </section>

            {!checkoutEnabled ? (
              <div className={styles.setupNotice} role="status">
                <strong>{newOrdersPaused ? "Checkout temporarily paused" : "Payment setup pending"}</strong>
                <p>{setupMessage}</p>
              </div>
            ) : null}

            <div className={styles.separator}><span>OR</span></div>

            <section className={styles.section} aria-labelledby="contact-title">
              <div className={styles.sectionHeading}>
                <h2 id="contact-title">Contact</h2>
                <span>Secure checkout</span>
              </div>
              <label className={styles.field}>
                <span className={styles.srOnly}>Email address</span>
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  autoComplete="email"
                  maxLength={254}
                  required
                />
              </label>
            </section>

            <section className={styles.section} aria-labelledby="payment-title">
              <div className={styles.sectionTitleBlock}>
                <h2 id="payment-title">Payment</h2>
                <p>All transactions are secure and encrypted.</p>
              </div>
              <div className={styles.paymentChoice}>
                <div className={styles.paymentChoiceTop}>
                  <span className={styles.radio} aria-hidden="true" />
                  <strong>PayPal</strong>
                  <span className={styles.paypalWordmark}>Pay<span>Pal</span></span>
                </div>
                <div className={styles.paymentChoiceBody}>
                  <svg viewBox="0 0 44 36" fill="none" aria-hidden="true">
                    <rect x="7" y="5" width="27" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M14 30h23V12M29 25h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <p>You&apos;ll be redirected to PayPal to complete your purchase.</p>
                </div>
              </div>
            </section>

            <section className={styles.section} aria-labelledby="billing-title">
              <h2 id="billing-title">Billing address</h2>
              <label className={styles.field}>
                <span className={styles.srOnly}>Country or region</span>
                <select
                  name="countryCode"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  autoComplete="country"
                  required
                >
                  {COUNTRIES.map(([code, label]) => <option value={code} key={code}>{label}</option>)}
                </select>
              </label>

              <div className={styles.nameGrid}>
                <label className={styles.field}>
                  <span className={styles.srOnly}>First name</span>
                  <input name="firstName" placeholder="First name" autoComplete="given-name" maxLength={100} required />
                </label>
                <label className={styles.field}>
                  <span className={styles.srOnly}>Last name</span>
                  <input name="lastName" placeholder="Last name" autoComplete="family-name" maxLength={100} required />
                </label>
              </div>

              <label className={styles.field}>
                <span className={styles.srOnly}>Address</span>
                <input name="addressLine1" placeholder="Address" autoComplete="address-line1" maxLength={300} required />
              </label>
              <label className={styles.field}>
                <span className={styles.srOnly}>Apartment, suite, etc.</span>
                <input name="addressLine2" placeholder="Apartment, suite, etc. (optional)" autoComplete="address-line2" maxLength={300} />
              </label>

              <div className={styles.locationGrid}>
                <label className={styles.field}>
                  <span className={styles.srOnly}>City</span>
                  <input name="city" placeholder="City" autoComplete="address-level2" maxLength={120} required />
                </label>
                <label className={styles.field}>
                  <span className={styles.srOnly}>State or province</span>
                  {country === "US" ? (
                    <select name="state" defaultValue="CA" autoComplete="address-level1" required>
                      {US_STATES.map(([code, label]) => <option value={code} key={code}>{label}</option>)}
                    </select>
                  ) : (
                    <input name="state" placeholder="State / province (optional)" autoComplete="address-level1" maxLength={100} />
                  )}
                </label>
                <label className={styles.field}>
                  <span className={styles.srOnly}>Postal code</span>
                  <input
                    name="postalCode"
                    placeholder={country === "US" ? "ZIP code" : "Postal code"}
                    autoComplete="postal-code"
                    maxLength={20}
                    required
                  />
                </label>
              </div>
            </section>

            <div className={styles.mobileOnlyTotal}><OrderTotals mobile /></div>

            {message ? (
              <p
                className={flow === "capturing" ? styles.flowStatus : styles.flowMessage}
                role={flow === "capturing" ? "status" : "alert"}
                aria-live={flow === "capturing" ? "polite" : "assertive"}
              >
                {message}
              </p>
            ) : null}

            {checkoutEnabled ? (
              <div className={styles.finalPaymentSlot}>
                <FinalPaymentButton
                  busy={busy}
                  createOrder={createFormOrder}
                  onApprove={onApprove}
                  onCancel={onCancel}
                  onError={onError}
                  validate={validate}
                />
              </div>
            ) : (
              <button className={styles.payNow} type="button" disabled>Pay now</button>
            )}

            <footer className={styles.checkoutFooter}>
              <a href={PRIVACY_POLICY_URL}>Privacy policy</a>
            </footer>
          </form>

          <aside className={styles.summaryAside} aria-label="Order summary">
            <div className={styles.summarySticky}>
              <ProductLine />
              <OrderTotals />
              <div className={styles.secureNote}>
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <rect x="4.5" y="8.5" width="11" height="8" rx="2" stroke="currentColor" />
                  <path d="M7 8.5V6a3 3 0 0 1 6 0v2.5" stroke="currentColor" />
                </svg>
                Secure checkout powered by PayPal
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );

  if (!checkoutEnabled || !clientId) return checkout;

  return (
    <PayPalProvider
      clientId={clientId}
      environment={environment}
      components={["paypal-payments", "venmo-payments"]}
      pageType="checkout"
      locale="en-US"
    >
      {checkout}
    </PayPalProvider>
  );
}
