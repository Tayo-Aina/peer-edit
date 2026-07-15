import React from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Placeholder from '@tiptap/extension-placeholder';
import { useCollaboration } from '../providers/CollaborationProvider';
import { Toolbar } from './Toolbar';

export function EditorView() {
  const { ydoc, provider, userName, color } = useCollaboration();

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
    ],
    // Do NOT set initial content. The Yjs document provides the content.
    // Setting content here would overwrite the shared Y.Doc on every mount.
    autofocus: true,
  }, [ydoc, provider, userName, color]);

  return (
    <div className="editor-container">
      <Toolbar editor={editor} />
      <div className="editor-content">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
