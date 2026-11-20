import { createCompactionService } from './compaction.service';
import { createContextService } from './context.service';
import type { ServiceDeps } from './deps';
import { createExportService } from './export.service';
import { createImportService } from './import.service';
import { createManageService } from './manage.service';
import { createRecallService } from './recall.service';
import { createRememberService } from './remember.service';
import { createReviewService } from './review.service';

export type { CompactionReport } from './compaction.service';
export type { ContextResult } from './context.service';
export * from './deps';
export type { ExportFormat } from './export.service';
export type { ChatImportInput, EntryImportReport, ImportMode } from './import.service';
export type { RecallInput } from './recall.service';
export type { RememberInput, RememberResult } from './remember.service';
export type { ApproveEdit } from './review.service';

export const createServices = (deps: ServiceDeps) => {
  const remember = createRememberService(deps);
  return {
    remember,
    recall: createRecallService(deps),
    context: createContextService(deps),
    manage: createManageService(deps),
    compact: createCompactionService(deps),
    imports: createImportService({ ...deps, remember }),
    review: createReviewService({ ...deps, remember }),
    exportAll: createExportService(deps),
  };
};

export type Services = ReturnType<typeof createServices>;
