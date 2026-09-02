export const CHECKOUT_PRODUCT = {
  offerCode: "GLYDE-VIP-PRELAUNCH-DEPOSIT-5",
  sku: "GLYDE-VIP-DEPOSIT-5",
  name: "GLYDE Smart Hair Clipper – VIP Prelaunch Offer",
  shortName: "GLYDE VIP Prelaunch Reservation",
  description: "Fully refundable GLYDE VIP prelaunch reservation deposit",
  amountMinor: 500,
  amount: "5.00",
  currency: "USD",
  quantity: 1,
} as const;

export const CHECKOUT_PATH = "/checkout";
export const CHECKOUT_SUCCESS_PATH = "/checkout/success";
export const CHECKOUT_CANCELLED_PATH = "/checkout/cancelled";
