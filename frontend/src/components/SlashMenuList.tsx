import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import {
  Pilcrow, Heading1, Heading2, Heading3,
  List, ListOrdered, ListTodo,
  TextQuote, SquareTerminal, Minus, Table as TableIcon, ImagePlus,
} from 'lucide-react';
import { fileToDataUrl } from '../utils/images';

/** Args passed to each slash item's command (the '/' + query range is removed first). */
interface SlashCommandProps {
  editor: Editor;
  range: { from: number; to: number };
}

export interface SlashItem {
  label: string;
  hint: string;
  icon: React.ReactNode;
  command: (props: SlashCommandProps) => void;
}

export const SLASH_ITEMS: SlashItem[] = [
  {
    label: 'Paragraph',
    hint: 'Plain text',
    icon: <Pilcrow size={16} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).clearNodes().setParagraph().run(),
  },
  {
    label: 'Heading 1',
    hint: 'Large section',
    icon: <Heading1 size={16} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).clearNodes().toggleHeading({ level: 1 }).run(),
  },
  {
    label: 'Heading 2',
    hint: 'Medium section',
    icon: <Heading2 size={16} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).clearNodes().toggleHeading({ level: 2 }).run(),
  },
  {
    label: 'Heading 3',
    hint: 'Small section',
    icon: <Heading3 size={16} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).clearNodes().toggleHeading({ level: 3 }).run(),
  },
  {
    label: 'Bullet list',
    hint: 'Unordered list',
    icon: <List size={16} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).clearNodes().toggleBulletList().run(),
  },
  {
    label: 'Numbered list',
    hint: 'Ordered list',
    icon: <ListOrdered size={16} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).clearNodes().toggleOrderedList().run(),
  },
  {
    label: 'Task list',
    hint: 'Checkboxes',
    icon: <ListTodo size={16} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).clearNodes().toggleTaskList().run(),
  },
  {
    label: 'Quote',
    hint: 'Blockquote',
    icon: <TextQuote size={16} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).clearNodes().toggleBlockquote().run(),
  },
  {
    label: 'Code block',
    hint: 'Monospace block',
    icon: <SquareTerminal size={16} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).clearNodes().toggleCodeBlock().run(),
  },
  {
    label: 'Divider',
    hint: 'Horizontal rule',
    icon: <Minus size={16} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    label: 'Table',
    hint: '3×3 with header row',
    icon: <TableIcon size={16} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    label: 'Image',
    hint: 'Insert from file',
    icon: <ImagePlus size={16} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        fileToDataUrl(file).then(src => {
          if (src) editor.chain().focus().setImage({ src }).run();
        });
      };
      input.click();
    },
  },
];

export interface SlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface SlashMenuListProps {
  editor: Editor;
  items: SlashItem[];
  /** Applies an item via the suggestion's bound command (removes the '/' query, runs the block command). */
  onPick: (item: SlashItem) => void;
}

/**
 * Rendered by SlashCommand into a body-level container. Owns ↑/↓/Enter/Esc
 * navigation, exposed to the suggestion plugin via the imperative handle.
 */
export const SlashMenuList = forwardRef<SlashMenuHandle, SlashMenuListProps>(
  function SlashMenuList({ editor, items, onPick }, ref) {
    const [index, setIndex] = useState(0);
    const [open, setOpen] = useState(true);
    const closedWithItemsRef = useRef<SlashItem[] | null>(null);

    // Keep the highlighted row valid as the filtered list shrinks/grows.
    useEffect(() => {
      setIndex(i => Math.min(i, Math.max(0, items.length - 1)));
    }, [items]);

    // Reopen after Escape once the user types a different query.
    useEffect(() => {
      if (closedWithItemsRef.current && closedWithItemsRef.current !== items) {
        closedWithItemsRef.current = null;
        setOpen(true);
      }
    }, [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          if (!open) return true;
          closedWithItemsRef.current = items;
          setOpen(false);
          return true;
        }
        if (!open) return false;
        if (event.key === 'ArrowDown') {
          setIndex(i => (items.length ? (i + 1) % items.length : 0));
          return true;
        }
        if (event.key === 'ArrowUp') {
          setIndex(i => (items.length ? (i - 1 + items.length) % items.length : 0));
          return true;
        }
        if (event.key === 'Enter') {
          const item = items[index];
          if (item) onPick(item);
          return true;
        }
        return false;
      },
    }));

    if (!open) return null;

    return (
      <div className="slash-menu">
        {items.length === 0 ? (
          <div className="slash-menu-empty">No matching commands</div>
        ) : (
          items.map((item, i) => (
            <button
              key={item.label}
              type="button"
              className={`slash-menu-item${i === index ? ' active' : ''}`}
              onMouseEnter={() => setIndex(i)}
              onMouseDown={e => e.preventDefault()}
              onClick={() => onPick(item)}
            >
              <span className="slash-menu-icon">{item.icon}</span>
              <span className="slash-menu-label">{item.label}</span>
              <span className="slash-menu-hint">{item.hint}</span>
            </button>
          ))
        )}
      </div>
    );
  },
);
