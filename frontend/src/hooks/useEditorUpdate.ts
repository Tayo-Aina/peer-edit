import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';

/**
 * Force a re-render whenever the editor fires a transaction or selection
 * update, so `isActive()` / `getAttributes()` labels never go stale.
 */
export function useEditorUpdate(editor: Editor | null) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (!editor) return;
    const bump = () => force();
    editor.on('transaction', bump);
    editor.on('selectionUpdate', bump);
    return () => {
      editor.off('transaction', bump);
      editor.off('selectionUpdate', bump);
    };
  }, [editor]);
}
