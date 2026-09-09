/**
 * Theme switching via the `data-theme` attribute on <html>. All component
 * colors consume CSS variables (see global.css), so flipping the attribute
 * re-skins the entire app — including tippy popovers, which inherit the
 * variables from :root. Never inject <style> elements for this (see the
 * second-window guard at the top of global.css).
 */

export type Theme = 'light' | 'dark';

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('peeredit-theme', theme);
}

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function initTheme() {
  applyTheme((localStorage.getItem('peeredit-theme') as Theme) ?? 'light');
}
