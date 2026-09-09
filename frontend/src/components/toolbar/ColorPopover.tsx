import React from 'react';
import { Editor } from '@tiptap/react';
import { Baseline, PaintBucket, Ban } from 'lucide-react';
import { ToolbarDropdown } from './ToolbarDropdown';
import { useEditorUpdate } from '../../hooks/useEditorUpdate';
import { TEXT_COLORS, HIGHLIGHT_COLORS } from '../../constants/formatting';

interface ColorPopoverProps {
  editor: Editor;
  mode: 'text' | 'highlight';
}

/** Swatch-grid popover shared by the text-color and highlight triggers. */
export function ColorPopover({ editor, mode }: ColorPopoverProps) {
  useEditorUpdate(editor);
  const colors = mode === 'text' ? TEXT_COLORS : HIGHLIGHT_COLORS;
  const current = mode === 'text'
    ? (editor.getAttributes('textStyle').color as string | undefined)
    : (editor.getAttributes('highlight').color as string | undefined);

  const apply = (value: string) => {
    if (mode === 'text') editor.chain().focus().setColor(value).run();
    else editor.chain().focus().setHighlight({ color: value }).run();
  };

  const reset = () => {
    if (mode === 'text') editor.chain().focus().unsetColor().run();
    else editor.chain().focus().unsetHighlight().run();
  };

  return (
    <ToolbarDropdown
      panelClassName="swatch-menu"
      label={mode === 'text' ? 'Text color' : 'Highlight color'}
      editor={editor}
      active={mode === 'text' ? !!current : editor.isActive('highlight')}
      trigger={mode === 'text' ? <Baseline size={16} /> : <PaintBucket size={16} />}
    >
      {close => (
        <div className="swatch-grid-wrap">
          <button
            type="button"
            className={`swatch swatch-reset${!current ? ' active' : ''}`}
            title="Default"
            onClick={() => { reset(); close(); }}
          >
            <Ban size={14} />
          </button>
          {colors.map(c => (
            <button
              key={c.value}
              type="button"
              className={`swatch${current === c.value ? ' active' : ''}`}
              style={{ backgroundColor: c.value }}
              title={c.label}
              onClick={() => { apply(c.value); close(); }}
            />
          ))}
        </div>
      )}
    </ToolbarDropdown>
  );
}
