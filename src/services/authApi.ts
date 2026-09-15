// Talks to ProductClientService's phone + OTP auth flow
// (/api/v1/auth/login, /api/v1/auth/verify) with typeOfUser=HUB_OWNER.
//
// Separate base URL from services/api.ts, which talks to DeliveryInventoryService.

const AUTH_BASE_URL =
  import.meta.env.VITE_AUTH_API_BASE_URL ?? 'https://productclientservice-1.onrender.com';

export class AuthApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'AuthApiError';
  }
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
}

async function authRequest<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(`${AUTH_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as Partial<ApiResponse<T>>;

  if (!res.ok || json.success === false) {
    throw new AuthApiError(res.status, json.message ?? `HTTP ${res.status}`);
  }

  return json as ApiResponse<T>;
}

export interface HubOwnerVerifyData {
  id: string;
  phone: string;
  name?: string;
  warehouseId?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface TokenPairResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
  user: HubOwnerVerifyData;
}

export const hubOwnerAuthApi = {
  /** Step 1: phone -> OTP sent via SMS. Fails if the phone isn't a provisioned hub owner. */
  requestOtp: (phone: string) =>
    authRequest<Record<string, string>>('/api/v1/auth/login', {
      phone,
      typeOfUser: 'HUB_OWNER',
    }),

  /** Step 2: phone + OTP -> access/refresh tokens + hub owner profile. */
  verifyOtp: (phone: string, otpCode: string) =>
    authRequest<TokenPairResponse>('/api/v1/auth/verify', {
      phone,
      otp_code: otpCode,
      typeOfUser: 'HUB_OWNER',
      isSignup: false,
    }),
};
