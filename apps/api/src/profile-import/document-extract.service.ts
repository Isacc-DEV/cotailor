import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { RESUME_IMPORT_CHAR_CAP } from '@cotailor/shared';
import * as mammoth from 'mammoth';
// unpdf, not pdf-parse: pdf-parse v1 bundles a 2018 pdf.js whose shared module
// state corrupts extractions across DIFFERENT documents in one long-lived
// process — exactly what a server does.
import { extractText, getDocumentProxy } from 'unpdf';

export type ResumeFileType = 'pdf' | 'docx';

export interface ExtractedDocument {
  text: string;
  fileType: ResumeFileType;
  /** Length of the cleaned text before the char cap was applied. */
  charCount: number;
  truncated: boolean;
  warnings: string[];
}

// Below this many characters a "successful" extraction is treated as failed —
// the typical cause is a scanned/image-only PDF with no text layer.
const MIN_TEXT_CHARS = 200;

// C0/C1 control characters except \n and \t (string-built so no raw control
// bytes live in this source file).
const CONTROL_CHARS = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]', 'g');

@Injectable()
export class DocumentExtractService {
  async extract(buffer: Buffer, filename: string): Promise<ExtractedDocument> {
    const fileType = this.sniff(buffer);
    if (fileType === 'doc') {
      throw new BadRequestException(
        'Legacy .doc files are not supported — save the file as .docx or PDF and try again.',
      );
    }
    if (fileType === 'unknown') {
      throw new BadRequestException('Unsupported file type — upload a .docx or .pdf resume.');
    }

    let raw: string;
    if (fileType === 'pdf') {
      try {
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        raw = (await extractText(pdf, { mergePages: true })).text;
      } catch {
        throw new UnprocessableEntityException(
          `Could not read "${filename}" — the PDF may be corrupt or password-protected.`,
        );
      }
    } else {
      try {
        raw = (await mammoth.extractRawText({ buffer })).value;
      } catch {
        throw new UnprocessableEntityException(
          `Could not read "${filename}" — the file does not appear to be a valid Word document.`,
        );
      }
    }

    const text = this.clean(raw);
    if (text.length < MIN_TEXT_CHARS) {
      throw new UnprocessableEntityException(
        fileType === 'pdf'
          ? `"${filename}" contains almost no selectable text — it looks like a scanned or image-only PDF. Export a text-based PDF and try again.`
          : `"${filename}" contains almost no text.`,
      );
    }

    const truncated = text.length > RESUME_IMPORT_CHAR_CAP;
    const warnings: string[] = [];
    if (truncated) {
      warnings.push(
        `The resume text exceeds ${RESUME_IMPORT_CHAR_CAP.toLocaleString()} characters — only the beginning was parsed.`,
      );
    }
    return {
      text: text.slice(0, RESUME_IMPORT_CHAR_CAP),
      fileType,
      charCount: text.length,
      truncated,
      warnings,
    };
  }

  // Magic bytes, not the client-supplied mimetype or extension: %PDF for PDFs,
  // a ZIP container (PK) for .docx, the OLE2 header for legacy .doc.
  private sniff(buffer: Buffer): ResumeFileType | 'doc' | 'unknown' {
    if (buffer.length < 4) return 'unknown';
    if (buffer.subarray(0, 1024).toString('latin1').includes('%PDF-')) return 'pdf';
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) return 'docx';
    if (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) return 'doc';
    return 'unknown';
  }

  // Keep line breaks — the resume's line structure is what the parser prompt
  // navigates by — but drop control characters and collapse filler whitespace.
  private clean(raw: string): string {
    return raw
      .replace(/\r\n?/g, '\n')
      .replace(CONTROL_CHARS, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
