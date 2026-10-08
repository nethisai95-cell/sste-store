const razorpayMethods = ['upi', 'card', 'netbanking', 'wallet'];

export function razorpayMethodOptions(selectedMethod) {
  if (selectedMethod === 'all') return undefined;
  if (!razorpayMethods.includes(selectedMethod)) {
    throw new TypeError('Choose a supported Razorpay payment method.');
  }
  return Object.fromEntries(razorpayMethods.map((method) => [method, method === selectedMethod]));
}
