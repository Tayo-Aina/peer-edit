import React from 'react';
import { Editor } from '@tiptap/react';

interface ToolbarProps {
  editor: Editor | null;
}

interface ToolbarButtonProps {
  onClick: () => void;
  active: boolean;
  label: string;
}

export function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null;

  const Button = ({ onClick, active, label }: ToolbarButtonProps) => (
    <button
      type="button"
      onClick={onClick}
      className={`toolbar-btn ${active ? 'active' : ''}`}
    >
      {label}
    </button>
  );

  return (
    <div className="toolbar">
      <Button
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        label="B"
      />
      <Button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        label="I"
      />
      <Button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        label="S"
      />
      <Button
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        label="&lt;/&gt;"
      />
      <span className="toolbar-sep" />
      <Button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        label="H1"
      />
      <Button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        label="H2"
      />
      <Button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        label="H3"
      />
      <span className="toolbar-sep" />
      <Button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        label="• List"
      />
      <Button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        label="1. List"
      />
      <Button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        label="Quote"
      />
      <Button
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        label="Code"
      />
    </div>
  );
}
