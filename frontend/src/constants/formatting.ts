export const TEXT_COLORS = [
  { label: 'Gray', value: '#6b7280' }, { label: 'Red', value: '#dc2626' },
  { label: 'Orange', value: '#ea580c' }, { label: 'Yellow', value: '#ca8a04' },
  { label: 'Green', value: '#16a34a' }, { label: 'Blue', value: '#2563eb' },
  { label: 'Purple', value: '#7c3aed' },
];
export const HIGHLIGHT_COLORS = [
  { label: 'Yellow', value: '#fef08a' }, { label: 'Green', value: '#bbf7d0' },
  { label: 'Blue', value: '#bfdbfe' }, { label: 'Pink', value: '#fbcfe8' },
  { label: 'Orange', value: '#fed7aa' }, { label: 'Purple', value: '#ddd6fe' },
];
export const FONT_FAMILIES = [
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
  { label: 'Courier New', value: "'Courier New', monospace" },
];
export const FONT_SIZES = [12, 14, 16, 18, 20, 24, 30, 36].map(n => ({ label: `${n}`, value: `${n}px` }));
