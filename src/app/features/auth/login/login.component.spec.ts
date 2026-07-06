import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { LoadingService } from '../../../core/loading/loading.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  it('links to the forgot password flow', async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: {} },
        { provide: LoadingService, useValue: { start: vi.fn(), stop: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a[href="/forgot-password"]');
    expect(link?.textContent).toContain('Olvidé mi contraseña');
  });
});
