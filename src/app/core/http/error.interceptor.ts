import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { isAnonymousAuthRequest } from '../auth/auth-endpoints';
import { AuthService } from '../auth/auth.service';
import { NotificationService } from '../notifications/notification.service';
import { HANDLE_ERROR_LOCALLY } from './local-error-handling';

interface ValidationError {
  property: string;
  message: string;
}

interface BackendErrorBody {
  status?: number;
  error?: string;
  message?: string;
  // Machine-readable discriminator (ApiErrorCodes in the backend). Only
  // present for specific error families, e.g. 'session_invalid'.
  code?: string;
  errors?: ValidationError[];
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const notifications = inject(NotificationService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const body = (err.error ?? {}) as BackendErrorBody;
      const detail = body.message ?? 'No tenés permisos para realizar esta acción.';

      if (err.status === 401 && !isAnonymousAuthRequest(req.url)) {
        invalidateSessionOnce(auth, notifications, 'Sesión expirada');
        return throwError(() => err);
      }

      if (err.status === 403 && isSessionInvalidForbidden(body, detail)) {
        invalidateSessionOnce(auth, notifications, 'Sesión no vigente');
        return throwError(() => err);
      }

      if (req.context.get(HANDLE_ERROR_LOCALLY)) return throwError(() => err);

      if (err.status === 400 && Array.isArray(body.errors) && body.errors.length > 0) {
        const detail = body.errors.map((e) => e.message).join(' • ');
        notifications.error(detail, 'Datos inválidos');
        return throwError(() => err);
      }

      if (err.status === 403) {
        notifications.error(detail, 'Acción no permitida');
        return throwError(() => err);
      }

      const genericDetail = body.message ?? 'Ocurrió un error inesperado';
      notifications.error(genericDetail);
      return throwError(() => err);
    }),
  );
};

function invalidateSessionOnce(
  auth: AuthService,
  notifications: NotificationService,
  summary: string,
): void {
  if (!auth.isAuthenticated()) return;
  notifications.warn('Volvé a ingresar', summary);
  auth.logout();
}

// Backend discriminator for tenant/session-invalid 403s (ApiErrorCodes.SessionInvalid,
// emitted by ExceptionHandlingMiddleware for SessionInvalidException).
const SESSION_INVALID_ERROR_CODE = 'session_invalid';

function isSessionInvalidForbidden(body: BackendErrorBody, message: string): boolean {
  // Primary contract: machine-readable code, immune to backend copy changes.
  if (body.code === SESSION_INVALID_ERROR_CODE) return true;
  // Legacy fallback: exact-message matching for backend deployments that
  // predate the `code` field. Safe to delete once the coded backend is live
  // everywhere.
  return SESSION_INVALID_FORBIDDEN_MESSAGES.has(message);
}

const SESSION_INVALID_FORBIDDEN_MESSAGES = new Set([
  'No se pudo resolver el local de la solicitud.',
  'El token no tiene tenant asociado.',
  'El token no corresponde al local actual.',
  'Usuario no autenticado.',
  'Usuario no válido.',
  'El rol del token no está vigente.',
  'La marca del token no está vigente.',
  'El local no está activo.',
  'La sesión dejó de estar vigente.',
  'La sesión no tiene autenticación en dos pasos válida.',
  'La configuración de autenticación en dos pasos no es válida.',
]);
