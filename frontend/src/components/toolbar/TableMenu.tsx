import React from 'react';
import { Editor } from '@tiptap/react';
import { TableProperties, Table as TableIcon, Rows2, Columns2, Trash2 } from 'lucide-react';
import { ToolbarDropdown } from './ToolbarDropdown';
import { useEditorUpdate } from '../../hooks/useEditorUpdate';

interface TableMenuProps {
  editor: Editor;
}

interface MenuRowProps {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}

function MenuRow({ icon, label, disabled, danger, onClick }: MenuRowProps) {
  return (
    <button
      type="button"
      className={`block-menu-item${danger ? ' danger' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="block-menu-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export function TableMenu({ editor }: TableMenuProps) {
  useEditorUpdate(editor);
  const inTable = editor.isActive('table');

  return (
    <ToolbarDropdown
      panelClassName="table-menu"
      label="Table"
      editor={editor}
      active={inTable}
      trigger={<TableProperties size={16} />}
    >
      {close => (
        <>
          <MenuRow
            icon={<TableIcon size={16} />}
            label="Insert table"
            disabled={!editor.can().insertTable({ rows: 3, cols: 3, withHeaderRow: true })}
            onClick={() => {
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
              close();
            }}
          />
          <MenuRow
            icon={<Rows2 size={16} />}
            label="Add row below"
            disabled={!inTable || !editor.can().addRowAfter()}
            onClick={() => { editor.chain().focus().addRowAfter().run(); }}
          />
          <MenuRow
            icon={<Trash2 size={16} />}
            label="Delete row"
            danger
            disabled={!inTable || !editor.can().deleteRow()}
            onClick={() => { editor.chain().focus().deleteRow().run(); close(); }}
          />
          <MenuRow
            icon={<Columns2 size={16} />}
            label="Add column after"
            disabled={!inTable || !editor.can().addColumnAfter()}
            onClick={() => { editor.chain().focus().addColumnAfter().run(); }}
          />
          <MenuRow
            icon={<Trash2 size={16} />}
            label="Delete column"
            danger
            disabled={!inTable || !editor.can().deleteColumn()}
            onClick={() => { editor.chain().focus().deleteColumn().run(); close(); }}
          />
          <MenuRow
            icon={<TableIcon size={16} />}
            label="Toggle header row"
            disabled={!inTable || !editor.can().toggleHeaderRow()}
            onClick={() => { editor.chain().focus().toggleHeaderRow().run(); close(); }}
          />
          <MenuRow
            icon={<Trash2 size={16} />}
            label="Delete table"
            danger
            disabled={!inTable || !editor.can().deleteTable()}
            onClick={() => { editor.chain().focus().deleteTable().run(); close(); }}
          />
        </>
      )}
    </ToolbarDropdown>
  );
}
