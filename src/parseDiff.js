/**
 * Parses `git diff` output into structured file objects.
 *
 * Handles: multi-file and multi-hunk diffs, added/modified/deleted/renamed
 * files, `\ No newline at end of file` markers, and binary file headers.
 *
 * @param {string} rawDiffText
 * @returns {Array<{ path: string, addedLines: string[], removedLines: string[], status: string }>}
 */
export function parseDiff(rawDiffText) {
  if (!rawDiffText || !rawDiffText.trim()) return [];

  const files = [];
  let current = null;

  const finalize = () => {
    if (!current) return;
    // Resolve the path: prefer the new path, fall back to old path (deletions).
    const path = current.newPath || current.oldPath;
    if (path) {
      files.push({
        path,
        addedLines: current.addedLines,
        removedLines: current.removedLines,
        status: current.status,
      });
    }
    current = null;
  };

  for (const line of rawDiffText.split('\n')) {
    if (line.startsWith('diff --git ')) {
      finalize();
      current = {
        oldPath: null,
        newPath: null,
        status: 'modified',
        addedLines: [],
        removedLines: [],
      };
    } else if (!current) {
      continue;
    } else if (line.startsWith('rename from ')) {
      current.oldPath = line.slice('rename from '.length);
      current.status = 'renamed';
    } else if (line.startsWith('rename to ')) {
      current.newPath = line.slice('rename to '.length);
      current.status = 'renamed';
    } else if (line.startsWith('new file mode')) {
      current.status = 'added';
    } else if (line.startsWith('deleted file mode')) {
      current.status = 'deleted';
    } else if (line.startsWith('--- ')) {
      const p = stripPrefix(line.slice(4));
      if (p !== null) current.oldPath = p;
    } else if (line.startsWith('+++ ')) {
      const p = stripPrefix(line.slice(4));
      if (p !== null) current.newPath = p;
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      current.addedLines.push(line.slice(1));
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      current.removedLines.push(line.slice(1));
    }
    // lines starting with ' ', '@', '\', 'index', 'Binary', etc. are ignored
  }

  finalize();
  return files;
}

/** Strip the a//b/ prefix from a ---/+++ path; return null for /dev/null. */
function stripPrefix(raw) {
  const p = raw.trim();
  if (p === '/dev/null') return null;
  if (p.startsWith('a/') || p.startsWith('b/')) return p.slice(2);
  return p;
}
