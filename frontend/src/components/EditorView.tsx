import React from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import CharacterCount from '@tiptap/extension-character-count';
import { Editor } from '@tiptap/core';
import { FontSize } from '../extensions/FontSize';
import { Pagination } from '../extensions/Pagination';
import { SlashCommand } from '../extensions/slash/SlashCommand';
import { FindReplace } from '../extensions/findReplace/FindReplace';
import { fileToDataUrl } from '../utils/images';
import { useCollaboration } from '../providers/CollaborationProvider';
import { Toolbar } from './Toolbar';
import { BubbleToolbar } from './BubbleToolbar';
import { StatusBar } from './StatusBar';
import { FindReplacePanel } from './FindReplacePanel';
import '../styles/overlays.css';

export function EditorView() {
  const { ydoc, provider, userName, color } = useCollaboration();

  // Ref mirror of the editor: handlePaste/handleDrop are configured once
  // inside useEditor (when `editor` is still null), so they must read the
  // live instance from here instead of closing over the stale variable.
  const editorRef = React.useRef<Editor | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // CRITICAL: Disable StarterKit's built-in undo/redo history.
        // Yjs manages its own undo/redo via the Collaboration extension.
        // Having both creates duplicate history stacks and syncing bugs.
        history: false,
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: { name: userName, color: color },
      }),
      Placeholder.configure({
        placeholder: 'Start typing collaboratively...',
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      // TextStyle must come before Color / FontFamily / FontSize — they all
      // extend the shared `textStyle` mark, which syncs as one mark via Yjs.
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Subscript,
      Superscript,
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      CharacterCount,
      Pagination,
      SlashCommand,
      FindReplace,
    ],
    editorProps: {
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!files.length) return false;
        let handled = false;
        for (const file of files) {
          const dataUrl = fileToDataUrl(file); // async — insert when ready
          if (dataUrl) {
            handled = true;
            dataUrl.then(src => {
              if (src) editorRef.current?.chain().focus().setImage({ src }).run();
            });
          }
        }
        return handled;
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (!files.length) return false;
        let handled = false;
        for (const file of files) {
          const dataUrl = fileToDataUrl(file);
          if (dataUrl) {
            handled = true;
            dataUrl.then(src => {
              if (!src) return;
              const ed = editorRef.current;
              if (!ed) return;
              const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
              if (coords) ed.chain().focus().insertContentAt(coords.pos, { type: 'image', attrs: { src } }).run();
              else ed.chain().focus().setImage({ src }).run();
            });
          }
        }
        return handled;
      },
    },
    // Do NOT set initial content. The Yjs document provides the content.
    // Setting content here would overwrite the shared Y.Doc on every mount.
    autofocus: true,
  }, [ydoc, provider, userName, color]);

  React.useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  return (
    <div className="editor-container">
      <Toolbar editor={editor} />
      {editor && <BubbleToolbar editor={editor} />}
      <div
        className="editor-content"
        onClick={e => {
          if ((e.target as HTMLElement).closest('button,a,input,table,img')) return;
          editor?.commands.focus();
        }}
      >
        <EditorContent editor={editor} />
      </div>
      {editor && <StatusBar editor={editor} />}
      {editor && <FindReplacePanel editor={editor} />}
    </div>
  );
}
