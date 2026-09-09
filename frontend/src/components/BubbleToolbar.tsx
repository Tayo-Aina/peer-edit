import React from 'react';
import { BubbleMenu, Editor } from '@tiptap/react';
import { Bold, Italic, Underline, Strikethrough, Code, RemoveFormatting } from 'lucide-react';
import { LinkPopover } from './toolbar/LinkPopover';
import { HIGHLIGHT_COLORS } from '../constants/formatting';

interface BubbleToolbarProps {
  editor: Editor;
}

/** Four quick swatches for one-click highlighting while text is selected. */
const QUICK_HIGHLIGHTS = HIGHLIGHT_COLORS.slice(0, 4);

/**
 * Floating selection toolbar (tippy portals to <body>, so it is editor-local
 * only — nothing here enters the Yjs doc and no collab surface exists).
 */
export function BubbleToolbar({ editor }: BubbleToolbarProps) {
  const activeHighlight = editor.getAttributes('highlight').color as string | undefined;

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ state }) => !state.selection.empty}
      className="bubble-toolbar"
      tippyOptions={{ maxWidth: 320, placement: 'top' }}
    >
      <button
        type="button"
        className={`bubble-btn${editor.isActive('bold') ? ' active' : ''}`}
        onMouseDown={e => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
      >
        <Bold size={15} />
      </button>
      <button
        type="button"
        className={`bubble-btn${editor.isActive('italic') ? ' active' : ''}`}
        onMouseDown={e => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
      >
        <Italic size={15} />
      </button>
      <button
        type="button"
        className={`bubble-btn${editor.isActive('underline') ? ' active' : ''}`}
        onMouseDown={e => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline"
      >
        <Underline size={15} />
      </button>
      <button
        type="button"
        className={`bubble-btn${editor.isActive('strike') ? ' active' : ''}`}
        onMouseDown={e => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <Strikethrough size={15} />
      </button>
      <button
        type="button"
        className={`bubble-btn${editor.isActive('code') ? ' active' : ''}`}
        onMouseDown={e => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Code"
      >
        <Code size={15} />
      </button>
      <button
        type="button"
        className="bubble-btn"
        onMouseDown={e => e.preventDefault()}
        onClick={() => editor.chain().focus().unsetAllMarks().run()}
        title="Clear formatting"
      >
        <RemoveFormatting size={15} />
      </button>

      <span className="bubble-divider" />

      {QUICK_HIGHLIGHTS.map(c => (
        <button
          key={c.value}
          type="button"
          className={`bubble-swatch${activeHighlight === c.value ? ' active' : ''}`}
          style={{ backgroundColor: c.value }}
          title={`Highlight ${c.label.toLowerCase()}`}
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            if (editor.isActive('highlight', { color: c.value })) {
              editor.chain().focus().unsetHighlight().run();
            } else {
              editor.chain().focus().setHighlight({ color: c.value }).run();
            }
          }}
        />
      ))}

      <span className="bubble-divider" />

      <LinkPopover editor={editor} compact />
    </BubbleMenu>
  );
}
