import React, { useState } from 'react';
import { Editor } from '@tiptap/react';
import { Link as LinkIcon, Unlink, ExternalLink } from 'lucide-react';
import { ToolbarDropdown } from './ToolbarDropdown';
import { useEditorUpdate } from '../../hooks/useEditorUpdate';

/** Prepend https:// when the user didn't type a scheme. */
function normalizeUrl(raw: string): string {
  const href = raw.trim();
  if (!href) return '';
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) ? href : `https://${href}`;
}

interface LinkFormProps {
  editor: Editor;
  close: () => void;
  compact?: boolean;
}

function LinkForm({ editor, close, compact }: LinkFormProps) {
  const [href, setHref] = useState<string>(
    () => (editor.getAttributes('link').href as string | undefined) ?? '',
  );

  const apply = () => {
    const url = normalizeUrl(href);
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      close();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    close();
    editor.commands.focus();
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    close();
    editor.commands.focus();
  };

  const openInBrowser = () => {
    const url = normalizeUrl(href) || ((editor.getAttributes('link').href as string | undefined) ?? '');
    if (url) window.open(url, '_blank', 'noopener');
  };

  return (
    <div className={`link-form${compact ? ' link-form-compact' : ''}`}>
      <input
        type="text"
        className="link-input"
        placeholder="Paste or type a link..."
        value={href}
        onChange={e => setHref(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            apply();
          }
          if (e.key === 'Escape') {
            e.stopPropagation();
            close();
            editor.commands.focus();
          }
        }}
        autoFocus
      />
      <div className="link-form-actions">
        <button type="button" className="link-action primary" onClick={apply}>
          Apply
        </button>
        <button
          type="button"
          className="link-action"
          onClick={remove}
          disabled={!editor.isActive('link')}
        >
          <Unlink size={14} /> Remove
        </button>
        <button type="button" className="link-action" onClick={openInBrowser}>
          <ExternalLink size={14} /> Open
        </button>
      </div>
    </div>
  );
}

interface LinkPopoverProps {
  editor: Editor;
  compact?: boolean;
}

export function LinkPopover({ editor, compact }: LinkPopoverProps) {
  useEditorUpdate(editor);
  return (
    <ToolbarDropdown
      active={editor.isActive('link')}
      panelClassName={compact ? 'link-menu link-menu-compact' : 'link-menu'}
      label="Link"
      editor={editor}
      trigger={<LinkIcon size={16} />}
    >
      {close => <LinkForm editor={editor} close={close} compact={compact} />}
    </ToolbarDropdown>
  );
}
