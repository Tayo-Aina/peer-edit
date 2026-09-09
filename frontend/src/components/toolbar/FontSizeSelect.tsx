import React from 'react';
import { Editor } from '@tiptap/react';
import { ChevronDown, Check } from 'lucide-react';
import { ToolbarDropdown } from './ToolbarDropdown';
import { useEditorUpdate } from '../../hooks/useEditorUpdate';
import { FONT_SIZES } from '../../constants/formatting';

interface FontSizeSelectProps {
  editor: Editor;
}

export function FontSizeSelect({ editor }: FontSizeSelectProps) {
  useEditorUpdate(editor);
  const current = editor.getAttributes('textStyle').fontSize as string | undefined;
  const currentLabel = current ? current.replace('px', '') : '16';

  return (
    <ToolbarDropdown
      panelClassName="font-menu"
      label="Font size"
      editor={editor}
      trigger={
        <span className="toolbar-select-label">
          {currentLabel}
          <ChevronDown size={14} className="dropdown-chevron" />
        </span>
      }
    >
      {close => (
        <>
          <button
            type="button"
            className={`block-menu-item${!current ? ' active' : ''}`}
            onClick={() => { editor.chain().focus().unsetFontSize().run(); close(); }}
          >
            <span>Default</span>
            {!current && <Check size={14} className="block-menu-check" />}
          </button>
          {FONT_SIZES.map(s => (
            <button
              key={s.value}
              type="button"
              className={`block-menu-item${current === s.value ? ' active' : ''}`}
              onClick={() => { editor.chain().focus().setFontSize(s.value).run(); close(); }}
            >
              <span>{s.label}</span>
              {current === s.value && <Check size={14} className="block-menu-check" />}
            </button>
          ))}
        </>
      )}
    </ToolbarDropdown>
  );
}
