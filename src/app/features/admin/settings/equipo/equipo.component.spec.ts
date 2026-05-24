import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { makeAuthUser, makeUser } from '../../../../../testing/builders';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthUser } from '../../../../core/auth/auth.types';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { UsersService } from '../../../../core/users/users.service';
import { UserResponse } from '../../../../core/users/users.types';
import { AdminEquipoComponent } from './equipo.component';

describe('AdminEquipoComponent', () => {
  let fixture: ComponentFixture<AdminEquipoComponent>;
  let component: AdminEquipoComponent;
  let currentUser: WritableSignal<AuthUser | null>;
  let userItems: WritableSignal<UserResponse[]>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    currentUser = signal<AuthUser | null>(makeAuthUser({ role: 'Admin' }));
    userItems = signal<UserResponse[]>([]);

    TestBed.configureTestingModule({
      imports: [AdminEquipoComponent],
      providers: [
        { provide: AuthService, useValue: { user: currentUser.asReadonly() } },
        {
          provide: UsersService,
          useValue: {
            items: userItems.asReadonly(),
            loading: signal(false).asReadonly(),
            hasItems: signal(true).asReadonly(),
            list: vi.fn(() => of({ items: [], totalCount: 0, page: 1, pageSize: 100 })),
            deactivate: vi.fn(() => of(undefined)),
            update: vi.fn((id: string, body: any) => of(makeUser({ ...body, id }))),
          },
        },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(AdminEquipoComponent, { set: { template: '' } });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(AdminEquipoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('hides SuperAdmin rows, inactive rows by default, and sorts the current user first', () => {
    userItems.set([
      makeUser({ id: 'seller', fullName: 'Seller', role: 'Seller', isActive: true }),
      makeUser({ id: 'user-admin', fullName: 'Admin Local', role: 'Admin', isActive: true }),
      makeUser({ id: 'inactive', fullName: 'Inactive', role: 'Seller', isActive: false }),
      makeUser({ id: 'super', fullName: 'Root', role: 'SuperAdmin', isActive: true }),
    ]);

    expect((component as any).filteredUsers().map((user: UserResponse) => user.id)).toEqual([
      'user-admin',
      'seller',
    ]);

    (component as any).showInactive.set(true);
    expect((component as any).filteredUsers().map((user: UserResponse) => user.id)).toEqual([
      'user-admin',
      'seller',
      'inactive',
    ]);
  });

  it('prevents Admin callers from editing or deactivating Admin/SuperAdmin rows', () => {
    const otherAdmin = makeUser({ id: 'other-admin', role: 'Admin' });
    const seller = makeUser({ id: 'seller', role: 'Seller' });

    expect((component as any).canEdit(otherAdmin)).toBe(false);
    expect((component as any).canDeactivate(otherAdmin)).toBe(false);
    expect((component as any).canEdit(seller)).toBe(true);
    expect((component as any).canDeactivate(seller)).toBe(true);

    currentUser.set(makeAuthUser({ role: 'SuperAdmin', userId: 'root' }));
    expect((component as any).canEdit(otherAdmin)).toBe(true);
  });
});
