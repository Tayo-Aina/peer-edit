import React from 'react';
import { Editor } from '@tiptap/react';
import {
  Pilcrow, Heading1, Heading2, Heading3, List, ListOrdered, ListTodo,
  TextQuote, SquareTerminal, ChevronDown, Check,
} from 'lucide-react';
import { ToolbarDropdown } from './ToolbarDropdown';
import { useEditorUpdate } from '../../hooks/useEditorUpdate';

interface BlockTypeSelectProps {
  editor: Editor;
}

interface BlockItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  isActive: () => boolean;
  run: () => void;
}

/** Order in which the trigger label is resolved when several blocks match. */
const PRIORITY = [
  'codeBlock', 'blockquote', 'taskList', 'bulletList', 'orderedList',
  'heading1', 'heading2', 'heading3', 'paragraph',
];

export function BlockTypeSelect({ editor }: BlockTypeSelectProps) {
  useEditorUpdate(editor);
  const items: BlockItem[] = [
    {
      id: 'paragraph', label: 'Paragraph', icon: <Pilcrow size={16} />,
      isActive: () => editor.isActive('paragraph'),
      run: () => editor.chain().focus().clearNodes().run(),
    },
    {
      id: 'heading1', label: 'Heading 1', icon: <Heading1 size={16} />,
      isActive: () => editor.isActive('heading', { level: 1 }),
      run: () => editor.chain().focus().clearNodes().toggleHeading({ level: 1 }).run(),
    },
    {
      id: 'heading2', label: 'Heading 2', icon: <Heading2 size={16} />,
      isActive: () => editor.isActive('heading', { level: 2 }),
      run: () => editor.chain().focus().clearNodes().toggleHeading({ level: 2 }).run(),
    },
    {
      id: 'heading3', label: 'Heading 3', icon: <Heading3 size={16} />,
      isActive: () => editor.isActive('heading', { level: 3 }),
      run: () => editor.chain().focus().clearNodes().toggleHeading({ level: 3 }).run(),
    },
    {
      id: 'bulletList', label: 'Bullet list', icon: <List size={16} />,
      isActive: () => editor.isActive('bulletList'),
      run: () => editor.chain().focus().clearNodes().toggleBulletList().run(),
    },
    {
      id: 'orderedList', label: 'Numbered list', icon: <ListOrdered size={16} />,
      isActive: () => editor.isActive('orderedList'),
      run: () => editor.chain().focus().clearNodes().toggleOrderedList().run(),
    },
    {
      id: 'taskList', label: 'Task list', icon: <ListTodo size={16} />,
      isActive: () => editor.isActive('taskList'),
      run: () => editor.chain().focus().clearNodes().toggleTaskList().run(),
    },
    {
      id: 'blockquote', label: 'Quote', icon: <TextQuote size={16} />,
      isActive: () => editor.isActive('blockquote'),
      run: () => editor.chain().focus().clearNodes().toggleBlockquote().run(),
    },
    {
      id: 'codeBlock', label: 'Code block', icon: <SquareTerminal size={16} />,
      isActive: () => editor.isActive('codeBlock'),
      run: () => editor.chain().focus().clearNodes().toggleCodeBlock().run(),
    },
  ];

  const current =
    PRIORITY.map(id => items.find(i => i.id === id)!).find(i => i.isActive()) ?? items[0];

  return (
    <ToolbarDropdown
      panelClassName="block-menu"
      label="Block type"
      editor={editor}
      trigger={
        <span className="toolbar-select-label">
          {current.icon}
          {current.label}
          <ChevronDown size={14} className="dropdown-chevron" />
        </span>
      }
    >
      {close => (
        <>
          {items.map(item => (
            <button
              key={item.id}
              type="button"
              className={`block-menu-item${item.isActive() ? ' active' : ''}`}
              onClick={() => { item.run(); close(); }}
            >
              <span className="block-menu-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.isActive() && <Check size={14} className="block-menu-check" />}
            </button>
          ))}
        </>
      )}
    </ToolbarDropdown>
  );
}
