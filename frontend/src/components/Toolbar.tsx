import React, { useCallback } from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Highlighter,
  Undo, Redo,
  Heading1, Heading2, Heading3,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, CheckSquare,
  Quote, SquareTerminal, Link as LinkIcon
} from 'lucide-react';

interface ToolbarProps {
  editor: Editor | null;
}

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
}

export function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null;

  const Button = ({ onClick, active, disabled, icon, title }: ToolbarButtonProps) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`toolbar-btn ${active ? 'active' : ''}`}
      title={title}
    >
      {icon}
    </button>
  );

  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) {
      return; // cancelled
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <Button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          icon={<Undo size={16} />}
          title="Undo"
        />
        <Button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          icon={<Redo size={16} />}
          title="Redo"
        />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <Button
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          icon={<Bold size={16} />}
          title="Bold"
        />
        <Button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          icon={<Italic size={16} />}
          title="Italic"
        />
        <Button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          icon={<UnderlineIcon size={16} />}
          title="Underline"
        />
        <Button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          icon={<Strikethrough size={16} />}
          title="Strikethrough"
        />
        <Button
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          icon={<Code size={16} />}
          title="Code"
        />
        <Button
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          active={editor.isActive('highlight')}
          icon={<Highlighter size={16} />}
          title="Highlight"
        />
        <Button
          onClick={setLink}
          active={editor.isActive('link')}
          icon={<LinkIcon size={16} />}
          title="Link"
        />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <Button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          icon={<Heading1 size={16} />}
          title="Heading 1"
        />
        <Button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          icon={<Heading2 size={16} />}
          title="Heading 2"
        />
        <Button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          icon={<Heading3 size={16} />}
          title="Heading 3"
        />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <Button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })}
          icon={<AlignLeft size={16} />}
          title="Align Left"
        />
        <Button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })}
          icon={<AlignCenter size={16} />}
          title="Align Center"
        />
        <Button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })}
          icon={<AlignRight size={16} />}
          title="Align Right"
        />
        <Button
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          active={editor.isActive({ textAlign: 'justify' })}
          icon={<AlignJustify size={16} />}
          title="Justify"
        />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <Button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          icon={<List size={16} />}
          title="Bullet List"
        />
        <Button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          icon={<ListOrdered size={16} />}
          title="Ordered List"
        />
        <Button
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive('taskList')}
          icon={<CheckSquare size={16} />}
          title="Task List"
        />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <Button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          icon={<Quote size={16} />}
          title="Blockquote"
        />
        <Button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          icon={<SquareTerminal size={16} />}
          title="Code Block"
        />
      </div>
    </div>
  );
}
