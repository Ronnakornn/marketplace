export { auth } from "./auth.ts";
export type { Auth } from "./auth.ts";
export { getSocialProviderAvailability } from "./auth.ts";
export type { SocialProviderAvailability } from "./auth.ts";
export { authPlugin } from "./auth-plugin.ts";
export { getAuthContext } from "./auth.context.ts";
export type { AuthContext, SessionUser } from "./auth.context.ts";
export { PhoneOtpServiceError } from "./phone-otp.errors.ts";
export { PrismaPhoneOtpRepository } from "./phone-otp.repository.ts";
export type { CreatePhoneOtpChallengeData, IPhoneOtpRepository } from "./phone-otp.repository.ts";
export { PhoneOtpService } from "./phone-otp.service.ts";
export type { RequestPhoneOtpResult, VerifyPhoneOtpResult, VerifyPhoneOtpState } from "./phone-otp.service.ts";
export { createPhoneOtpRoutes } from "./phone-otp.routes.ts";
export {
  createDeterministicPhoneOtp,
  createOtpHash,
  createPhoneOtpProvider,
  DeterministicPhoneOtpProvider,
  PHONE_OTP_LENGTH,
  PHONE_OTP_MAX_ATTEMPTS,
  PHONE_OTP_MAX_REQUESTS_PER_WINDOW,
  PHONE_OTP_REQUEST_WINDOW_SECONDS,
  PHONE_OTP_RESEND_COOLDOWN_SECONDS,
  PHONE_OTP_TTL_SECONDS,
  PhoneOtpProviderError,
  normalizePhoneNumber,
  verifyOtpHash,
} from "./phone-otp.provider.ts";
export type { PhoneOtpProvider, PhoneOtpPurpose, SendPhoneOtpInput, SendPhoneOtpResult } from "./phone-otp.provider.ts";
