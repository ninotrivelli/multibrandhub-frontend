import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductImageComponent } from './product-image.component';

describe('ProductImageComponent', () => {
  let fixture: ComponentFixture<ProductImageComponent>;
  let component: ProductImageComponent;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ProductImageComponent] });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(ProductImageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('uses a non-empty product image and the requested presentation inputs', () => {
    fixture.componentRef.setInput('imageUrl', ' https://example.test/product.png ');
    fixture.componentRef.setInput('alt', 'Camisa');
    fixture.componentRef.setInput('size', 'sm');
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('img');
    expect(image.src).toContain('product.png');
    expect(image.alt).toBe('Camisa');
    expect(fixture.nativeElement.querySelector('div').classList).toContain('size-10');
  });

  it('uses a category placeholder for missing and blank image URLs', () => {
    fixture.componentRef.setInput('imageUrl', '   ');
    fixture.componentRef.setInput('categoryName', 'Camisas');
    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img').src).toContain('placeholder');
    expect(fixture.nativeElement.querySelector('div').classList).toContain('size-20');

    fixture.componentRef.setInput('imageUrl', null);
    fixture.detectChanges();
    expect((component as any).resolvedUrl()).toContain('placeholder');
  });

  it('falls back once after an image error', () => {
    fixture.componentRef.setInput('imageUrl', 'https://example.test/broken.png');
    fixture.detectChanges();

    (component as any).onImgError();
    expect((component as any).fallback()).toBe(true);
    expect((component as any).resolvedUrl()).toContain('placeholder');

    (component as any).onImgError();
    expect((component as any).fallback()).toBe(true);
  });
});
