import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Highlighter,
  Undo, Redo,
  Heading1, Heading2, Heading3,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, CheckSquare,
  Quote, SquareTerminal, Link as LinkIcon,
  Download,
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

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function Toolbar({ editor }: ToolbarProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close export dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    if (exportOpen) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [exportOpen]);

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
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const handleExportHTML = useCallback(() => {
    const html = editor.getHTML();
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadBlob(
      `<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"><title>PeerEdit Export</title></head>\n<body>\n${html}\n</body>\n</html>`,
      `peeredit-${ts}.html`,
      'text/html',
    );
    setExportOpen(false);
  }, [editor]);

  const handleExportTXT = useCallback(() => {
    const text = editor.getText();
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadBlob(text, `peeredit-${ts}.txt`, 'text/plain');
    setExportOpen(false);
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

      {/* Spacer pushes export to the right */}
      <div className="toolbar-spacer" />

      {/* Export dropdown */}
      <div className="toolbar-group toolbar-export" ref={exportRef}>
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => setExportOpen(!exportOpen)}
          title="Export document"
        >
          <Download size={16} />
        </button>
        {exportOpen && (
          <div className="export-menu">
            <button
              type="button"
              className="export-menu-item"
              onClick={handleExportHTML}
            >
              Export as HTML
            </button>
            <button
              type="button"
              className="export-menu-item"
              onClick={handleExportTXT}
            >
              Export as Plain Text
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
