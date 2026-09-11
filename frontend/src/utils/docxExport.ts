import type { Editor } from '@tiptap/react';
import type { ILevelsOptions } from 'docx';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

/** Minimal ProseMirror JSON shapes (what editor.getJSON() returns). */
interface PMMark {
  type: string;
  attrs?: Record<string, unknown>;
}
interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
  marks?: PMMark[];
}

type InlineChild = TextRun | ExternalHyperlink;
type BlockChild = Paragraph | Table;

interface Ctx {
  /** Physical nesting depth for numbering levels (0 = top-level list). */
  depth: number;
  /** Extra left indent in DXA (used for quotes / nested task lists). */
  indentLeft: number;
}

const DEFAULT_CTX: Ctx = { depth: 0, indentLeft: 0 };

// US Letter, 1" margins. Content width = 12240 - 2880 = 9360 DXA.
const CONTENT_WIDTH_DXA = 9360;
const MAX_IMAGE_PX = 600;

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

/** `#dc2626` -> `DC2626`. Returns undefined for anything that isn't hex. */
function toHexColor(v: unknown): string | undefined {
  const s = str(v).trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : undefined;
}

/** `"16px"` -> half-points (16px = 12pt = 24). Undefined when unparseable. */
function pxToHalfPoints(v: unknown): number | undefined {
  const m = /^\s*(\d+(?:\.\d+)?)\s*px\s*$/.exec(str(v));
  if (!m) return undefined;
  return Math.round(parseFloat(m[1]) * 0.75 * 2);
}

