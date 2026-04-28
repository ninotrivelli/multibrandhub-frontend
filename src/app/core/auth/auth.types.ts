export type UserRole = 'SuperAdmin' | 'Admin' | 'BrandManager' | 'Seller';

export interface LoginRequest {
  email: string;
  password: string;
}

// Backend may serialize the role enum as either its string name ("Admin")
// or its numeric value (2), depending on JSON config. Accept both at the
// wire boundary; normalize to UserRole inside AuthService.
export type RoleWire = UserRole | 1 | 2 | 3 | 4;

export interface AuthResponse {
  userId: string;
  fullName: string;
  email: string;
  role: RoleWire;
  brandId: string | null;
  token: string;
  expiresAtUtc: string;
}

export interface AuthUser {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  brandId: string | null;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  expiresAtUtc: string;
}

// JWT claims as emitted by the backend's JwtTokenGenerator. .NET's
// JwtSecurityTokenHandler.DefaultOutboundClaimTypeMap shortens some
// ClaimTypes URIs (Email → "email", NameIdentifier → "nameid") but does
// NOT have an entry for ClaimTypes.Role, so role keeps its full URI in
// the JWT payload. Accept both short and URI forms — and arrays, since
// the backend writes some claim types twice (e.g. JwtRegisteredClaimNames.Email
// AND ClaimTypes.Email both serialize to "email").
export const ROLE_CLAIM_URI =
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
export const NAMEID_CLAIM_URI =
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';
export const EMAIL_CLAIM_URI =
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress';

export interface JwtClaims {
  sub?: string;
  nameid?: string | string[];
  email?: string | string[];
  role?: string | string[];
  brandId?: string;
  exp?: number;
  [ROLE_CLAIM_URI]?: string | string[];
  [NAMEID_CLAIM_URI]?: string | string[];
  [EMAIL_CLAIM_URI]?: string | string[];
}
