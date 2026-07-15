const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA',
  '#F1948A', '#AED6F1', '#D7BDE2', '#A3E4D7',
];

export function getUserColor(clientId: number): string {
  return COLORS[clientId % COLORS.length];
}
