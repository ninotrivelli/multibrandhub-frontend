export interface StoreProfileResponse {
  storeName: string;
  address: string | null;
  primaryPhone: string | null;
  secondaryPhone: string | null;
  contactEmail: string | null;
  updatedAt: string | null;
}

export interface UpdateStoreProfileRequest {
  storeName: string;
  address: string | null;
  primaryPhone: string | null;
  secondaryPhone: string | null;
  contactEmail: string | null;
}
