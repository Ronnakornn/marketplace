/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyChatImage, copyChatText } from './clipboard';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('chat clipboard', () => {
  it('copies text verbatim and reports unsupported clipboard instead of copying a URL', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await copyChatText('First line\nไทย');
    expect(writeText).toHaveBeenCalledWith('First line\nไทย');
    await expect(copyChatImage('/api/private')).rejects.toThrow('CLIPBOARD_UNSUPPORTED');
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('starts the clipboard write in the user action and converts decoded image pixels to PNG', async () => {
    const png = new Blob(['png pixels'], { type: 'image/png' });
    const bitmap = { width: 25, height: 24, close: vi.fn() };
    const drawImage = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['jpeg pixels'], { type: 'image/jpeg' }) }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback, type) {
      expect(type).toBe('image/png');
      callback(png);
    });
    let content: Record<string, Promise<Blob>> = {};
    vi.stubGlobal('ClipboardItem', class { constructor(items: Record<string, Promise<Blob>>) { content = items; } });
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { write } });
    const copied = copyChatImage('/api/private?scope=buyer');
    expect(write).toHaveBeenCalledOnce();
    await copied;
    expect(await content['image/png']).toBe(png);
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0);
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith('/api/private?scope=buyer', { credentials: 'include', cache: 'no-store' });
  });
});
