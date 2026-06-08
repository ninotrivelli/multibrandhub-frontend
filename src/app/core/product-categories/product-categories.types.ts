export interface ProductCategoryResponse {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductCategoryRequest {
  name: string;
}
