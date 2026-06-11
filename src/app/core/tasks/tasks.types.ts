export type StoreTaskPriority = 'Low' | 'Medium' | 'High';

export type StoreTaskStatus = 'Pending' | 'Completed';

export type StoreTaskScope = 'General' | 'Personal';

export interface StoreTaskResponse {
  id: string;
  description: string;
  priority: StoreTaskPriority;
  status: StoreTaskStatus;
  scope: StoreTaskScope;
  createdAt: string;
  createdByUserId: string | null;
  createdByName: string | null;
  completedByUserId: string | null;
  completedByName: string | null;
  completedAtUtc: string | null;
}

export interface CreateStoreTaskRequest {
  description: string;
  priority: StoreTaskPriority;
  scope: StoreTaskScope;
}

export interface StoreTaskSearchParams {
  status?: StoreTaskStatus;
  scope?: StoreTaskScope;
  page?: number;
  pageSize?: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
}
