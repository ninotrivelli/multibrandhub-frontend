import { HttpContextToken } from '@angular/common/http';

export const HANDLE_ERROR_LOCALLY = new HttpContextToken<boolean>(() => false);
