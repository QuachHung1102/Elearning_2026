/** Reject malformed byte ranges or a request with no satisfiable ranges. */
export function unsatisfiableVideoRange(header: string | null, size: number): boolean {
  const value = header?.trim() ?? "";
  if (!value.startsWith("bytes=")) return false;
  const ranges = value.slice(6).split(",").map((part) => /^\s*(\d*)-(\d*)\s*$/.exec(part));
  if (ranges.some((range) => !range || (!range[1] && !range[2]))) return true;
  return ranges.every((range) => {
    if (!range) return true;
    if (!range[1]) return size === 0 || Number(range[2]) === 0;
    return Number(range[1]) >= size || (range[2] !== "" && Number(range[2]) < Number(range[1]));
  });
}