/** `"'Times New Roman', serif"` -> `Times New Roman`. */
function firstFontFamily(v: unknown): string | undefined {
  const first = str(v)
    .split(',')[0]
    ?.trim()
    .replace(/^['"]|['"]$/g, '');
  return first ? first : undefined;
}

function toAlignment(v: unknown): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  switch (str(v)) {
    case 'center':
      return AlignmentType.CENTER;
    case 'right':
      return AlignmentType.RIGHT;
    case 'justify':
      return AlignmentType.JUSTIFIED;
    case 'left':
      return AlignmentType.LEFT;
    default:
      return undefined;
  }
}

function markOf(node: PMNode, type: string): PMMark | undefined {
  return node.marks?.find(m => m.type === type);
}

/** Build TextRuns for one text node (without link wrapping). */
function runsForText(node: PMNode): TextRun[] {
  const text = node.text ?? '';
  if (!text) return [];
  const marks = node.marks ?? [];
  const byType = (t: string) => marks.find(m => m.type === t);
  const ts = byType('textStyle')?.attrs ?? {};

  const run = new TextRun({
    text,
    bold: byType('bold') ? true : undefined,
    italics: byType('italic') ? true : undefined,
    underline: byType('underline') ? {} : undefined,
    strike: byType('strike') ? true : undefined,
    subScript: byType('subscript') ? true : undefined,
    superScript: byType('superscript') ? true : undefined,
    color: toHexColor(ts['color']),
    size: pxToHalfPoints(ts['fontSize']),
    font: firstFontFamily(ts['fontFamily']),
    ...(byType('code')
      ? { font: 'Consolas', shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' } }
      : {}),
    ...(byType('highlight')?.attrs?.['color']
      ? {
          shading: {
            type: ShadingType.CLEAR,
            fill: toHexColor(byType('highlight')?.attrs?.['color']) ?? 'FEF08A',
          },
        }
      : {}),
  });

  const link = byType('link');
  const href = str(link?.attrs?.['href']);
  if (link && href) {
    // ExternalHyperlink wraps runs; return the single run and let the
    // caller wrap consecutive link runs sharing the same href.
    (run as TextRun & { __peereditHref?: string }).__peereditHref = href;
  }
  return [run];
}

/** Inline nodes -> runs, merging consecutive same-href link runs into one hyperlink. */
function inlineChildren(nodes: PMNode[] | undefined): InlineChild[] {
  const out: InlineChild[] = [];
  let pending: { href: string; runs: TextRun[] } | null = null;
  const flush = () => {
    if (pending) {
      out.push(new ExternalHyperlink({ link: pending.href, children: pending.runs }));
      pending = null;
    }
  };
  for (const node of nodes ?? []) {
    if (node.type === 'hardBreak') {
      flush();
      out.push(new TextRun({ break: 1 }));
      continue;
    }
    if (node.type !== 'text') continue;
    for (const run of runsForText(node)) {
      const href = (run as TextRun & { __peereditHref?: string }).__peereditHref;
      delete (run as TextRun & { __peereditHref?: string }).__peereditHref;
      if (href) {
        if (!pending || pending.href !== href) {
          flush();
          pending = { href, runs: [] };
        }
        pending.runs.push(run);
      } else {
        flush();
        out.push(run);
      }
    }
  }
  flush();
  return out;
}

interface ParaOpts {
  heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
  numbering?: { reference: string; level: number };
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  indentLeft?: number;
  prefix?: string;
  monoBlock?: boolean;
  quote?: boolean;
}

function makeParagraph(children: InlineChild[], opts: ParaOpts = {}): Paragraph {
  if (opts.prefix) children = [new TextRun(opts.prefix), ...children];
  const indentLeft = opts.indentLeft ?? 0;
  return new Paragraph({
    heading: opts.heading,
    numbering: opts.numbering,
    alignment: opts.alignment,
    children,
    ...(indentLeft > 0 ? { indent: { left: indentLeft } } : {}),
    ...(opts.monoBlock
      ? {
          shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
        }
      : {}),
    ...(opts.quote
      ? {
          indent: { left: indentLeft + 720 },
          border: {
            left: { style: BorderStyle.SINGLE, size: 12, color: 'D1D5DB' },
          },
        }
      : {}),
  });
}

let listCounter = 0;
let imageCounter = 0;

interface NumberingRef {
  reference: string;
  bullet: boolean;
}

function makeNumberingRef(bullet: boolean): NumberingRef {
  return { reference: `${bullet ? 'peeredit-bullets' : 'peeredit-numbers'}-${listCounter++}`, bullet };
}

function convertBlocks(nodes: PMNode[] | undefined, ctx: Ctx): BlockChild[] {
  const out: BlockChild[] = [];
  for (const node of nodes ?? []) out.push(...convertBlock(node, ctx));
  return out;
}

function convertBlock(node: PMNode, ctx: Ctx): BlockChild[] {
  const attrs = node.attrs ?? {};
  switch (node.type) {
    case 'paragraph': {
      return [
        makeParagraph(inlineChildren(node.content), {
          alignment: toAlignment(attrs['textAlign']),
          indentLeft: ctx.indentLeft,
        }),
      ];
    }
    case 'heading': {
      const level = Number(attrs['level'] ?? 1);
      const heading =
        level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      return [
        makeParagraph(inlineChildren(node.content), {
          heading,
          alignment: toAlignment(attrs['textAlign']),
          indentLeft: ctx.indentLeft,
        }),
      ];
    }
    case 'bulletList':
    case 'orderedList': {
      const ref = makeNumberingRef(node.type === 'bulletList');
      registerNumbering(ref);
      const out: BlockChild[] = [];
      for (const item of node.content ?? []) {
        if (item.type !== 'listItem') continue;
        out.push(...convertListItem(item, ref, ctx));
      }
      return out;
    }
    case 'taskList': {
      const out: BlockChild[] = [];
      for (const item of node.content ?? []) {
        if (item.type !== 'taskItem') continue;
        const checked = item.attrs?.['checked'] === true;
        const kids = item.content ?? [];
        let first = true;
        for (const kid of kids) {
          if (kid.type === 'paragraph' || kid.type === 'heading') {
            out.push(
              makeParagraph(inlineChildren(kid.content), {
                prefix: first ? (checked ? '☒ ' : '☐ ') : '    ',
                alignment: toAlignment(kid.attrs?.['textAlign']),
                indentLeft: ctx.indentLeft,
              }),
            );
            first = false;
          } else if (kid.type === 'taskList' || kid.type === 'bulletList' || kid.type === 'orderedList') {
            out.push(
              ...convertBlock(kid, { depth: ctx.depth + 1, indentLeft: ctx.indentLeft + 360 }),
            );
            first = false;
          }
        }
        if (first) {
          out.push(
            makeParagraph([], { prefix: checked ? '☒ ' : '☐ ', indentLeft: ctx.indentLeft }),
          );
        }
      }
      return out;
    }
    case 'blockquote': {
      // Rebuild children from source nodes with quote styling.
      const quoted: BlockChild[] = [];
      for (const kid of node.content ?? []) {
        if (kid.type === 'paragraph' || kid.type === 'heading') {
          quoted.push(
            makeParagraph(inlineChildren(kid.content), {
              alignment: toAlignment(kid.attrs?.['textAlign']),
              indentLeft: ctx.indentLeft,
              quote: true,
            }),
          );
        } else if (kid.type === 'bulletList' || kid.type === 'orderedList' || kid.type === 'taskList') {
          quoted.push(...convertBlock(kid, { depth: ctx.depth, indentLeft: ctx.indentLeft + 720 }));
        } else {
          quoted.push(...convertBlock(kid, { depth: ctx.depth, indentLeft: ctx.indentLeft }));
        }
      }
      if (quoted.length > 0) return quoted;
      return convertBlocks(node.content, { depth: ctx.depth, indentLeft: ctx.indentLeft });
    }
    case 'codeBlock': {
      const lines = (node.content ?? [])
        .filter(n => n.type === 'text')
        .map(n => n.text ?? '')
        .join('')
        .split('\n');
      return lines.map(
        line =>
          new Paragraph({
            children: [new TextRun({ text: line || ' ', font: 'Consolas' })],
            shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
            ...(ctx.indentLeft > 0 ? { indent: { left: ctx.indentLeft } } : {}),
          }),
      );
    }
    case 'horizontalRule': {
      return [
        new Paragraph({
          children: [],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '9CA3AF' } },
          spacing: { before: 120, after: 120 },
        }),
      ];
    }
    case 'image': {
      const img = pendingImage(str(attrs['src']));
      if (!img) return [];
      return [
        new Paragraph({
          children: [
            new ImageRun({
              type: img.kind,
              data: img.data,
              transformation: { width: img.width, height: img.height },
              altText: {
                title: `Image ${++imageCounter}`,
                description: img.alt || `Image ${imageCounter}`,
                name: `Image ${imageCounter}`,
              },
            }),
          ],
          alignment: AlignmentType.CENTER,
          ...(ctx.indentLeft > 0 ? { indent: { left: ctx.indentLeft } } : {}),
        }),
      ];
    }
    case 'table': {
      const rows = (node.content ?? []).filter(r => r.type === 'tableRow');
      if (!rows.length) return [];
      const colCount = Math.max(
        1,
        ...rows.map(r => (r.content ?? []).filter(c => c.type === 'tableCell' || c.type === 'tableHeader').length),
      );
      const colWidth = Math.floor(CONTENT_WIDTH_DXA / colCount);
      const widths = Array.from({ length: colCount }, () => colWidth);
      const border = { style: BorderStyle.SINGLE, size: 4, color: '9CA3AF' };
      const borders = { top: border, bottom: border, left: border, right: border };
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: widths,
          rows: rows.map(
            row =>
              new TableRow({
                cantSplit: true,
                children: (row.content ?? [])
                  .filter(c => c.type === 'tableCell' || c.type === 'tableHeader')
                  .map((cell, ci) => {
                    const header = cell.type === 'tableHeader';
                    const kids = convertBlocks(cell.content, DEFAULT_CTX).filter(
                      (b): b is Paragraph => b instanceof Paragraph,
                    );
                    return new TableCell({
                      borders,
                      width: { size: widths[ci] ?? colWidth, type: WidthType.DXA },
                      margins: { top: 80, bottom: 80, left: 120, right: 120 },
                      ...(header
                        ? { shading: { fill: 'E5E7EB', type: ShadingType.CLEAR } }
                        : {}),
                      children:
                        kids.length > 0 ? kids : [new Paragraph({ children: [] })],
                    });
                  }),
              }),
          ),
        }),
      ];
    }
    default:
      return [];
  }
}

