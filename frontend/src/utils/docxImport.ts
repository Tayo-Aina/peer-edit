import mammoth from 'mammoth';

/** Result of a .docx import: converted HTML plus any Mammoth warnings. */
export interface DocxImportResult {
  html: string;
  warnings: string[];
}

/**
 * Convert a .docx file to HTML via mammoth.
 *
 * Uses `mammoth.convertToHtml({ arrayBuffer })` with default options, so
 * embedded images arrive as base64 data-URLs (one-way import; formatting
 * loss is expected).
 *
 * Caller is responsible for applying the HTML, e.g.
 * `editor.commands.setContent(html)`, from a user gesture only — never on
 * mount or in the collab sync path.
 */
export async function importDocxToHtml(input: File | ArrayBuffer): Promise<DocxImportResult> {
  const arrayBuffer: ArrayBuffer =
    input instanceof ArrayBuffer ? input : await input.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return {
    html: result.value,
    warnings: result.messages.map(m => m.message),
  };
}
