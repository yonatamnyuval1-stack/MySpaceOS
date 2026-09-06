function normRelPath(p) {
  return String(p || "")
    .replace(/\\/g, "/")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function isPathUnder(child, parent) {
  const c = normRelPath(child);
  const p = normRelPath(parent);
  if (!p || c === p) return false;
  return c.startsWith(p + "/");
}

function topLevelSubCategoryItems(items) {
  const list = (items || []).filter((i) => i && i.path);
  return list.filter(function (item, i) {
    return !list.some(function (other, j) {
      return j !== i && isPathUnder(item.path, other.path);
    });
  });
}

function countFilesInTreeNode(node) {
  if (!node) return 0;
  if (node.type === "file") return 1;
  if (node.fileCount != null) return Number(node.fileCount) || 0;
  return (node.children || []).reduce(function (sum, child) {
    return sum + countFilesInTreeNode(child);
  }, 0);
}

const api = { normRelPath, isPathUnder, topLevelSubCategoryItems, countFilesInTreeNode };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.PartsPathTree = api;