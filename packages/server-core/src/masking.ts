import { maskEmail } from "@tools/contracts";

export { maskEmail };

export function maskCustomerRef(email: string): string {
  return maskEmail(email);
}
