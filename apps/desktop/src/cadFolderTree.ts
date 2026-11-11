export type CadFolder = {
  id: string;
  name: string;
  parentId: string | null;
  revision: number;
  removed: boolean;
};

export function liveCadFolder(folders: Map<string, CadFolder>, id?: string | null): CadFolder | undefined {
  let folder = id ? folders.get(id) : undefined;
  const seen = new Set<string>();
  while (folder?.removed) {
    if (seen.has(folder.id)) return;
    seen.add(folder.id);
    folder = folder.parentId ? folders.get(folder.parentId) : undefined;
  }
  return folder;
}

export function cadFolderNames(folders: Map<string, CadFolder>, id: string) {
  const names: string[] = [];
  const seen = new Set<string>();
  let folder = liveCadFolder(folders, id);
  while (folder && !seen.has(folder.id)) {
    names.unshift(folder.name);
    seen.add(folder.id);
    folder = liveCadFolder(folders, folder.parentId);
  }
  return names;
}
