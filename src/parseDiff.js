/**
 * Parses `git diff` output into structured file objects.
 * @param {string} rawDiffText
 * @returns {Array<{ path: string, addedLines: string[], removedLines: string[] }>}
 */
export function parseDiff(rawDiffText) {
  if (!rawDiffText || !rawDiffText.trim()) return [];

  const files = [];
  let current = null;

  for (const line of rawDiffText.split('\n')) {
    if (line.startsWith('diff --git ')) {
      if (current && current.path) files.push(current);
      current = { path: null, addedLines: [], removedLines: [] };
    } else if (line.startsWith('+++ ') && current) {
      const pathPart = line.slice(4);
      current.path = pathPart.startsWith('b/') ? pathPart.slice(2) : pathPart;
    } else if (line.startsWith('+') && !line.startsWith('+++') && current) {
      current.addedLines.push(line.slice(1));
    } else if (line.startsWith('-') && !line.startsWith('---') && current) {
      current.removedLines.push(line.slice(1));
    }
  }

  if (current && current.path) files.push(current);
  return files;
}
