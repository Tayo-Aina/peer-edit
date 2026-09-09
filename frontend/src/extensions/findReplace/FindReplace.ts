import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProsemirrorNode } from '@tiptap/pm/model';

/** One located occurrence of the find query, in document coordinates. */
interface FindMatch {
  from: number;
  to: number;
}

/**
 * Internal plugin state: the finder inputs plus their derived matches and
 * view-local decorations. None of this enters the Yjs document — decorations
 * are recomputed per view and never synced to peers.
 */
interface FindReplacePluginState {
  query: string;
  matchCase: boolean;
  matches: FindMatch[];
  activeIndex: number;
  decorations: DecorationSet;
}

/** Partial finder-state update attached to a transaction via setMeta. */
interface FindReplaceMeta {
  query?: string;
  matchCase?: boolean;
  activeIndex?: number;
}

export const findReplaceKey = new PluginKey<FindReplacePluginState>('findReplace');

export interface FindReplaceStorage {
  query: string;
  matchCase: boolean;
}

/**
 * Locate every occurrence of `query` inside text nodes.
 *
 * v1 limitation: matches spanning node boundaries (e.g. a phrase half-bolded)
 * are not found — each text node is searched independently.
 */
function findMatches(doc: ProsemirrorNode, query: string, matchCase: boolean): FindMatch[] {
  const out: FindMatch[] = [];
  if (!query) return out;
  const needle = matchCase ? query : query.toLowerCase();
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const hay = matchCase ? node.text : node.text.toLowerCase();
    let i = hay.indexOf(needle);
    while (i !== -1) {
      out.push({ from: pos + i, to: pos + i + query.length });
      i = hay.indexOf(needle, i + needle.length);
    }
  });
  return out;
}

function buildDecorations(
  doc: ProsemirrorNode,
  matches: FindMatch[],
  activeIndex: number,
): DecorationSet {
  const decorations = matches.map((match, index) =>
    Decoration.inline(match.from, match.to, {
      class: index === activeIndex ? 'find-match-active' : 'find-match',
    }),
  );
  return DecorationSet.create(doc, decorations);
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    findReplace: {
      openFindReplace: () => ReturnType;
      setFindQuery: (attrs: { query?: string; matchCase?: boolean }) => ReturnType;
      nextMatch: () => ReturnType;
      prevMatch: () => ReturnType;
      replaceCurrentMatch: (replacement: string) => ReturnType;
      replaceAll: (replacement: string) => ReturnType;
    };
  }
}

export const FindReplace = Extension.create<Record<string, never>, FindReplaceStorage>({
  name: 'findReplace',

  addStorage(): FindReplaceStorage {
    return {
      query: '',
      matchCase: false,
    };
  },

  addCommands() {
    return {
      openFindReplace:
        () =>
        () => {
          // The React panel owns open/close; this window event is the bridge.
          window.dispatchEvent(new CustomEvent('peeredit:toggle-find'));
          return true;
        },

      setFindQuery:
        ({ query, matchCase }) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            if (query !== undefined) this.storage.query = query;
            if (matchCase !== undefined) this.storage.matchCase = matchCase;
            // A new search restarts at the first match.
            tr.setMeta(findReplaceKey, {
              query: this.storage.query,
              matchCase: this.storage.matchCase,
              activeIndex: 0,
            });
          }
          return true;
        },

      nextMatch:
        () =>
        ({ state, tr, dispatch }) => {
          const findState = findReplaceKey.getState(state);
          if (!findState || !findState.matches.length) return false;
          const nextIndex = (findState.activeIndex + 1) % findState.matches.length;
          if (dispatch) {
            const match = findState.matches[nextIndex];
            tr.setMeta(findReplaceKey, { activeIndex: nextIndex });
            // Move the caret onto the match so scrollIntoView brings it on screen.
            tr.setSelection(TextSelection.create(state.doc, match.from));
            tr.scrollIntoView();
          }
          return true;
        },

      prevMatch:
        () =>
        ({ state, tr, dispatch }) => {
          const findState = findReplaceKey.getState(state);
          if (!findState || !findState.matches.length) return false;
          const prevIndex =
            (findState.activeIndex - 1 + findState.matches.length) % findState.matches.length;
          if (dispatch) {
            const match = findState.matches[prevIndex];
            tr.setMeta(findReplaceKey, { activeIndex: prevIndex });
            tr.setSelection(TextSelection.create(state.doc, match.from));
            tr.scrollIntoView();
          }
          return true;
        },

      replaceCurrentMatch:
        replacement =>
        ({ state, tr, dispatch }) => {
          const findState = findReplaceKey.getState(state);
          if (!findState || !findState.matches.length) return false;
          const index = Math.min(Math.max(findState.activeIndex, 0), findState.matches.length - 1);
          const match = findState.matches[index];
          if (dispatch) {
            // Keep the index: the plugin recomputes matches after this doc
            // change, which effectively advances to the next occurrence.
            tr.setMeta(findReplaceKey, { activeIndex: index });
            tr.insertText(replacement, match.from, match.to);
            tr.scrollIntoView();
          }
          return true;
        },

      replaceAll:
        replacement =>
        ({ state, tr, dispatch }) => {
          const { query, matchCase } = this.storage;
          const matches = findMatches(state.doc, query, matchCase);
          if (!matches.length) return false;
          if (dispatch) {
            // ONE transaction, walked backwards so earlier positions stay
            // valid: a single Yjs update and a single undo entry per peer.
            for (let i = matches.length - 1; i >= 0; i--) {
              tr.insertText(replacement, matches[i].from, matches[i].to);
            }
            tr.setMeta(findReplaceKey, { activeIndex: 0 });
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Route the browser's find shortcut to our own panel.
      'Mod-f': () => {
        window.dispatchEvent(new CustomEvent('peeredit:toggle-find'));
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<FindReplacePluginState>({
        key: findReplaceKey,
        state: {
          init: (): FindReplacePluginState => ({
            query: '',
            matchCase: false,
            matches: [],
            activeIndex: -1,
            decorations: DecorationSet.empty,
          }),
          apply(tr, value) {
            const meta = tr.getMeta(findReplaceKey) as FindReplaceMeta | undefined;
            // Rebuild on document changes (typing, remote Yjs updates) or on
            // finder-meta transactions. Everything else keeps decorations as-is.
            if (!tr.docChanged && !meta) return value;

            const query = meta?.query ?? value.query;
            const matchCase = meta?.matchCase ?? value.matchCase;
            let activeIndex = meta?.activeIndex ?? value.activeIndex;

            const matches = query ? findMatches(tr.doc, query, matchCase) : [];
            if (activeIndex >= matches.length) {
              activeIndex = matches.length ? matches.length - 1 : -1;
            }

            return {
              query,
              matchCase,
              matches,
              activeIndex,
              decorations: matches.length
                ? buildDecorations(tr.doc, matches, activeIndex)
                : DecorationSet.empty,
            };
          },
        },
        props: {
          decorations(state) {
            return findReplaceKey.getState(state)?.decorations ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
