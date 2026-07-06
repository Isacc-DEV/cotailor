/**
 * Normalize skills from any imported JSON shape into a flat string[].
 * Recursively descends so it handles:
 *  - string[]                                   -> ["Node.js", "React"]
 *  - {name}[] / {skill}[] / {label}[]           -> [{name:"Node.js"}] -> ["Node.js"]
 *  - categorized object                         -> {languages:["JS"]} -> ["JS"]
 *  - categorized object with items arrays       -> {backend:{category,items:[{name}]}} -> ["Node.js", ...]
 *  - comma-separated string                     -> "Node.js, React" -> ["Node.js","React"]
 */
export function normalizeSkills(raw: any): string[] {
  if (!raw) return [];

  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  const out: string[] = [];

  const visit = (node: any) => {
    if (!node) return;

    if (typeof node === 'string') {
      const s = node.trim();
      if (s) out.push(s);
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (typeof node === 'object') {
      // Leaf skill object: take its name and stop descending.
      const leaf = node.name ?? node.skill ?? node.label;
      if (typeof leaf === 'string') {
        const s = leaf.trim();
        if (s) out.push(s);
        return;
      }
      // Category object with an items array: descend only into items
      // (skip sibling fields like "category" so labels aren't treated as skills).
      if (Array.isArray(node.items)) {
        node.items.forEach(visit);
        return;
      }
      // Generic object: descend into all values.
      Object.values(node).forEach(visit);
      return;
    }
  };

  visit(raw);

  // De-duplicate while preserving order.
  return Array.from(new Set(out));
}
