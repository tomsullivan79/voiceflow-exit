// lib/twilio.ts
import twilio from "twilio";

export function verifyTwilioSignature({
  authToken,
  signature,
  url,
  params,
}: {
  authToken: string;
  signature: string | null;
  url: string;
  params: Record<string, string>;
}) {
  if (!signature) return false;
  return twilio.validateRequest(authToken, signature, url, params);
}