function convertListItem(item: PMNode, ref: NumberingRef, ctx: Ctx): BlockChild[] {
  const out: BlockChild[] = [];
  const level = Math.min(ctx.depth, 8);
  for (const kid of item.content ?? []) {
    if (kid.type === 'paragraph' || kid.type === 'heading') {
      out.push(
        makeParagraph(inlineChildren(kid.content), {
          numbering: { reference: ref.reference, level },
          alignment: toAlignment(kid.attrs?.['textAlign']),
          indentLeft: ctx.indentLeft,
        }),
      );
    } else if (kid.type === 'bulletList' || kid.type === 'orderedList' || kid.type === 'taskList') {
      out.push(...convertBlock(kid, { depth: ctx.depth + 1, indentLeft: ctx.indentLeft }));
    }
  }
  if (!out.length) {
    out.push(
      makeParagraph([], { numbering: { reference: ref.reference, level }, indentLeft: ctx.indentLeft }),
    );
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Numbering registry: one config per list block so numbering restarts */
/* ------------------------------------------------------------------ */

const numberingConfigs: { reference: string; levels: ILevelsOptions[] }[] = [];

function registerNumbering(ref: NumberingRef): void {
  const levels = Array.from({ length: 9 }, (_, level) => ({
    level,
    format: ref.bullet ? LevelFormat.BULLET : LevelFormat.DECIMAL,
    text: ref.bullet ? '•' : `%${level + 1}.`,
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
  }));
  numberingConfigs.push({ reference: ref.reference, levels });
}

/* ------------------------------------------------------------------ */
/* Images: decoded synchronously at export time                        */
/* ------------------------------------------------------------------ */

interface DecodedImage {
  kind: 'png' | 'jpg' | 'gif' | 'bmp';
  data: Uint8Array;
  width: number;
  height: number;
  alt: string;
}

const imageCache = new Map<string, Promise<DecodedImage | null>>();

function sniffKind(mime: string, bytes: Uint8Array): DecodedImage['kind'] | null {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/bmp') return 'bmp';
  // Fall back to magic bytes when the MIME prefix lies.
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg';
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'gif';
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp';
  return null;
}

function decodeImage(src: string, alt: string): Promise<DecodedImage | null> {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const job = (async (): Promise<DecodedImage | null> => {
    const m = /^data:(image\/[a-zA-Z+.-]+);base64,(.*)$/s.exec(src);
    if (!m) return null;
    const mime = m[1]!.toLowerCase();
    const bin = atob(m[2]!);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const kind = sniffKind(mime, bytes);
    if (!kind) return null;
    // Natural size via an <img> so aspect ratio is preserved.
    const size = await new Promise<{ w: number; h: number }>(resolve => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || MAX_IMAGE_PX, h: img.naturalHeight || 100 });
      img.onerror = () => resolve({ w: MAX_IMAGE_PX, h: Math.round((MAX_IMAGE_PX * 3) / 4) });
      img.src = src;
    });
    const scale = Math.min(1, MAX_IMAGE_PX / size.w);
    return {
      kind,
      data: bytes,
      width: Math.max(1, Math.round(size.w * scale)),
      height: Math.max(1, Math.round(size.h * scale)),
      alt,
    };
  })();
  imageCache.set(src, job);
  return job;
}

