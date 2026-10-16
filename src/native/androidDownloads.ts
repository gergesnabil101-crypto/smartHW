import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// Android WebView ignores <a download> links (Excel/PDF/QR exports), so on the native app
// the file is written to the cache directory and handed to the system share sheet.
const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const saveAndShare = async (href: string, filename: string) => {
  try {
    const blob = await (await fetch(href)).blob();
    const safeName = (filename || `file-${Date.now()}`).replace(/[\\/:*?"<>|]/g, '_');
    const { uri } = await Filesystem.writeFile({
      path: safeName,
      data: await blobToBase64(blob),
      directory: Directory.Cache
    });
    await Share.share({ title: safeName, url: uri, dialogTitle: safeName });
  } catch (err) {
    console.warn('Native download notice:', err);
  }
};

const isDownloadAnchor = (el: HTMLAnchorElement) =>
  el.hasAttribute('download') && /^(blob:|data:)/.test(el.href || '');

export function installNativeDownloadHandler() {
  if (!Capacitor.isNativePlatform()) return;

  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    if (isDownloadAnchor(this)) {
      void saveAndShare(this.href, this.download);
      return;
    }
    return originalClick.call(this);
  };

  const originalDispatch = HTMLAnchorElement.prototype.dispatchEvent;
  HTMLAnchorElement.prototype.dispatchEvent = function (this: HTMLAnchorElement, event: Event) {
    if (event.type === 'click' && isDownloadAnchor(this)) {
      void saveAndShare(this.href, this.download);
      return false;
    }
    return originalDispatch.call(this, event);
  };

  document.addEventListener('click', (event) => {
    const anchor = (event.target as HTMLElement | null)?.closest?.('a');
    if (anchor && isDownloadAnchor(anchor as HTMLAnchorElement)) {
      event.preventDefault();
      void saveAndShare((anchor as HTMLAnchorElement).href, (anchor as HTMLAnchorElement).download);
    }
  }, true);
}
