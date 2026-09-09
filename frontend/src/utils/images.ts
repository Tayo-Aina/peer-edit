const MAX_DIM = 1600;
const MAX_BYTES = 5 * 1024 * 1024;

/** Read an image file to a (possibly downscaled) data-URL. Rejects >5MB or unreadable files. */
export function fileToDataUrl(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/') || file.size > MAX_BYTES) return Promise.resolve(null);
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onload = () => {
        if (img.width <= MAX_DIM && img.height <= MAX_DIM) return resolve(src);
        const scale = Math.min(MAX_DIM / img.width, MAX_DIM / img.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85));
      };
      img.onerror = () => resolve(null);
      img.src = src;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