/** Image nodes are async (need natural size), so pre-decode before building. */
const decodedImages = new Map<string, DecodedImage>();

function pendingImage(src: string): DecodedImage | null {
  return decodedImages.get(src) ?? null;
}

function collectImageSrcs(nodes: PMNode[] | undefined, into: Map<string, string>): void {
  for (const node of nodes ?? []) {
    if (node.type === 'image') {
      const src = str(node.attrs?.['src']);
      if (src.startsWith('data:image/')) {
        const prev = into.get(src) ?? '';
        const alt = str(node.attrs?.['alt']) || str(node.attrs?.['title']) || prev;
        into.set(src, alt);
      }
    }
    collectImageSrcs(node.content, into);
  }
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

export async function exportToDocx(editor: Editor): Promise<void> {
  const json = editor.getJSON() as unknown as PMNode;

  // 1. Pre-decode images (async sizing) before the synchronous build.
  decodedImages.clear();
  numberingConfigs.length = 0;
  const srcs = new Map<string, string>();
  collectImageSrcs(json.content, srcs);
  await Promise.all(
    [...srcs.entries()].map(async ([src, alt]) => {
      const decoded = await decodeImage(src, alt);
      if (decoded) decodedImages.set(src, decoded);
    }),
  );

  // 2. Walk the document.
  const children = convertBlocks(json.content, DEFAULT_CTX);
  if (!children.length) children.push(new Paragraph({ children: [] }));

  // 3. Build + download.
  const doc = new Document({
    numbering: { config: numberingConfigs },
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 24 },
          paragraph: { spacing: { after: 120 } },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 36, bold: true, color: '000000', font: 'Calibri' },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0, keepNext: false, keepLines: false },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 30, bold: true, color: '000000', font: 'Calibri' },
          paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1, keepNext: false, keepLines: false },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 26, bold: true, color: '000000', font: 'Calibri' },
          paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2, keepNext: false, keepLines: false },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `peeredit-${ts}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
