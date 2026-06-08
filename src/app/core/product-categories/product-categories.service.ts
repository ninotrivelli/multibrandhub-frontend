import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SessionStateRegistry } from '../session/session-state-registry.service';
import { CreateProductCategoryRequest, ProductCategoryResponse } from './product-categories.types';

@Injectable({ providedIn: 'root' })
export class ProductCategoriesService {
  private readonly http = inject(HttpClient);
  private readonly sessionState = inject(SessionStateRegistry);
  private readonly baseUrl = `${environment.apiBaseUrl}/product-categories`;

  private readonly _items = signal<ProductCategoryResponse[]>([]);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);

  readonly items = this._items.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly hasItems = computed(() => this._items().length > 0);

  constructor() {
    this.sessionState.registerResetter(() => this.resetSessionState());
  }

  // Cache once per session: categories are seeded and rarely change.
  list(force = false): Observable<ProductCategoryResponse[]> {
    if (this._loaded() && !force) {
      return new Observable<ProductCategoryResponse[]>((sub) => {
        sub.next(this._items());
        sub.complete();
      });
    }
    const generation = this.sessionState.captureGeneration();
    this._loading.set(true);
    return this.http.get<ProductCategoryResponse[]>(this.baseUrl).pipe(
      tap({
        next: (res) => {
          if (!this.sessionState.isCurrentGeneration(generation)) return;
          this._items.set(sortCategories(res));
          this._loaded.set(true);
          this._loading.set(false);
        },
        error: () => {
          if (this.sessionState.isCurrentGeneration(generation)) this._loading.set(false);
        },
      }),
    );
  }

  create(request: CreateProductCategoryRequest): Observable<ProductCategoryResponse> {
    const generation = this.sessionState.captureGeneration();
    const body: CreateProductCategoryRequest = { name: request.name.trim() };

    return this.http.post<ProductCategoryResponse>(this.baseUrl, body).pipe(
      tap((created) => {
        if (!this.sessionState.isCurrentGeneration(generation)) return;
        this._items.update((curr) =>
          sortCategories([...curr.filter((category) => category.id !== created.id), created]),
        );
      }),
    );
  }

  private resetSessionState(): void {
    this._items.set([]);
    this._loading.set(false);
    this._loaded.set(false);
  }
}

function sortCategories(items: ProductCategoryResponse[]): ProductCategoryResponse[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, 'es-UY', { sensitivity: 'base' }));
}
