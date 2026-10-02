declare module '*.css';
declare module '*.svg';

// TypeScript's own lib.dom.d.ts now declares FileSystemHandle,
// FileSystemFileHandle and FileSystemDirectoryHandle (including
// getFileHandle/removeEntry/createWritable), which made
// @types/wicg-file-system-access redundant - and worse than redundant, since
// the two would declare the same interfaces.
//
// Two things lib.dom still does not cover, so they are merged in here:
// the File System Access entry point, and the async directory iterator.

interface FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<
    FileSystemDirectoryHandle | FileSystemFileHandle
  >;
}

interface Window {
  showDirectoryPicker(options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: FileSystemHandle | string;
  }): Promise<FileSystemDirectoryHandle>;
}

// Only the env vars the app reads; pulling in vite/client instead would
// re-type every `*.svg` import as a URL string (see vite.config.ts).
interface ImportMeta {
  readonly env: { readonly VITE_API_BASE?: string };
}
