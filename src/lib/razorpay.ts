/**
 * Shared Razorpay Checkout loader.
 *
 * Both order checkout and membership purchase open the same gateway modal, so
 * the script tag and the "payment dismissed/failed" error shape live here.
 */

export interface RazorpayCheckoutResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export function paymentError(
  message: string,
  code: 'DISMISSED' | 'FAILED',
): Error & { code: 'DISMISSED' | 'FAILED' } {
  return Object.assign(new Error(message), { code });
}

export function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Payments are only available in the browser.'));
      return;
    }
    if ((window as any).Razorpay) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () =>
      reject(
        new Error(
          'Could not load the payment gateway. Check your connection and try again.',
        ),
      );
    document.body.appendChild(script);
  });
}

export interface OpenRazorpayInput {
  key: string;
  amount: number;
  currency?: string;
  orderId: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
}

/**
 * Opens Razorpay Checkout and resolves with the signed callback.
 *
 * The caller must still verify the signature on the server; the callback is
 * not proof of payment on its own.
 */
export function openRazorpay(
  input: OpenRazorpayInput,
): Promise<RazorpayCheckoutResponse> {
  return new Promise((resolve, reject) => {
    const options = {
      key: input.key,
      amount: input.amount,
      currency: input.currency || 'INR',
      name: input.name,
      description: input.description,
      order_id: input.orderId,
      prefill: input.prefill || {},
      theme: { color: '#E11D48' },
      handler: (response: RazorpayCheckoutResponse) => resolve(response),
      modal: {
        ondismiss: () =>
          reject(
            paymentError(
              'Payment was cancelled. Nothing was charged.',
              'DISMISSED',
            ),
          ),
      },
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.on('payment.failed', (response: any) =>
      reject(
        paymentError(
          response?.error?.description || 'Payment failed. Please try again.',
          'FAILED',
        ),
      ),
    );
    rzp.open();
  });
}
