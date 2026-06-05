import { ComponentFixture, TestBed } from '@angular/core/testing';

import { brandChipColors } from '../../../core/brands/brand-colors';
import { BrandChipComponent } from './brand-chip.component';

describe('BrandChipComponent', () => {
  let fixture: ComponentFixture<BrandChipComponent>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [BrandChipComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BrandChipComponent);
  });

  it('renders the brand name with deterministic colors', () => {
    fixture.componentRef.setInput('brandId', 'brand-zendra');
    fixture.componentRef.setInput('brandName', 'Zendra');
    fixture.detectChanges();

    const colors = brandChipColors({ brandId: 'brand-zendra', brandName: 'Zendra' });
    const style = (fixture.componentInstance as any).chipStyle();

    expect(fixture.nativeElement.textContent).toContain('Zendra');
    expect(style['background-color']).toBe(colors.background);
    expect(style.color).toBe(colors.text);
  });

  it('falls back to a Spanish empty label when the brand name is missing', () => {
    fixture.componentRef.setInput('brandName', null);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Sin marca');
  });
});
