import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { UserRole } from './auth.types';
import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';
import { roleGuard } from './role.guard';

@Component({ template: 'Login' })
class LoginStubComponent {}

@Component({ template: 'Protected' })
class ProtectedStubComponent {}

@Component({ template: 'Admin' })
class AdminStubComponent {}

@Component({ template: 'Seller' })
class SellerStubComponent {}

function authStub(role: UserRole | null) {
  return {
    isAuthenticated: () => role !== null,
    role: () => role,
    homePathFor: (r: UserRole) => {
      if (r === 'BrandManager') return '/brand-manager';
      if (r === 'Seller') return '/seller';
      return '/admin';
    },
  };
}

describe('auth and role guards', () => {
  async function setup(role: UserRole | null): Promise<RouterTestingHarness> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authStub(role) },
        provideRouter([
          { path: 'login', component: LoginStubComponent },
          { path: 'protected', component: ProtectedStubComponent, canActivate: [authGuard] },
          { path: 'admin', component: AdminStubComponent, canActivate: [roleGuard(['Admin'])] },
          { path: 'seller', component: SellerStubComponent },
          { path: 'brand-manager', component: ProtectedStubComponent },
        ]),
      ],
    });
    return RouterTestingHarness.create();
  }

  it('redirects unauthenticated users to login', async () => {
    const harness = await setup(null);

    await harness.navigateByUrl('/protected', LoginStubComponent);

    expect(harness.routeNativeElement?.textContent).toContain('Login');
  });

  it('allows authenticated users through authGuard', async () => {
    const harness = await setup('Seller');

    await harness.navigateByUrl('/protected', ProtectedStubComponent);

    expect(harness.routeNativeElement?.textContent).toContain('Protected');
  });

  it('maps SuperAdmin onto Admin route permissions', async () => {
    const harness = await setup('SuperAdmin');

    await harness.navigateByUrl('/admin', AdminStubComponent);

    expect(harness.routeNativeElement?.textContent).toContain('Admin');
  });

  it('redirects disallowed roles to their own home route', async () => {
    const harness = await setup('Seller');

    await harness.navigateByUrl('/admin', SellerStubComponent);

    expect(harness.routeNativeElement?.textContent).toContain('Seller');
  });
});
