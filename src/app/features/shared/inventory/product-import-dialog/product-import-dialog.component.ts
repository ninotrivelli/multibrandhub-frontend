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
import {
  ProductImportResponse,
  ProductImportRowError,
  ProductsService,
} from '../products.service';

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
  { header: 'Categoría', example: 'Indumentaria', required: true },
  { header: 'Descripción', example: 'Buzo de algodón', required: false },
  { header: 'Precio', example: '18999', required: true },
  { header: 'Color', example: 'Negro', required: false },
  { header: 'Talle', example: 'M', required: false },
  { header: 'Stock inicial', example: '25', required: true },
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
  template: `
    <p-dialog
      [visible]="visible()"
      (visibleChange)="onVisibleChange($event)"
      [modal]="true"
      [closable]="!submitting()"
      [closeOnEscape]="!submitting()"
      [dismissableMask]="!submitting()"
      [draggable]="false"
      [style]="{ width: '56rem', maxWidth: '95vw' }"
      header="Importar varios artículos"
    >
      <div class="flex flex-col gap-5">
        <p class="text-sm text-surface-600 dark:text-surface-300">
          Cargá un archivo <strong>.csv</strong>, <strong>.xls</strong> o <strong>.xlsx</strong> con
          tus artículos. La <strong>marca se elige acá</strong>, no se incluye en el archivo. Si
          alguna fila tiene errores, no se crea ningún artículo.
        </p>

        <!-- Brand selector -->
        <div class="flex flex-col gap-1">
          <label
            for="importBrand"
            class="text-sm font-medium text-surface-700 dark:text-surface-200"
          >
            Marca <span class="text-red-500">*</span>
          </label>
          <p-select
            inputId="importBrand"
            [options]="brandOptions()"
            optionLabel="label"
            optionValue="value"
            [ngModel]="selectedBrandId()"
            (ngModelChange)="selectedBrandId.set($event)"
            placeholder="Seleccionar Marca..."
            appendTo="body"
            [showClear]="false"
            [disabled]="brandLocked() || submitting()"
            fluid
          />
          @if (brandLocked()) {
            <small class="text-xs text-surface-500 dark:text-surface-400">
              Solo podés importar artículos para tu marca.
            </small>
          }
        </div>

        <!-- Template download + format preview -->
        <div
          class="rounded-lg border border-surface-200 dark:border-surface-700 p-4 flex flex-col gap-3"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-200">
              <i-lucide [img]="icons.FileSpreadsheet" class="size-4" />
              <span>Formato esperado del archivo</span>
            </div>
            <button
              pButton
              type="button"
              severity="secondary"
              [outlined]="true"
              size="small"
              label="Descargar plantilla"
              [loading]="downloadingTemplate()"
              [disabled]="downloadingTemplate() || submitting()"
              (click)="downloadTemplate()"
            >
              <i-lucide [img]="icons.Download" class="size-4 mr-2" />
            </button>
          </div>

          <div class="overflow-x-auto opacity-70">
            <table class="w-full text-xs border-collapse">
              <thead>
                <tr
                  class="bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-200"
                >
                  @for (col of previewColumns; track col.header) {
                    <th
                      class="px-2 py-1.5 text-left font-medium border border-surface-200 dark:border-surface-700 whitespace-nowrap"
                    >
                      {{ col.header }}
                      @if (col.required) {
                        <span
                          class="text-red-500"
                          pTooltip="Requerido"
                          tooltipPosition="top"
                          >*</span
                        >
                      }
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                <tr class="text-surface-500 dark:text-surface-400 italic">
                  @for (col of previewColumns; track col.header) {
                    <td
                      class="px-2 py-1.5 border border-surface-200 dark:border-surface-700 whitespace-nowrap"
                    >
                      {{ col.example }}
                    </td>
                  }
                </tr>
              </tbody>
            </table>
          </div>
          <small class="text-xs text-surface-500 dark:text-surface-400">
            Los campos marcados con <span class="text-red-500">*</span> son obligatorios. La
            categoría se busca de forma flexible (acentos, mayúsculas y espacios).
          </small>
        </div>

        <!-- File picker -->
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-surface-700 dark:text-surface-200">
            Archivo <span class="text-red-500">*</span>
          </label>
          <div class="flex flex-wrap items-center gap-3">
            <p-fileupload
              #fileInput
              mode="basic"
              [auto]="false"
              [customUpload]="true"
              accept=".csv,.xls,.xlsx"
              chooseLabel="Seleccionar archivo"
              chooseIcon="pi pi-paperclip"
              [disabled]="submitting()"
              [maxFileSize]="maxFileSize"
              (onSelect)="onFileSelect($event, fileInput)"
            />
            @if (selectedFile(); as f) {
              <div
                class="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-200 bg-surface-100 dark:bg-surface-800 rounded-md px-3 py-1.5"
              >
                <span class="font-medium">{{ f.name }}</span>
                <span class="text-surface-500 dark:text-surface-400">
                  ({{ formatSize(f.size) }})
                </span>
                <button
                  type="button"
                  class="text-surface-500 hover:text-surface-800 dark:hover:text-surface-100 cursor-pointer"
                  [disabled]="submitting()"
                  (click)="clearFile(fileInput)"
                  aria-label="Quitar archivo"
                >
                  <i-lucide [img]="icons.X" class="size-4" />
                </button>
              </div>
            }
          </div>
          <small class="text-xs text-surface-500 dark:text-surface-400">
            Tamaño máximo: 10 MB. Formatos permitidos: .csv, .xls, .xlsx.
          </small>
        </div>

        <!-- Row errors -->
        @if (rowErrors().length > 0) {
          <div class="flex flex-col gap-2">
            <p-message severity="error" variant="outlined" [closable]="false">
              No se importó ningún artículo. Corregí los siguientes errores en el archivo y volvé a
              intentar.
            </p-message>
            <div class="border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden">
              <p-table
                [value]="rowErrors()"
                [scrollable]="true"
                scrollHeight="320px"
                styleClass="text-sm"
              >
                <ng-template pTemplate="header">
                  <tr>
                    <th class="!w-20">Fila</th>
                    <th class="!w-40">Campo</th>
                    <th class="!w-48">Valor</th>
                    <th>Mensaje</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-err>
                  <tr>
                    <td class="font-mono">{{ err.row }}</td>
                    <td>{{ err.field }}</td>
                    <td class="font-mono text-surface-600 dark:text-surface-300 truncate">
                      {{ err.value ?? '—' }}
                    </td>
                    <td>{{ err.message }}</td>
                  </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                  <tr>
                    <td colspan="4" class="text-center text-surface-500 py-4">
                      Sin errores.
                    </td>
                  </tr>
                </ng-template>
              </p-table>
            </div>
          </div>
        }

        @if (submitError()) {
          <p-message severity="error" variant="outlined" [closable]="false">
            {{ submitError() }}
          </p-message>
        }
      </div>

      <ng-template pTemplate="footer">
        <div class="flex justify-end gap-2">
          <button
            pButton
            type="button"
            severity="secondary"
            [text]="true"
            label="Cancelar"
            [disabled]="submitting()"
            (click)="cancel()"
          ></button>
          <button
            pButton
            type="button"
            label="Importar"
            [loading]="submitting()"
            [disabled]="!canSubmit() || submitting()"
            (click)="submit()"
          >
            <i-lucide [img]="icons.Upload" class="size-4 mr-2" />
          </button>
        </div>
      </ng-template>
    </p-dialog>
  `,
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

  protected readonly canSubmit = computed(
    () => !!this.selectedBrandId() && !!this.selectedFile(),
  );

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
