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
