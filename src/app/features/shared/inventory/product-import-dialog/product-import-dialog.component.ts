import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { FileUploadModule } from 'primeng/fileupload';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { Download, FileSpreadsheet, LucideAngularModule, Upload, X } from 'lucide-angular';

import { AuthService } from '../../../../core/auth/auth.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { BrandResponse } from '../../../admin/settings/marcas/brands.types';
import { ProductImportResponse, ProductImportRowError, ProductsService } from '../products.service';

const ALLOWED_EXTENSIONS = ['.csv', '.xls', '.xlsx'] as const;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const TEMPLATE_FILE_NAME = 'plantilla-importacion-productos.xlsx';

interface PreviewColumn {
  header: string;
  example: string;
  required: boolean;
}

const PREVIEW_COLUMNS: readonly PreviewColumn[] = [
  { header: 'SKU', example: 'BUZO-001', required: true },
  { header: 'Nombre', example: 'Buzo oversize', required: true },
  { header: 'Categoría', example: 'Sweaters', required: true },
  { header: 'Descripción', example: 'Buzo de algodón', required: false },
  { header: 'Precio', example: '1850', required: true },
  { header: 'Color', example: 'Negro', required: false },
  { header: 'Talle', example: 'M', required: false },
  { header: 'Stock inicial', example: '10', required: true },
];

@Component({
  selector: 'app-product-import-dialog',
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    FileUploadModule,
    MessageModule,
    SelectModule,
    TableModule,
    TooltipModule,
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-import-dialog.component.html',
})
export class ProductImportDialogComponent {
  private readonly auth = inject(AuthService);
  private readonly products = inject(ProductsService);
  private readonly notifications = inject(NotificationService);

  readonly visible = input.required<boolean>();
  readonly brands = input.required<BrandResponse[]>();

  readonly visibleChange = output<boolean>();
  readonly imported = output<ProductImportResponse>();

  protected readonly icons = { Download, FileSpreadsheet, Upload, X };
  protected readonly previewColumns = PREVIEW_COLUMNS;
  protected readonly maxFileSize = MAX_FILE_SIZE_BYTES;

  protected readonly selectedBrandId = signal<string | null>(null);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly submitting = signal(false);
  protected readonly downloadingTemplate = signal(false);
  protected readonly rowErrors = signal<ProductImportRowError[]>([]);
  protected readonly submitError = signal<string | null>(null);

  protected readonly brandOptions = computed(() =>
    this.brands()
      .filter((b) => b.status === 'Active')
      .map((b) => ({ label: b.name, value: b.id })),
  );

  // Defensive lock for BrandManager — the import button is hidden in the
  // shell, but if this dialog is ever rendered for them we force their brand.
  protected readonly brandLocked = computed(
    () => this.auth.role() === 'BrandManager' && !!this.auth.user()?.brandId,
  );

  protected readonly canSubmit = computed(() => !!this.selectedBrandId() && !!this.selectedFile());

  constructor() {
    effect(() => {
      const open = this.visible();
      if (open) untracked(() => this.resetState());
    });
  }

  protected onVisibleChange(value: boolean): void {
    if (!value && this.submitting()) return;
    this.visibleChange.emit(value);
  }

  protected cancel(): void {
    if (this.submitting()) return;
    this.visibleChange.emit(false);
  }

  protected onFileSelect(event: { files: File[] }, fileInput: { clear: () => void }): void {
    const file = event.files?.[0];
    if (!file) return;

    const ext = extractExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
      this.notifications.error('Formato no permitido. Usá .csv, .xls o .xlsx.');
      fileInput.clear();
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      this.notifications.error('El archivo supera los 10 MB.');
      fileInput.clear();
      return;
    }

    this.selectedFile.set(file);
    this.rowErrors.set([]);
    this.submitError.set(null);
  }

  protected clearFile(fileInput: { clear: () => void }): void {
    fileInput.clear();
    this.selectedFile.set(null);
  }

  protected formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  protected downloadTemplate(): void {
    if (this.downloadingTemplate()) return;
    this.downloadingTemplate.set(true);
    this.products.downloadImportTemplate().subscribe({
      next: (blob) => {
        this.downloadingTemplate.set(false);
        triggerBlobDownload(blob, TEMPLATE_FILE_NAME);
      },
      error: () => {
        this.downloadingTemplate.set(false);
        this.notifications.error('No se pudo descargar la plantilla. Probá de nuevo.');
      },
    });
  }

  protected submit(): void {
    if (this.submitting()) return;
    const brandId = this.selectedBrandId();
    const file = this.selectedFile();
    if (!brandId || !file) return;

    this.submitting.set(true);
    this.rowErrors.set([]);
    this.submitError.set(null);

    this.products.importProducts(brandId, file).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.imported.emit(res);
        this.visibleChange.emit(false);
      },
      error: (err: HttpErrorResponse) => this.handleError(err),
    });
  }

  private handleError(err: HttpErrorResponse): void {
    this.submitting.set(false);
    const body = err.error as Partial<ProductImportResponse> & { message?: string };
    if (body?.errors?.length) {
      this.rowErrors.set(body.errors);
      this.submitError.set(null);
      return;
    }
    if (body?.message) {
      this.submitError.set(body.message);
      return;
    }
    if (err.status === 401 || err.status === 403) {
      this.submitError.set('No tenés permisos para importar artículos.');
      return;
    }
    this.submitError.set('No se pudo importar el archivo. Probá de nuevo.');
  }

  private resetState(): void {
    this.submitting.set(false);
    this.downloadingTemplate.set(false);
    this.rowErrors.set([]);
    this.submitError.set(null);
    this.selectedFile.set(null);

    if (this.brandLocked()) {
      this.selectedBrandId.set(this.auth.user()?.brandId ?? null);
    } else {
      this.selectedBrandId.set(null);
    }
  }
}

function extractExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : '';
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
