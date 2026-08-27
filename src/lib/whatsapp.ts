// Normalize Zimbabwean phone numbers for wa.me links.
export function toWhatsAppPhone(phone: string): string {
  let digits = phone.replace(/[^\d]/g, '');
  if (digits.startsWith('0')) digits = `263${digits.slice(1)}`;
  return digits;
}

export function waShareLink(customerPhone: string, message: string): string {
  return `https://wa.me/${toWhatsAppPhone(customerPhone)}?text=${encodeURIComponent(message)}`;
}

export function openWhatsApp(customerPhone: string, message: string): void {
  window.open(waShareLink(customerPhone, message), '_blank', 'noopener,noreferrer');
}
