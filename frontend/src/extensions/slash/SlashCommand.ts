import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { createElement, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SLASH_ITEMS, SlashMenuList } from '../../components/SlashMenuList';
import type { SlashItem, SlashMenuHandle } from '../../components/SlashMenuList';

/** Range passed to block commands — identical in shape to @tiptap/core's `Range`. */
interface SlashRange {
  from: number;
  to: number;
}

/** Renderer contract required by @tiptap/suggestion (subset used here). */
interface SlashSuggestionRenderer {
  onStart: (props: SuggestionProps<SlashItem>) => void;
  onUpdate: (props: SuggestionProps<SlashItem>) => void;
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
  onExit: () => void;
}

/** The suggestion config this extension installs (subset of SuggestionOptions). */
interface SlashSuggestionConfig {
  char: string;
  items: (props: { editor: Editor; query: string }) => SlashItem[];
  command: (props: { editor: Editor; range: SlashRange; props: SlashItem }) => void;
  allow: (props: { editor: Editor; state: EditorState; range: SlashRange }) => boolean;
  render: () => SlashSuggestionRenderer;
}

export interface SlashCommandOptions {
  suggestion: SlashSuggestionConfig;
}

/**
 * SlashMenuList is a forwardRef component. When mounting it through
 * createElement (no JSX in this file), wrap its type so the imperative
 * ref callback is an accepted prop.
 */
type SlashMenuComponent = ComponentType<{
  editor: Editor;
  items: SlashItem[];
  onPick: (item: SlashItem) => void;
  ref?: (handle: SlashMenuHandle | null) => void;
}>;
const SlashMenuComponent = SlashMenuList as unknown as SlashMenuComponent;

/**
 * Types "/" to open a filterable block-insert menu. Only triggers at the
 * start of an otherwise-empty paragraph, so it never hijacks real text.
 */
export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        items: ({ query }) =>
          SLASH_ITEMS.filter(item => item.label.toLowerCase().includes(query.toLowerCase())),
        // The picked item carries its own chain (deleteRange + block command).
        command: ({ editor, range, props: item }) => item.command({ editor, range }),
        // Only fire when the paragraph contains nothing but the query —
        // never mid-sentence, never inside headings/lists/code blocks.
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          return (
            $from.parent.type.name === 'paragraph'
            && $from.parent.textContent.replace(/\//g, '') === ''
          );
        },
        render: () => {
          let root: Root | null = null;
          let container: HTMLDivElement | null = null;
          let menu: SlashMenuHandle | null = null;

          const applyPosition = (props: SuggestionProps<SlashItem>) => {
            if (!container) return;
            const rect = props.clientRect?.();
            if (!rect) return;
            container.style.left = `${rect.left}px`;
            container.style.top = `${rect.bottom + 6}px`;
          };

          const mount = (props: SuggestionProps<SlashItem>) => {
            if (!container) {
              container = document.createElement('div');
              container.className = 'slash-menu-container';
              document.body.appendChild(container);
              root = createRoot(container);
            }
            root?.render(
              createElement(SlashMenuComponent, {
                editor: props.editor,
                items: props.items,
                onPick: (item: SlashItem) => props.command(item),
                ref: (handle: SlashMenuHandle | null) => {
                  menu = handle;
                },
              }),
            );
            applyPosition(props);
          };

          return {
            onStart: mount,
            onUpdate: mount,
            onKeyDown: ({ event }: SuggestionKeyDownProps) => menu?.onKeyDown(event) ?? false,
            onExit: () => {
              root?.unmount();
              container?.remove();
              root = null;
              container = null;
              menu = null;
            },
          };
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
