// "CODE - Name" for showing a stock item; falls back to whichever part exists.
export function stockLabel(code, name) {
  if (code && name) return `${code} - ${name}`;
  return code || name || "";
}
