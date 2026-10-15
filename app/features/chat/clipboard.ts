export async function chatImagePng(url: string): Promise<Blob> {
  const response = await fetch(url, { credentials: 'include', cache: 'no-store' });
  if (!response.ok) throw new Error('Image unavailable');
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image conversion unavailable');
    context.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image conversion failed')), 'image/png'));
  } finally { bitmap.close(); }
}

export function copyChatImage(url: string): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return Promise.reject(new Error('CLIPBOARD_UNSUPPORTED'));
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': chatImagePng(url) })]);
}

export function copyChatText(body: string): Promise<void> {
  if (!navigator.clipboard?.writeText) return Promise.reject(new Error('CLIPBOARD_UNSUPPORTED'));
  return navigator.clipboard.writeText(body);
}
