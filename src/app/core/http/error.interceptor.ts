import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { NotificationService } from '../notifications/notification.service';

interface ValidationError {
  property: string;
  message: string;
}

interface BackendErrorBody {
  status?: number;
  error?: string;
  message?: string;
  errors?: ValidationError[];
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const notifications = inject(NotificationService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const isLoginRequest = req.url.includes('/auth/login');

      // The LoginComponent handles its own error UI inline
      if (isLoginRequest) return throwError(() => err);

      if (err.status === 401) {
        notifications.warn('Volvé a ingresar', 'Sesión expirada');
        auth.logout();
        return throwError(() => err);
      }

      const body = (err.error ?? {}) as BackendErrorBody;

      if (err.status === 400 && Array.isArray(body.errors) && body.errors.length > 0) {
        const detail = body.errors.map((e) => e.message).join(' • ');
        notifications.error(detail, 'Datos inválidos');
        return throwError(() => err);
      }

      const detail = body.message ?? 'Ocurrió un error inesperado';
      notifications.error(detail);
      return throwError(() => err);
    })
  );
};
