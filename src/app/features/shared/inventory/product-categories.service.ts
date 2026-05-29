import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ProductCategoryResponse } from './inventory.types';

@Injectable({ providedIn: 'root' })
export class ProductCategoriesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/product-categories`;

  private readonly _items = signal<ProductCategoryResponse[]>([]);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);

  readonly items = this._items.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly hasItems = computed(() => this._items().length > 0);

  // Cache once per session — categories are seeded and rarely change.
  list(force = false): Observable<ProductCategoryResponse[]> {
    if (this._loaded() && !force) {
      return new Observable<ProductCategoryResponse[]>((sub) => {
        sub.next(this._items());
        sub.complete();
      });
    }
    this._loading.set(true);
    return this.http.get<ProductCategoryResponse[]>(this.baseUrl).pipe(
      tap({
        next: (res) => {
          this._items.set(res);
          this._loaded.set(true);
          this._loading.set(false);
        },
        error: () => this._loading.set(false),
      }),
    );
  }
}
