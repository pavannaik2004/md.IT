import { describe, expect, it } from 'vitest';
import { ancestorFolderIds, descendantFolderIds } from './hierarchy';

const folders = [
  { id: 'a', parentFolderId: null },
  { id: 'b', parentFolderId: 'a' },
  { id: 'c', parentFolderId: 'b' },
  { id: 'd', parentFolderId: null },
];

describe('hierarchy', () => {
  it('lists every descendant of a folder', () => {
    expect(descendantFolderIds(folders, 'a').sort()).toEqual(['b', 'c']);
    expect(descendantFolderIds(folders, 'c')).toEqual([]);
  });

  it('lists a folder and its ancestors, nearest first', () => {
    expect(ancestorFolderIds(folders, 'c')).toEqual(['c', 'b', 'a']);
    expect(ancestorFolderIds(folders, null)).toEqual([]);
  });

  it('stops on a corrupted cycle instead of looping forever', () => {
    const cyclic = [
      { id: 'x', parentFolderId: 'y' },
      { id: 'y', parentFolderId: 'x' },
    ];
    expect(ancestorFolderIds(cyclic, 'x')).toEqual(['x', 'y']);
  });
});
