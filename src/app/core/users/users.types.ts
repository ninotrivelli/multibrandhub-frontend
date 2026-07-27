import { MfaVerificationMethod, UserRole } from '../auth/auth.types';

export interface UserResponse {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  brandId: string | null;
  brandName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  brandId: string | null;
}

export interface UpdateUserRequest {
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  brandId: string | null;
}

export interface ResetPasswordRequest {
  newPassword: string;
}

export interface ResetUserMfaRequest {
  currentPassword: string;
  verificationCode: string | null;
  method: MfaVerificationMethod | null;
  reason: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
}
