import React from 'react';
import { Editor } from '@tiptap/react';
import { ChevronDown, Check } from 'lucide-react';
import { ToolbarDropdown } from './ToolbarDropdown';
import { useEditorUpdate } from '../../hooks/useEditorUpdate';
import { FONT_FAMILIES } from '../../constants/formatting';

interface FontFamilySelectProps {
  editor: Editor;
}

export function FontFamilySelect({ editor }: FontFamilySelectProps) {
  useEditorUpdate(editor);
  const current = editor.getAttributes('textStyle').fontFamily as string | undefined;
  const activeFamily = FONT_FAMILIES.find(f => f.value === current);

  return (
    <ToolbarDropdown
      panelClassName="font-menu"
      label="Font family"
      editor={editor}
      trigger={
        <span className="toolbar-select-label">
          {activeFamily?.label ?? 'Font'}
          <ChevronDown size={14} className="dropdown-chevron" />
        </span>
      }
    >
      {close => (
        <>
          <button
            type="button"
            className={`block-menu-item${!activeFamily ? ' active' : ''}`}
            onClick={() => { editor.chain().focus().unsetFontFamily().run(); close(); }}
          >
            <span>Default</span>
            {!activeFamily && <Check size={14} className="block-menu-check" />}
          </button>
          {FONT_FAMILIES.map(f => (
            <button
              key={f.value}
              type="button"
              className={`block-menu-item${activeFamily?.value === f.value ? ' active' : ''}`}
              style={{ fontFamily: f.value }}
              onClick={() => { editor.chain().focus().setFontFamily(f.value).run(); close(); }}
            >
              <span>{f.label}</span>
              {activeFamily?.value === f.value && <Check size={14} className="block-menu-check" />}
            </button>
          ))}
        </>
      )}
    </ToolbarDropdown>
  );
}
