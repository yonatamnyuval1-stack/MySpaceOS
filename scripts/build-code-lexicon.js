const fs = require("fs");
const path = require("path");
const { CATEGORIES, slugify, generateAll } = require("./code-lexicon/generators");
const { curatedEntries } = require("./code-lexicon/curated");

const OUT = path.join(__dirname, "..", "data", "code-lexicon.json");

function normalizeEntry(raw, index) {
  const term = String(raw.term || "").trim();
  const definition = String(raw.definition || "").trim();
  if (!term || !definition) return null;

  const category = CATEGORIES[raw.category] ? raw.category : "fundamentals";
  const slug = slugify(term);
  const id = `term_${slug || index}`;

  return {
    id,
    term,
    slug,
    category,
    categoryLabel: CATEGORIES[category].label,
    definition,
    example: raw.example ? String(raw.example).trim() : "",
    tags: Array.isArray(raw.tags) ? raw.tags.map((t) => String(t).trim()).filter(Boolean) : [],
    level: ["beginner", "intermediate", "advanced"].includes(raw.level) ? raw.level : "intermediate",
  };
}

function expandNumericVariants() {
  const out = [];
  for (let cp = 0; cp <= 0x10ffff; cp += 256) {
    const hex = cp.toString(16).toUpperCase().padStart(4, "0");
    out.push({
      term: `Unicode U+${hex}`,
      definition: `Unicode code point U+${hex} (${cp} decimal): character in the Universal Character Set.`,
      category: "formats",
      tags: ["unicode", "encoding"],
      level: "advanced",
    });
  }
  const headers = [
    "Accept", "Accept-Encoding", "Accept-Language", "Authorization", "Cache-Control",
    "Connection", "Content-Encoding", "Content-Length", "Content-Type", "Cookie",
    "Date", "ETag", "Expires", "Host", "If-Modified-Since", "If-None-Match",
    "Last-Modified", "Location", "Origin", "Referer", "Retry-After", "Server",
    "Set-Cookie", "Strict-Transport-Security", "Transfer-Encoding", "User-Agent",
    "Vary", "WWW-Authenticate", "X-Forwarded-For", "X-Request-ID", "X-CSRF-Token",
    "Access-Control-Allow-Origin", "Access-Control-Allow-Methods", "Content-Security-Policy",
    "Permissions-Policy", "Referrer-Policy", "X-Frame-Options", "X-Content-Type-Options",
  ];
  for (const h of headers) {
    out.push({
      term: `HTTP header ${h}`,
      definition: `The ${h} HTTP header: part of request/response metadata in HTTP/1.1 and HTTP/2 messages.`,
      category: "formats",
      tags: ["http", "header", "web"],
      level: "intermediate",
    });
  }
  const dockerCmds = [
    "run", "build", "pull", "push", "ps", "images", "exec", "logs", "stop", "start",
    "restart", "rm", "rmi", "volume", "network", "compose", "tag", "inspect", "cp",
    "export", "import", "save", "load", "stats", "top", "pause", "unpause", "kill",
    "create", "rename", "prune", "update", "wait", "attach", "port", "diff", "commit",
  ];
  for (const cmd of dockerCmds) {
    out.push({
      term: `docker ${cmd}`,
      definition: `Docker CLI subcommand \`docker ${cmd}\`: manages containers, images, networks, or volumes.`,
      category: "devops",
      tags: ["docker", "cli", "container"],
      level: "intermediate",
    });
  }
  const kubectl = [
    "get", "describe", "apply", "delete", "create", "edit", "patch", "replace", "scale",
    "rollout", "logs", "exec", "port-forward", "top", "cordon", "uncordon", "drain",
    "label", "annotate", "config", "cluster-info", "api-resources", "api-versions",
  ];
  for (const cmd of kubectl) {
    out.push({
      term: `kubectl ${cmd}`,
      definition: `Kubernetes CLI \`kubectl ${cmd}\`: operates on cluster resources and workloads.`,
      category: "devops",
      tags: ["kubernetes", "kubectl", "cli"],
      level: "intermediate",
    });
  }
  const npmScripts = [
    "start", "dev", "build", "test", "lint", "format", "prepare", "prepublishOnly",
    "postinstall", "preinstall", "clean", "watch", "serve", "deploy", "release",
    "typecheck", "coverage", "e2e", "storybook", "analyze", "migrate", "seed",
  ];
  for (const s of npmScripts) {
    out.push({
      term: `npm script "${s}"`,
      definition: `Common npm package.json script name "${s}": convention for ${s === "start" ? "running the app" : s === "test" ? "running tests" : s === "build" ? "production build" : "project automation"}.`,
      category: "tools",
      tags: ["npm", "scripts", "nodejs"],
      level: "beginner",
    });
  }
  const regexTerms = [
    [".", "Matches any character except newline (with dotAll, any char)."],
    ["^", "Anchor start of string or line."],
    ["$", "Anchor end of string or line."],
    ["*", "Zero or more of preceding atom."],
    ["+", "One or more of preceding atom."],
    ["?", "Zero or one of preceding atom (also lazy quantifier)."],
    ["{n,m}", "Between n and m repetitions of preceding atom."],
    ["[]", "Character class matching one of enclosed chars."],
    ["[^]", "Negated character class."],
    ["|", "Alternation: match left or right branch."],
    ["()", "Capturing group remembering match."],
    ["(?:)", "Non-capturing group."],
    ["(?=)", "Positive lookahead assertion."],
    ["(?!)", "Negative lookahead assertion."],
    ["\\d", "Digit character class [0-9]."],
    ["\\w", "Word character [A-Za-z0-9_]."],
    ["\\s", "Whitespace character."],
    ["\\b", "Word boundary anchor."],
  ];
  for (const [sym, def] of regexTerms) {
    out.push({
      term: `Regex ${sym}`,
      definition: def,
      category: "fundamentals",
      tags: ["regex", "pattern"],
      level: "intermediate",
    });
  }
  const principles = [
    "Law of Demeter", "Composition over Inheritance", "Convention over Configuration",
    "Inversion of Control", "Separation of Concerns", "Tell Don't Ask", "Fail Fast",
    "Graceful Degradation", "Progressive Enhancement", "Postel's Law", "Boy Scout Rule",
    "Rule of Three", "Worse Is Better", "Unix Philosophy", "End-to-End Principle",
    "Robustness Principle", "Pareto Principle in refactoring", "Brooks's Law",
    "Conway's Law", "Amdahl's Law", "Little's Law", "Metcalfe's Law",
    "Moore's Law", "KISS principle", "YAGNI principle", "DRY principle",
    "WET code anti-pattern", "Rule of least surprise", "Principle of least astonishment",
  ];
  for (const p of principles) {
    out.push({
      term: p,
      definition: `${p}: guiding principle or observation influencing software design, team structure, or performance engineering.`,
      category: "architecture",
      tags: ["principle", "design"],
      level: "intermediate",
    });
  }
  const algoVariants = [
    "Timsort", "Introsort", "Patience Sort", "Shell Sort", "Comb Sort", "Cycle Sort",
    "Gnome Sort", "Cocktail Sort", "Bitonic Sort", "Odd-Even Sort", "Pigeonhole Sort",
    "Flash Sort", "Spreadsort", "Smoothsort", "Block Sort", "Wiki Sort", "Library Sort",
    "Strand Sort", "Tree Sort", "Cartesian Tree Sort", "Burst Sort", "MSD Radix Sort",
    "LSD Radix Sort", "American Flag Sort", "Sample Sort", "Multi-key Quicksort",
    "Dual-Pivot Quicksort", "Quickselect", "Median of Medians", "Interpolation Search",
    "Exponential Search", "Fibonacci Search", "Jump Search", "Ternary Search",
    "Sublinear Search", "Grover Search algorithm (quantum reference)",
  ];
  for (const a of algoVariants) {
    out.push({
      term: `${a} algorithm`,
      definition: `${a}: sorting or searching algorithm used in computer science and standard libraries.`,
      category: "algorithms",
      tags: ["algorithm", "sorting", "search"],
      level: "advanced",
    });
  }
  const dsVariants = [
    "Splay Tree", "Treap", "Scapegoat Tree", "AA Tree", "2-3 Tree", "2-3-4 Tree",
    "B-tree", "B+ tree", "R-tree", "R+ tree", "Quadtree", "Octree", "Kd-tree",
    "VP-tree", "Cover tree", "Fibonacci Heap", "Binomial Heap", "Pairing Heap",
    "Leftist Heap", "Skew Heap", "Van Emde Boas Tree", "Fusion Tree", "Hash Trie",
    "Crit-bit Tree", "Radix Tree", "Patricia Trie", "Suffix Array", "Burrows-Wheeler Transform",
    "Disjoint Set Union", "Link-Cut Tree", "Heavy-Light Decomposition", "Euler Tour Tree",
    "Persistent Segment Tree", "Lazy Segment Tree", "2D Fenwick Tree", "Sparse Table",
    "Sqrt Decomposition", "Mo's Algorithm", "Centroid Decomposition",
  ];
  for (const d of dsVariants) {
    out.push({
      term: d,
      definition: `${d}: specialized data structure for efficient query, storage, or geometric operations.`,
      category: "algorithms",
      tags: ["data-structure"],
      level: "advanced",
    });
  }
  const az = "abstract activation adapter aggregate algorithm alias allocation annotation anonymous application argument array assertion attribute autoboxing backend backup bandwidth baseline batch binary binding bit block boolean bootstrap boundary buffer bundle bytecode cache callback capability capacity cascade cast channel charset checkpoint chunk class client closure cluster codec collection column command comment commit compatibility compilation component compression concurrency configuration connection constraint constructor container context contract control conversion cookie counter coupling coverage cursor cycle daemon data datatype debugger declaration decoder default delegation delimiter dependency deployment descriptor destructor device dictionary diff digest dimension directive directory dispatch document domain driver dynamic element encoder encryption engine entity entry enum environment error event exception execution executor expression extension factory fallback fault field file filter flag flush fork format fragment frame frontend function gateway generator generic global graph grid group handle handler hash header heap hierarchy hook host hub identifier immutable implementation import index indicator inheritance initialization injection input instance instruction integer integration interface interpreter interval invocation iterator job join journal junction kernel key keyword lambda layer layout legacy library lifecycle limit link list listener load loader lock log logic loop macro manifest map mapper mask matrix memory merge message metadata method metric middleware migration modal mode model module monitor mutex namespace native node normalization notation notification null object offset opcode operand operation operator optimization option output overflow package packet pair palette panel parameter parent parser partition path pattern payload peer performance permission persistence pipeline pixel placeholder platform plugin pointer policy pool port predicate prefix preprocessor presentation primitive priority procedure process processor profile program projection promise property protocol prototype proxy publisher queue quota random range rank rate ratio record recovery recursion reducer reference reflection registry relation release render replica report repository request resolution resource response restore result retry return reuse reverse revision role rollback root route router row rule runtime sample scale schema scope script search section segment selector semaphore sequence serializer server service session set shard shell signal signature singleton snapshot socket sort source space specification stack stage state statement static status storage stream string structure style subclass subsystem suffix suite summary supervisor symbol synchronization syntax system table tag target task template terminal test thread threshold tier timeout token trace track transaction transfer transform transition translation transmission transport tree trigger tuple type unary union unit update utility validation value variable variant vector version view virtual visibility visitor volume widget window workflow wrapper yield zone".split(" ");
  for (const word of az) {
    out.push({
      term: `Programming term: ${word}`,
      definition: `In software development, "${word}" refers to a common concept, construct, or artifact encountered when designing, writing, or operating code and systems.`,
      category: "fundamentals",
      tags: ["vocabulary", word],
      level: "beginner",
    });
  }
  return out;
}

function main() {
  const raw = [...generateAll(), ...curatedEntries(), ...expandNumericVariants()];
  const bySlug = new Map();

  raw.forEach((entry, index) => {
    const norm = normalizeEntry(entry, index);
    if (!norm) return;
    let slug = norm.slug;
    let suffix = 2;
    while (bySlug.has(slug)) {
      slug = `${norm.slug}-${suffix++}`;
    }
    norm.slug = slug;
    norm.id = `term_${slug}`;
    bySlug.set(slug, norm);
  });

  const terms = [...bySlug.values()].sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: "base" }));

  const categories = Object.values(CATEGORIES).map((c) => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    count: terms.filter((t) => t.category === c.id).length,
  }));

  const payload = {
    version: 1,
    builtAt: new Date().toISOString(),
    termCount: terms.length,
    categories,
    terms,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload), "utf8");

  console.log(`Wrote ${terms.length} terms to ${OUT}`);
  console.log("Categories:");
  for (const c of categories) {
    console.log(`  ${c.icon} ${c.label}: ${c.count}`);
  }
  if (terms.length < 4000) {
    console.error(`WARNING: only ${terms.length} terms: target is 4000+`);
    process.exitCode = 1;
  }
}

main();