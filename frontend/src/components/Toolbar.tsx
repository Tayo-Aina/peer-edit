import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  Undo, Redo,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, CheckSquare,
  Quote, SquareTerminal,
  Subscript, Superscript, RemoveFormatting,
  ImagePlus, Minus, Search, ChevronDown, Download,
  SunMedium, Moon, Maximize2, Minimize2,
} from 'lucide-react';
import { BlockTypeSelect } from './toolbar/BlockTypeSelect';
import { FontFamilySelect } from './toolbar/FontFamilySelect';
import { FontSizeSelect } from './toolbar/FontSizeSelect';
import { ColorPopover } from './toolbar/ColorPopover';
import { TableMenu } from './toolbar/TableMenu';
import { LinkPopover } from './toolbar/LinkPopover';
import { fileToDataUrl } from '../utils/images';
import { exportToDocx } from '../utils/docxExport';
import { useEditorUpdate } from '../hooks/useEditorUpdate';
import { applyTheme, getTheme } from '../hooks/useTheme';
import { useFullscreen } from '../hooks/useFullscreen';
import '../styles/toolbar.css';

interface ToolbarProps {
  editor: Editor | null;
  /** Opens the File/Backstage place. */
  onOpenFileMenu?: () => void;
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
 * Hoisted + memoized so ribbon buttons never remount on every editor
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

/** Word ribbon group: controls on top, centered caption underneath. */
function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ribbon-group">
      <div className="ribbon-group-controls">{children}</div>
      <span className="ribbon-group-label">{label}</span>
    </div>
  );
}

/** One horizontal row of controls inside a group. */
function RibbonRow({ children }: { children: React.ReactNode }) {
  return <div className="ribbon-row">{children}</div>;
}

type RibbonTab = 'home' | 'insert' | 'review' | 'view';

const RIBBON_TABS: { id: RibbonTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'insert', label: 'Insert' },
  { id: 'review', label: 'Review' },
  { id: 'view', label: 'View' },
];

