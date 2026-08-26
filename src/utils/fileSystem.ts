export const getDirectoryHandle =
  async (): Promise<FileSystemDirectoryHandle> => {
    return await window.showDirectoryPicker();
  };

export const getDirectoryEntries = async (
  handle: FileSystemDirectoryHandle
): Promise<Array<FileSystemDirectoryHandle | FileSystemFileHandle>> => {
  const entries = [];
  for await (const entry of handle.values()) {
    entries.push(entry);
  }
  return entries;
};

export const writeFile = async (
  dirHandle: FileSystemDirectoryHandle,
  name: string,
  content: string | Blob
): Promise<FileSystemFileHandle> => {
  const newFileHandle = await dirHandle.getFileHandle(name, {
    create: true,
  });
  const writable = await newFileHandle.createWritable();
  await writable.write(content);
  await writable.close();
  return newFileHandle;
};

export const deleteFile = async (
  dirHandle: FileSystemDirectoryHandle,
  name: string
): Promise<string> => {
  await dirHandle.removeEntry(name);
  return name;
};
