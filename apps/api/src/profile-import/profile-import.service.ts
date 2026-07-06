import { Inject, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import {
  IMPORT_CATEGORY_CONFIDENCE_THRESHOLD,
  PROFILE_CATEGORIES,
  PROFILE_SUBTYPES,
  profileImportSchema,
} from '@cotailor/shared';
import { LLM_PROVIDER, type LLMProvider } from '../llm/llm-provider.interface';
import { DocumentExtractService, type ResumeFileType } from './document-extract.service';

export interface ResumeImportResult {
  /** Prefill for the profile form — same flat shape the JSON import produces. */
  draft: Record<string, unknown>;
  meta: {
    filename: string;
    fileType: ResumeFileType;
    charCount: number;
    truncated: boolean;
    warnings: string[];
  };
}

// Stateless by design: this returns a DRAFT for the user to review in the form.
// Nothing is persisted here — saving still goes through POST/PUT /profiles, so
// every imported value passes under the user's eyes first.
@Injectable()
export class ProfileImportService {
  private readonly logger = new Logger(ProfileImportService.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: LLMProvider,
    private readonly extractor: DocumentExtractService,
  ) {}

  async importResume(buffer: Buffer, filename: string): Promise<ResumeImportResult> {
    const doc = await this.extractor.extract(buffer, filename);

    let raw: unknown;
    try {
      raw = await this.llm.parseResumeToProfile(doc.text);
    } catch (err) {
      this.logger.error(`parseResumeToProfile failed: ${err instanceof Error ? err.message : err}`);
      throw new UnprocessableEntityException(
        'The resume could not be parsed. Please try again, or fill the form manually.',
      );
    }

    // Untrusted LLM output: per-field .catch() defaults absorb bad fields, so
    // a top-level failure means the output wasn't even an object.
    const parsed = profileImportSchema.safeParse(raw);
    if (!parsed.success) {
      throw new UnprocessableEntityException(
        'The resume parser returned an unusable result. Please try again.',
      );
    }
    const { warnings: parserWarnings, category_confidence, ...draft } = parsed.data;
    const warnings = [...doc.warnings, ...parserWarnings];

    // The form only accepts categories/subtypes from its own vocabulary; an
    // off-list or low-confidence guess is cleared so the user picks manually.
    if (draft.category && !(PROFILE_CATEGORIES as readonly string[]).includes(draft.category)) {
      warnings.push(`Detected job category "${draft.category}" isn't available — please select one.`);
      draft.category = '';
    } else if (draft.category && category_confidence < IMPORT_CATEGORY_CONFIDENCE_THRESHOLD) {
      warnings.push('The job category was uncertain — please confirm or select one.');
      draft.category = '';
    }
    if (draft.subtype && !(PROFILE_SUBTYPES[draft.category] ?? []).includes(draft.subtype)) {
      draft.subtype = '';
    }

    const hasContent =
      draft.header.name ||
      draft.workExperience.length > 0 ||
      draft.education.length > 0 ||
      draft.skills.length > 0;
    if (!hasContent) {
      throw new UnprocessableEntityException(
        `No resume content could be extracted from "${filename}" — is it a resume?`,
      );
    }

    return {
      draft,
      meta: {
        filename,
        fileType: doc.fileType,
        charCount: doc.charCount,
        truncated: doc.truncated,
        warnings,
      },
    };
  }
}