export function Toolbar({ editor, onOpenFileMenu }: ToolbarProps) {
  const [tab, setTab] = useState<RibbonTab>('home');
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState(() => getTheme());
  const { isFullscreen, toggleFullscreen } = useFullscreen();

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

  const handleExportDOCX = useCallback(() => {
    if (!editor) return;
    setExportOpen(false);
    void exportToDocx(editor).catch(err => {
      console.error('DOCX export failed:', err);
    });
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
  const charState = editor.storage.characterCount as
    | { words(): number; characters(): number }
    | undefined;
  const wordCount = charState ? charState.words() : 0;

  return (
    <div className="ribbon" role="toolbar" aria-label="Ribbon">
      {/* ---- Tab row: File entry + quick-access undo/redo + tabs, like Word ---- */}
      <div className="ribbon-top">
        <div className="ribbon-qat">
          <Button
            onClick={() => onOpenFileMenu?.()}
            icon={<span style={{ fontSize: 13, fontWeight: 600 }}>File</span>}
            title="File — open the Backstage (New, Open, Save, Export, Info, Share)"
          />
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
        <nav className="ribbon-tabs" role="tablist" aria-label="Ribbon tabs">
          {RIBBON_TABS.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`ribbon-tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ---- Tab body: groups with captions ---- */}
      {tab === 'home' && (
        <div className="ribbon-body" role="tabpanel" aria-label="Home ribbon">
          <RibbonGroup label="Font">
            <RibbonRow>
              <FontFamilySelect editor={editor} />
              <FontSizeSelect editor={editor} />
            </RibbonRow>
            <RibbonRow>
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
                onClick={() => editor.chain().focus().toggleSuperscript().run()}
                active={editor.isActive('superscript')}
                icon={<Superscript size={16} />}
                title="Superscript"
              />
              <Button
                onClick={() => editor.chain().focus().toggleSubscript().run()}
                active={editor.isActive('subscript')}
                icon={<Subscript size={16} />}
                title="Subscript"
              />
              <ColorPopover editor={editor} mode="text" />
              <ColorPopover editor={editor} mode="highlight" />
              <Button
                onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
                icon={<RemoveFormatting size={16} />}
                title="Clear formatting"
              />
            </RibbonRow>
          </RibbonGroup>

          <RibbonGroup label="Paragraph">
            <RibbonRow>
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
            </RibbonRow>
            <RibbonRow>
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
            </RibbonRow>
          </RibbonGroup>

          <RibbonGroup label="Styles">
            <RibbonRow>
              <BlockTypeSelect editor={editor} />
            </RibbonRow>
            <RibbonRow>
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
            </RibbonRow>
          </RibbonGroup>

          <RibbonGroup label="Editing">
            <RibbonRow>
              <Button
                onClick={() => window.dispatchEvent(new CustomEvent('peeredit:toggle-find'))}
                icon={<Search size={16} />}
                title="Find & Replace (Ctrl+F)"
              />
            </RibbonRow>
          </RibbonGroup>

          <RibbonGroup label="Export">
            <RibbonRow>
              <div className="toolbar-export" ref={exportRef}>
                <button
                  type="button"
                  className="toolbar-btn toolbar-dropdown-trigger"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => setExportOpen(o => !o)}
                  title="Export document"
                  aria-label="Export document"
                  aria-expanded={exportOpen}
                  aria-haspopup="menu"
                >
                  <Download size={16} />
                  <span className="toolbar-select-label">Export</span>
                  <ChevronDown size={14} className="dropdown-chevron" />
                </button>
                {exportOpen && (
                  <div className="export-menu" role="menu">
                    <button
                      type="button"
                      className="export-menu-item"
                      onClick={handleExportDOCX}
                    >
                      Export as Word (.docx)
                    </button>
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
            </RibbonRow>
          </RibbonGroup>
        </div>
      )}

      {tab === 'insert' && (
        <div className="ribbon-body" role="tabpanel" aria-label="Insert ribbon">
          <RibbonGroup label="Links">
            <RibbonRow>
              <LinkPopover editor={editor} />
            </RibbonRow>
          </RibbonGroup>

          <RibbonGroup label="Illustrations">
            <RibbonRow>
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
            </RibbonRow>
          </RibbonGroup>

          <RibbonGroup label="Tables">
            <RibbonRow>
              <TableMenu editor={editor} />
            </RibbonRow>
          </RibbonGroup>

          <RibbonGroup label="Elements">
            <RibbonRow>
              <Button
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                icon={<Minus size={16} />}
                title="Horizontal rule"
              />
            </RibbonRow>
          </RibbonGroup>
        </div>
      )}

      {tab === 'review' && (
        <div className="ribbon-body" role="tabpanel" aria-label="Review ribbon">
          <RibbonGroup label="Proofing">
            <RibbonRow>
              <Button
                onClick={() => window.dispatchEvent(new CustomEvent('peeredit:toggle-find'))}
                icon={<Search size={16} />}
                title="Find & Replace (Ctrl+F)"
              />
            </RibbonRow>
          </RibbonGroup>

          <RibbonGroup label="Word Count">
            <RibbonRow>
              <span className="ribbon-stat" title="Words in document">
                {wordCount.toLocaleString()} words
              </span>
            </RibbonRow>
          </RibbonGroup>
        </div>
      )}

      {tab === 'view' && (
        <div className="ribbon-body" role="tabpanel" aria-label="View ribbon">
          <RibbonGroup label="Appearance">
            <RibbonRow>
              <button
                type="button"
                className="toolbar-btn toolbar-dropdown-trigger"
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  const next = theme === 'dark' ? 'light' : 'dark';
                  applyTheme(next);
                  setTheme(next);
                }}
                title="Toggle dark mode"
                aria-label="Toggle dark mode"
              >
                {theme === 'dark' ? <SunMedium size={16} /> : <Moon size={16} />}
                <span className="toolbar-select-label">
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </span>
              </button>
            </RibbonRow>
          </RibbonGroup>

          <RibbonGroup label="Display">
            <RibbonRow>
              <button
                type="button"
                className="toolbar-btn toolbar-dropdown-trigger"
                onMouseDown={e => e.preventDefault()}
                onClick={toggleFullscreen}
                title="Toggle fullscreen"
                aria-label="Toggle fullscreen"
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                <span className="toolbar-select-label">
                  {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                </span>
              </button>
            </RibbonRow>
          </RibbonGroup>
        </div>
      )}
    </div>
  );
}
