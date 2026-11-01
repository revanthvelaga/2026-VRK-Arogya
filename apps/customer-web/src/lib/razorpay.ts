// Loads Razorpay's checkout.js on demand (once) rather than on every page
// load — most visits never reach a payment screen.
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

let loadPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the Razorpay checkout script'));
    document.body.appendChild(script);
  });
  return loadPromise;
}

export interface RazorpayCheckoutOptions {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefillName?: string;
  prefillContact?: string;
  onSuccess: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  onDismiss?: () => void;
}

export async function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<void> {
  await loadCheckoutScript();
  if (!window.Razorpay) throw new Error('Razorpay checkout failed to load');

  const rzp = new window.Razorpay({
    key: options.keyId,
    order_id: options.orderId,
    amount: options.amount,
    currency: options.currency,
    name: options.name,
    description: options.description,
    prefill: { name: options.prefillName, contact: options.prefillContact },
    theme: { color: '#0f766e' },
    handler: options.onSuccess,
    modal: { ondismiss: options.onDismiss },
  });
  rzp.open();
}
