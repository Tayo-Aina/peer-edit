import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  Undo, Redo,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, CheckSquare,
  Quote, SquareTerminal,
  Subscript, Superscript, RemoveFormatting,
  ImagePlus, Minus, Search,
  Download,
} from 'lucide-react';
import { BlockTypeSelect } from './toolbar/BlockTypeSelect';
import { FontFamilySelect } from './toolbar/FontFamilySelect';
import { FontSizeSelect } from './toolbar/FontSizeSelect';
import { ColorPopover } from './toolbar/ColorPopover';
import { TableMenu } from './toolbar/TableMenu';
import { LinkPopover } from './toolbar/LinkPopover';
import { fileToDataUrl } from '../utils/images';
import { useEditorUpdate } from '../hooks/useEditorUpdate';
import '../styles/toolbar.css';

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

/**
 * Hoisted + memoized so toolbar buttons never remount on every editor
 * transaction. onMouseDown preventDefault keeps ProseMirror selection intact;
 * the actual command stays on onClick with chain().focus().
 */
const ToolbarButton = React.memo(function ToolbarButton({
  onClick,
  active,
  disabled,
  icon,
  title,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={e => {
        if ((e.target as HTMLElement).closest('input,textarea')) return;
        e.preventDefault();
      }}
      onClick={onClick}
      disabled={disabled}
      className={`toolbar-btn ${active ? 'active' : ''}`}
      title={title}
      aria-label={title}
    >
      {icon}
    </button>
  );
});

export function Toolbar({ editor }: ToolbarProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Live active-states: re-render on every transaction / selection change.
  useEditorUpdate(editor);

  // Close export dropdown on outside click + Escape.
  useEffect(() => {
    if (!exportOpen) return;
    function handleDown(e: MouseEvent | TouchEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setExportOpen(false);
    }
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('touchstart', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('touchstart', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [exportOpen]);

  const handleExportHTML = useCallback(() => {
    if (!editor) return;
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
    if (!editor) return;
    const text = editor.getText();
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadBlob(text, `peeredit-${ts}.txt`, 'text/plain');
    setExportOpen(false);
  }, [editor]);

  const handleImagePick = useCallback(() => {
    const file = imageInputRef.current?.files?.[0];
    if (!file || !editor) return;
    fileToDataUrl(file).then(src => {
      if (src) editor.chain().focus().setImage({ src }).run();
    });
    if (imageInputRef.current) imageInputRef.current.value = '';
  }, [editor]);

  if (!editor) return null;

  const Button = ToolbarButton;

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting toolbar">
      {/* 1. History */}
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

      {/* 2. Marks + link */}
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
        <LinkPopover editor={editor} />
      </div>

      <div className="toolbar-divider" />

      {/* 3. Block + fonts */}
      <div className="toolbar-group">
        <BlockTypeSelect editor={editor} />
        <FontFamilySelect editor={editor} />
        <FontSizeSelect editor={editor} />
      </div>

      <div className="toolbar-divider" />

      {/* 4. Colors + sub/superscript + clear */}
      <div className="toolbar-group">
        <ColorPopover editor={editor} mode="text" />
        <ColorPopover editor={editor} mode="highlight" />
        <Button
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          active={editor.isActive('subscript')}
          icon={<Subscript size={16} />}
          title="Subscript"
        />
        <Button
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          active={editor.isActive('superscript')}
          icon={<Superscript size={16} />}
          title="Superscript"
        />
        <Button
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          icon={<RemoveFormatting size={16} />}
          title="Clear formatting"
        />
      </div>

      <div className="toolbar-divider" />

      {/* 5. Align + lists + table + media */}
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
        <TableMenu editor={editor} />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="visually-hidden"
          aria-label="Insert image"
          onChange={handleImagePick}
        />
        <Button
          onClick={() => imageInputRef.current?.click()}
          icon={<ImagePlus size={16} />}
          title="Insert image"
        />
        <Button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          icon={<Minus size={16} />}
          title="Horizontal rule"
        />
        <Button
          onClick={() => window.dispatchEvent(new CustomEvent('peeredit:toggle-find'))}
          icon={<Search size={16} />}
          title="Find & Replace (Ctrl+F)"
        />
      </div>

      {/* Spacer pushes export to the right */}
      <div className="toolbar-spacer" />

      {/* 6. Export dropdown */}
      <div className="toolbar-group toolbar-export" ref={exportRef}>
        <button
          type="button"
          className="toolbar-btn"
          onMouseDown={e => e.preventDefault()}
          onClick={() => setExportOpen(o => !o)}
          title="Export document"
          aria-label="Export document"
          aria-expanded={exportOpen}
          aria-haspopup="menu"
        >
          <Download size={16} />
        </button>
        {exportOpen && (
          <div className="export-menu" role="menu">
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
