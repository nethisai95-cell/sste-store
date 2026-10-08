const indianStates = new Set([
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry',
]);

const uuidPattern = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

export function validateCustomerCredentials(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Enter a valid email address.' };
  }
  if (password.length < 12 || password.length > 256) {
    return { error: 'Password must be between 12 and 256 characters.' };
  }
  return { email, password };
}

export function validateOrderRequest(body) {
  const requestedItems = body?.items;
  if (!Array.isArray(requestedItems) || requestedItems.length === 0 || requestedItems.length > 50) {
    return { error: 'Your bag must contain between 1 and 50 products.' };
  }

  const inputAddress = body?.shippingAddress;
  const shippingAddress = {
    recipientName: typeof inputAddress?.recipientName === 'string' ? inputAddress.recipientName.trim() : '',
    phone: typeof inputAddress?.phone === 'string' ? inputAddress.phone.trim() : '',
    addressLine1: typeof inputAddress?.addressLine1 === 'string' ? inputAddress.addressLine1.trim() : '',
    addressLine2: typeof inputAddress?.addressLine2 === 'string' ? inputAddress.addressLine2.trim() : '',
    city: typeof inputAddress?.city === 'string' ? inputAddress.city.trim() : '',
    state: typeof inputAddress?.state === 'string' ? inputAddress.state.trim() : '',
    postalCode: typeof inputAddress?.postalCode === 'string' ? inputAddress.postalCode.trim() : '',
  };
  if (!shippingAddress.recipientName || shippingAddress.recipientName.length > 120) {
    return { error: 'Enter a recipient name (up to 120 characters).' };
  }
  if (!/^[6-9]\d{9}$/.test(shippingAddress.phone)) {
    return { error: 'Enter a valid 10-digit Indian mobile number.' };
  }
  if (!shippingAddress.addressLine1 || shippingAddress.addressLine1.length > 160) {
    return { error: 'Enter an address line (up to 160 characters).' };
  }
  if (shippingAddress.addressLine2.length > 120) {
    return { error: 'Address line 2 must be 120 characters or fewer.' };
  }
  if (!shippingAddress.city || shippingAddress.city.length > 80) {
    return { error: 'Enter a city or town (up to 80 characters).' };
  }
  if (!indianStates.has(shippingAddress.state)) {
    return { error: 'Choose a valid Indian state or union territory.' };
  }
  if (!/^[1-9]\d{5}$/.test(shippingAddress.postalCode)) {
    return { error: 'Enter a valid 6-digit Indian PIN code.' };
  }

  const quantities = new Map();
  for (const item of requestedItems) {
    if (
      typeof item?.productId !== 'string' ||
      !uuidPattern.test(item.productId) ||
      !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99 ||
      quantities.has(item.productId)
    ) {
      return { error: 'Your bag contains an invalid product or quantity.' };
    }
    quantities.set(item.productId, item.quantity);
  }

  return { shippingAddress, quantities };
}
