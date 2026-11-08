export type DiffLineType = 'hunk' | 'add' | 'del' | 'ctx' | 'meta'

export interface DiffLine {
  type: DiffLineType
  text: string
  old?: number
  new?: number
}

/** Parses a unified diff `patch` (as returned for PR/commit files) into numbered lines. */
export function parsePatch(patch: string): DiffLine[] {
  const out: DiffLine[] = []
  let o = 0
  let n = 0
  for (const line of patch.split('\n')) {
    if (line.startsWith('@@')) {
      const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
      if (m) {
        o = Number(m[1])
        n = Number(m[2])
      }
      out.push({ type: 'hunk', text: line })
    } else if (line.startsWith('+')) out.push({ type: 'add', text: line.slice(1), new: n++ })
    else if (line.startsWith('-')) out.push({ type: 'del', text: line.slice(1), old: o++ })
    else if (line.startsWith('\\')) out.push({ type: 'meta', text: line })
    else out.push({ type: 'ctx', text: line.slice(1), old: o++, new: n++ })
  }
  return out
}
