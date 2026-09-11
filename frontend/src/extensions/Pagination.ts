import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';

/**
 * Pagination — Word print-layout style page breaks.
 *
 * The editor document is one continuous ProseMirror flow, but we measure the
 * rendered top-level blocks against one US-Letter usable page height and drop
 * a non-editable "page gap" widget between the blocks that start a new page.
 * The document itself is never modified — this is purely visual (decorations),
 * so collaboration, undo/redo and .docx export are unaffected.
 *
 * Geometry (96dpi): page 1056px tall (11in), 96px (1in) top/bottom margins
 * -> 864px of usable content per page. The gap widget paints 96px (the ending
 * sheet's bottom margin) + a 44px gray "desk" strip + 96px (the next sheet's
 * top margin) = 236px, spanning the full sheet width via negative margins.
 * Deliberately no label inside the desk strip: Word shows nothing between
 * pages, and a label turns the break into a UI divider instead of a sheet
 * edge. The page numbers live in the status bar's "Page X of Y" counter.
 */

/** Usable content height per page: 11in - 2 * 1in = 9in = 864px @ 96dpi. */
const USABLE_PAGE_HEIGHT = 864;
/** Full widget height: 96px bottom margin + 44px desk gap + 96px top margin. */
const PAGE_GAP_HEIGHT = 236;
/** .ProseMirror horizontal padding (1in) — widgets span the full sheet width. */
const PAGE_PADDING_X = 88;

export const PaginationKey = new PluginKey<DecorationSet>('pagination');

function buildGapWidget(_pageNo: number): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'pm-page-gap';
  wrap.setAttribute('contenteditable', 'false');

  // The gray band between the sheets carries no label: it is only the desk
  // showing through, with the two sheet edges top and bottom. Page numbers
  // live in the status bar ("Page X of Y").
  const band = document.createElement('div');
  band.className = 'pm-page-gap-band';

  wrap.appendChild(band);
  return wrap;
}

/**
 * Walk the rendered top-level blocks and return a widget decoration at the
 * position just before each block that overflows onto a new page.
 */
function computePageBreaks(view: EditorView): Decoration[] {
  const dom = view.dom as HTMLElement;
  const blocks = Array.from(dom.children).filter(
    el => el instanceof HTMLElement && !el.classList.contains('pm-page-gap'),
  ) as HTMLElement[];
  if (blocks.length < 2) return [];

  // All offsets are measured relative to the first block, so vertical
  // scrolling cancels out and the math stays valid while the user scrolls.
  const base = blocks[0].getBoundingClientRect().top;
  const decos: Decoration[] = [];
  let pageStart = 0;
  let pageNo = 1;

  // Start at i = 1: a break can never appear before the very first block.
  for (let i = 1; i < blocks.length; i++) {
    const el = blocks[i];
    const rect = el.getBoundingClientRect();
    const top = rect.top - base;
    const bottom = rect.bottom - base;

    // This block ends past the page bottom (and isn't alone on the page) ->
    // it starts the next page. A single block taller than a page just
    // overflows, like a giant table would in Word.
    if (bottom - pageStart > USABLE_PAGE_HEIGHT && top > pageStart) {
      pageNo += 1;
      const pos = view.state.doc.resolve(view.posAtDOM(el, 0)).before(1);
      decos.push(
        Decoration.widget(pos, buildGapWidget(pageNo), {
          side: -1,
          ignoreSelection: true,
        }),
      );
      pageStart = top;
    }
  }
  return decos;
}

function createPaginationPlugin(): Plugin<DecorationSet> {
  let lastSignature = '';

  return new Plugin<DecorationSet>({
    key: PaginationKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, value) {
        const meta = tr.getMeta(PaginationKey) as { decorations: DecorationSet } | undefined;
        if (meta) return meta.decorations;
        // Keep the (mapped) breaks visible between recomputes so the page
        // gaps never flicker away while typing.
        if (tr.docChanged) return value.map(tr.mapping, tr.doc);
        return value;
      },
    },
    props: {
      decorations: state => PaginationKey.getState(state),
    },
    view(editorView) {
      // Debounced with plain timers, NOT requestAnimationFrame: rAF is paused
      // entirely for hidden/occluded windows, which would leave pages stale
      // until the next edit. Timers keep running (throttled) in the background.
      let debounce = 0;
      let settle = 0;

      const measure = () => {
        const breaks = computePageBreaks(editorView);
        // Signature of break positions: skip the dispatch when nothing
        // moved — prevents ResizeObserver -> dispatch -> ResizeObserver
        // feedback loops when the widgets themselves change the height.
        const signature = breaks.map(d => d.from).join(',');
        if (signature === lastSignature) return;
        lastSignature = signature;
        const decorations = DecorationSet.create(editorView.state.doc, breaks);
        const tr = editorView.state.tr.setMeta(PaginationKey, { decorations });
        tr.setMeta('addToHistory', false);
        editorView.dispatch(tr);
      };

      const recalc = () => {
        window.clearTimeout(debounce);
        debounce = window.setTimeout(measure, 24);
      };

      const schedule = () => {
        window.clearTimeout(settle);
        recalc();
        // Settle pass: catches late layout shifts (web font swap, images
        // finishing decode) that happen right after the first measurement.
        settle = window.setTimeout(recalc, 180);
      };

      schedule();

      const ro = new ResizeObserver(schedule);
      ro.observe(editorView.dom);

      // Image <img> "load" doesn't bubble, but the capture phase still sees it.
      const onLoad = () => schedule();
      editorView.dom.addEventListener('load', onLoad, true);
      window.addEventListener('resize', schedule);

      return {
        update(view, prevState) {
          if (!view.state.doc.eq(prevState.doc)) schedule();
        },
        destroy() {
          window.clearTimeout(debounce);
          window.clearTimeout(settle);
          ro.disconnect();
          editorView.dom.removeEventListener('load', onLoad, true);
          window.removeEventListener('resize', schedule);
        },
      };
    },
  });
}

export const Pagination = Extension.create({
  name: 'pagination',
  addProseMirrorPlugins() {
    return [createPaginationPlugin()];
  },
});

export { USABLE_PAGE_HEIGHT, PAGE_GAP_HEIGHT, PAGE_PADDING_X };
