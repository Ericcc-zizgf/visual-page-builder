"use strict";
const $ = (s) => document.querySelector(s),
  STORAGE = "visual-page-builder-v1";
const VOID = new Set(["input", "img", "hr"]);
const CONTAINERS = new Set([
  "main",
  "header",
  "nav",
  "section",
  "div",
  "article",
  "form",
  "ul",
]);
const TYPES = [
  ["section", "區塊"],
  ["div", "容器"],
  ["header", "頁首"],
  ["nav", "導覽"],
  ["article", "卡片"],
  ["h1", "大標題"],
  ["h2", "小標題"],
  ["p", "段落"],
  ["button", "按鈕"],
  ["input", "輸入框"],
  ["label", "標籤"],
  ["textarea", "文字輸入"],
  ["a", "連結"],
  ["img", "圖片"],
  ["ul", "清單"],
  ["li", "清單項目"],
  ["form", "表單"],
  ["hr", "分隔線"],
];
const TAGS = new Set(["main", ...TYPES.map((t) => t[0])]);
const STYLE_KEYS = [
  "display",
  "flex-direction",
  "justify-content",
  "align-items",
  "flex-wrap",
  "gap",
  "grid-template-columns",
  "width",
  "height",
  "min-height",
  "max-width",
  "padding",
  "margin",
  "background-color",
  "color",
  "font-size",
  "font-weight",
  "line-height",
  "text-align",
  "border",
  "border-radius",
  "box-shadow",
  "position",
  "z-index",
  "scroll-margin-top",
  "top",
  "right",
  "bottom",
  "left",
  "flex",
  "overflow",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
];
const EVENTS = new Set(["click", "input", "change", "submit"]);
const ACTIONS = {
  text: "更新文字",
  toggle: "顯示／隱藏",
  show: "顯示元件",
  hide: "隱藏元件",
  class: "切換醒目樣式",
  increment: "數字加一",
  input: "將目前輸入顯示成文字",
};
let serial = 0,
  model,
  selected = "root",
  panel = "html",
  codeTab = "html",
  history = [],
  future = [],
  width = "full",
  saveTimer;
let activeBreakpoint = "desktop",
  editingAction = null,
  dragInfo = null,
  codeBeforeChange = null,
  lastStyleKey = "";
const BREAKPOINTS = {
  desktop: "桌面基本樣式",
  tablet: "平板 ≤ 1024px",
  mobile: "手機 ≤ 600px",
};
const placeholder =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="240"><rect width="600" height="240" fill="#e6ecdf"/><text x="300" y="125" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#65795c">Your image</text></svg>',
  );
const clone = (v) => JSON.parse(JSON.stringify(v));
function blank() {
  return {
    version: 1,
    name: "我的網頁作品",
    root: {
      id: "root",
      tag: "main",
      text: "",
      attrs: {},
      styles: {
        padding: "24px",
        "min-height": "540px",
        "background-color": "#ffffff",
        color: "#263c2d",
      },
      children: [],
      actions: [],
    },
  };
}
function all(node = model.root) {
  return [node, ...node.children.flatMap((child) => all(child))];
}
function find(id) {
  return all().find((n) => n.id === id);
}
function parentOf(id, node = model.root) {
  for (const child of node.children) {
    if (child.id === id) return node;
    const found = parentOf(id, child);
    if (found) return found;
  }
  return null;
}
function uid() {
  let id;
  do {
    id = "el-" + ++serial;
  } while (find(id));
  return id;
}
function make(tag) {
  const n = { id: uid(), tag, text: "", attrs: {}, styles: {}, children: [], actions: [] };
  const names = {
    h1: "我的網頁標題",
    h2: "一個新的段落",
    p: "在右側修改這段文字，觀察 HTML 即時變化。",
    button: "點我試試看",
    label: "欄位名稱",
    a: "我的連結",
    li: "一個清單項目",
    textarea: "",
  };
  n.text = names[tag] || "";
  if (tag === "input")
    n.attrs = { type: "text", placeholder: "請輸入文字", "aria-label": "文字輸入" };
  if (tag === "textarea") n.attrs = { placeholder: "請輸入內容", rows: "3" };
  if (tag === "button") n.attrs = { type: "button" };
  if (tag === "a") n.attrs = { href: "#" };
  if (tag === "img") n.attrs = { src: placeholder, alt: "圖片預留位置" };
  if (CONTAINERS.has(tag))
    n.styles = {
      padding: "20px",
      "min-height": "90px",
      border: "1px solid #d9e3d2",
      "border-radius": "8px",
    };
  if (tag === "button")
    n.styles = {
      padding: "10px 18px",
      "background-color": "#2d694c",
      color: "#ffffff",
      border: "none",
      "border-radius": "6px",
    };
  return n;
}
function message(text) {
  $("#status").textContent = text;
}
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(model));
      $("#save-status").textContent = "草稿已自動儲存";
    } catch {
      $("#save-status").textContent = "儲存空間不足，請下載專案 JSON";
    }
  }, 220);
}
function commit(change, description) {
  const previous = clone(model);
  codeBeforeChange = { html: nodeHTML(model.root), css: cssCode(), js: jsCode() };
  history.push(previous);
  if (history.length > 60) history.shift();
  future = [];
  change();
  if (!find(selected)) selected = "root";
  refresh();
  persist();
  message(description || "已更新畫布與原始碼。");
  renderOperationLesson(BuilderLearning.operation(previous, model, description));
}
function esc(value) {
  return String(value).replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
  );
}
const jsValue = (value) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
function attributes(n, editing) {
  const attrs = { id: n.id, ...n.attrs };
  let result = Object.entries(attrs)
    .map(([k, v]) => " " + k + '="' + esc(v) + '"')
    .join("");
  if (editing) {
    result += ' data-builder-id="' + n.id + '"';
    if (n.id !== "root") result += ' draggable="false"';
    if (CONTAINERS.has(n.tag) && !n.children.length) result += ' data-empty="true"';
  }
  return result;
}
function nodeHTML(n, level = 0, editing = false) {
  const indent = "  ".repeat(level),
    open = "<" + n.tag + attributes(n, editing) + ">";
  if (VOID.has(n.tag)) return indent + open;
  if (n.children.length)
    return (
      indent +
      open +
      "\n" +
      n.children.map((c) => nodeHTML(c, level + 1, editing)).join("\n") +
      "\n" +
      indent +
      "</" +
      n.tag +
      ">"
    );
  return indent + open + esc(n.text) + "</" + n.tag + ">";
}
function styleBucket(node, breakpoint = activeBreakpoint) {
  if (breakpoint === "desktop") return node.styles;
  node.responsive ||= {};
  return (node.responsive[breakpoint] ||= {});
}
function effectiveStyles(node, breakpoint = activeBreakpoint) {
  return {
    ...node.styles,
    ...(breakpoint !== "desktop" ? node.responsive?.tablet : {}),
    ...(breakpoint === "mobile" ? node.responsive?.mobile : {}),
  };
}
function cssCode(editing = false) {
  const base =
    "* {\n  box-sizing: border-box;\n}\n\n[hidden] {\n  display: none !important;\n}\n\nbody {\n  margin: 0;\n  font-family: system-ui, sans-serif;\n  line-height: 1.6;\n}\n\nimg {\n  max-width: 100%;\n}\n\nbutton, input, textarea {\n  font: inherit;\n}\n\n.is-active {\n  outline: 3px solid #72aa63;\n  background-color: #eaf4df !important;\n}\n";
  const rule = (node, styles, indent = "", scope = "桌面基本樣式") =>
    indent + "/* 元件 #" + node.id + "：" +
    BuilderLearning.label(node).replace(/\*\//g, "").replace(/[<>\r\n]/g, " ").slice(0, 90) +
    " · " + scope + " */\n" +
    indent +
    "#" +
    node.id +
    " {\n" +
    Object.entries(styles)
      .map(([k, v]) => indent + "  " + k + ": " + v + ";")
      .join("\n") +
    "\n" +
    indent +
    "}";
  const baseRules = all()
    .map((n) => [n, editing ? effectiveStyles(n) : n.styles])
    .filter(([, styles]) => Object.keys(styles).length)
    .map(([n, styles]) => rule(n, styles))
    .join("\n\n");
  let result = base + "\n" + baseRules + "\n";
  if (!editing)
    for (const [key, max] of [
      ["tablet", 1024],
      ["mobile", 600],
    ]) {
      const rules = all()
        .filter((n) => Object.keys(n.responsive?.[key] || {}).length)
        .map((n) => rule(n, n.responsive[key], "  ", BREAKPOINTS[key]));
      if (rules.length)
        result += "\n@media (max-width: " + max + "px) {\n" + rules.join("\n\n") + "\n}\n";
    }
  return result;
}

function actionLines(action, indent = "  ") {
  const lines = [indent + `const target = document.getElementById(${jsValue(action.target)});`];
  if (action.type === "text")
    lines.push(indent + `target.textContent = ${jsValue(action.value || "")};`);
  if (action.type === "toggle")
    lines.push(
      indent + "target.hidden = !target.hidden;",

    );
  if (["show", "hide"].includes(action.type))
    lines.push(indent + "target.hidden = " + (action.type === "hide") + ";");
  if (["toggle", "show", "hide"].includes(action.type)) {
    for (const control of all().filter(n => n.tag === "button" && n.actions.some(a => a.type === "toggle" && a.target === action.target))) {
      const ref = `document.getElementById(${jsValue(control.id)})`;
      lines.push(indent + `if (${ref}.getAttribute("aria-controls") === target.id) ${ref}.setAttribute("aria-expanded", String(!target.hidden));`);
    }
  }
  if (action.type === "class") lines.push(indent + 'target.classList.toggle("is-active");');
  if (action.type === "increment")
    lines.push(
      indent + "const current = Number(target.textContent) || 0;",
      indent + "target.textContent = String(current + 1);",
    );
  if (action.type === "input")
    lines.push(indent + "target.textContent = event.currentTarget.value;");
  return lines;
}
function jsCode(onlyId) {
  const blocks = [];
  for (const node of all()) {
    if (onlyId && node.id !== onlyId) continue;
    for (const action of node.actions) {
      if (!find(action.target)) continue;
      const lines = [
        `// 元件 #${node.id}：${action.event} → ${ACTIONS[action.type]} → #${action.target}`,
        `document.getElementById(${jsValue(node.id)}).addEventListener(${jsValue(action.event)}, function (event) {`,
      ];
      if (node.tag === "button" && action.type === "toggle")
        lines.unshift(
          `document.getElementById(${jsValue(node.id)}).setAttribute("aria-controls", ${jsValue(action.target)});`,
          `document.getElementById(${jsValue(node.id)}).setAttribute("aria-expanded", String(!document.getElementById(${jsValue(action.target)}).hidden));`,
        );
      if (action.event === "submit" || node.tag === "a")
        lines.push("  event.preventDefault();");
      const condition = action.condition;
      let indent = "  ";
      if (condition) {
        lines.push(
          `  const source = document.getElementById(${jsValue(condition.source)});`,
          '  const inputValue = String(source.matches("input, textarea") ? source.value : source.textContent).trim();',
        );
        const test =
          condition.operator === "empty"
            ? 'inputValue === ""'
            : condition.operator === "not-empty"
              ? 'inputValue !== ""'
              : `inputValue === ${jsValue(condition.value || "")}`;
        lines.push("  if (" + test + ") {");
        indent = "    ";
      }
      for (const step of [action, ...(action.steps || [])]) {
        lines.push(indent + "{", ...actionLines(step, indent + "  "), indent + "}");
      }
      if (condition) {
        if (action.otherwise) {
          lines.push("  } else {", ...actionLines(action.otherwise, "    "));
        }
        lines.push("  }");
      }
      lines.push("});");
      blocks.push(lines.join("\n"));
    }
  }
  return blocks.length
    ? blocks.join("\n\n") + "\n"
    : "// 尚未加入互動。\n// 在「JS 互動」選擇事件、條件、動作與目標元件。\n";
}

function documentHTML(editing = false) {
  const csp = editing
    ? "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'"
    : "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'";
  const extra = editing
    ? '\n[data-builder-id] { cursor: pointer; }\n[data-empty]::after { content: ""; color: #93a18c; font-size: 12px; }\n[data-builder-selected] { outline: 2px solid #4b8e56 !important; outline-offset: -2px; }\n[data-drop-target] { outline: 2px dashed #c28b42 !important; }\n'
    : "";
  return (
    '<!doctype html>\n<html lang="zh-Hant">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <meta http-equiv="Content-Security-Policy" content="' +
    csp +
    '">\n  <title>我的視覺化網頁</title>\n  <style>\n' +
    cssCode(editing) +
    extra +
    (editing
      ? "\n[data-action-target] { box-shadow: inset 0 0 0 2px #6a9cca !important; }\n[data-drop-invalid] { outline-color: #be5546 !important; }\n"
      : "") +
    "  </style>\n</head>\n<body>\n" +
    nodeHTML(model.root, 1, editing) +
    "\n" +
    (editing ? "" : "  <script>\n" + jsCode() + "  </script>\n") +
    "</body>\n</html>\n"
  );
}
function select(id) {
  if (!find(id)) return;
  selected = id;
  lastStyleKey = "";
  renderSelection();
  renderInspector();
  renderTree();
  renderCode();
}
function renderSelection() {
  const n = find(selected);
  $("#selected-title").textContent =
    (TYPES.find((t) => t[0] === n.tag)?.[1] || "畫布") + " · " + n.tag;
  $("#selected-id").textContent = "#" + n.id;
  const path = [];
  let current = n;
  while (current) {
    path.unshift(current.tag + "#" + current.id);
    current = parentOf(current.id);
  }
  $("#selection-path").textContent = path.join(" › ");
  const doc = $("#canvas").contentDocument;
  if (doc) {
    doc
      .querySelectorAll("[data-action-target]")
      .forEach((el) => el.removeAttribute("data-action-target"));
    for (const id of new Set(n.actions.flatMap(actionReferences)))
      if (id !== selected)
        doc
          .querySelector('[data-builder-id="' + id + '"]')
          ?.setAttribute("data-action-target", "");
    doc
      .querySelectorAll("[data-builder-selected]")
      .forEach((e) => e.removeAttribute("data-builder-selected"));
    doc
      .querySelector('[data-builder-id="' + selected + '"]')
      ?.setAttribute("data-builder-selected", "");
  }
}
function nodeLabel(id) {
  const n = find(id);
  return n ? n.tag + " #" + n.id + (n.text ? " · " + n.text.slice(0, 16) : "") : "#" + id;
}
function lessonContent(container, entry) {
  const title = document.createElement("strong");
  title.textContent = entry.title;
  container.append(title);
  for (const [key, prefix] of [["who", "對應元件："], ["effect", ""], ["syntax", "語法："], ["tip", "觀察提示："]]) {
    if (!entry[key]) continue;
    const p = document.createElement("p");
    p.textContent = prefix + entry[key];
    container.append(p);
  }
  if (entry.code) {
    const pre = document.createElement("pre"), code = document.createElement("code");
    code.textContent = entry.code;
    pre.append(code);
    container.append(pre);
  }
}
function renderOperationLesson(lesson) {
  const box = $("#operation-explanation");
  box.replaceChildren();
  const heading = document.createElement("p");
  heading.textContent = lesson.title;
  box.append(heading);
  const show = entries => {
    const group = document.createElement("div");
    for (const entry of entries) {
      const item = document.createElement("div");
      item.className = "lesson-entry";
      if (entry.actionNode) entry.code = jsCode(entry.actionNode);
      if (entry.htmlNode && find(entry.htmlNode)) entry.code = nodeHTML(find(entry.htmlNode));
      lessonContent(item, entry);
      group.append(item);
    }
    return group;
  };
  box.append(show(lesson.entries.slice(0, 3)));
  if (lesson.entries.length > 3) {
    const more = document.createElement("details"), summary = document.createElement("summary");
    summary.textContent = "查看另外 " + (lesson.entries.length - 3) + " 項程式變化";
    more.append(summary, show(lesson.entries.slice(3)));
    box.append(more);
  }
}
let explainedCodeLine = null;
function showLineLesson(tab, index, line, owner, context) {
  explainedCodeLine = { tab, index, line };
  $("#source-code").querySelectorAll(".code-line").forEach(el => {
    const chosen = Number(el.dataset.line) === index + 1;
    el.classList.toggle("explained-line", chosen);
    el.tabIndex = chosen ? 0 : -1;
  });
  const entry = BuilderLearning.lineInfo(tab, line, find(owner), context);
  $("#line-lesson-title").textContent = { html: "HTML", css: "CSS", js: "JavaScript" }[tab] + " 第 " + (index + 1) + " 行 · " + entry.title;
  const box = $("#line-explanation");
  box.replaceChildren();
  lessonContent(box, { ...entry, title: "這行在做什麼" });
  $("#line-lesson").scrollIntoView({ block: "nearest", inline: "nearest" });
}
function renderCode() {
  const codes = { html: nodeHTML(model.root), css: cssCode(), js: jsCode() },
    lines = codes[codeTab].split("\n"),
    pre = $("#source-code");
  const selectedNode = find(selected),
    fragment = nodeHTML(selectedNode),
    htmlStart = codes.html.indexOf(fragment.trimStart());
  const htmlLine = codes.html
    .split("\n")
    .findIndex((line) => line.includes('id="' + selected + '"'));
  const htmlEnd = htmlLine + fragment.split("\n").length;
  const before = new Set((codeBeforeChange?.[codeTab] || "").split("\n"));
  let owner = "",
    cssOwner = "",
    jsOwner = "",
    mediaScope = "desktop",
    jsTarget = "";
  const htmlStack = [];
  pre.replaceChildren();
  pre.onkeydown = event => {
    if (event.target !== pre) return;
    if (["ArrowDown", "Enter"].includes(event.key)) {
      event.preventDefault();
      const line = pre.querySelector('.code-line[tabindex="0"]') || pre.firstElementChild;
      line?.focus();
      if (event.key === "Enter") line?.click();
    }
  };
  lines.forEach((line, index) => {
    const span = document.createElement("span");
    span.className = "code-line";
    span.dataset.line = index + 1;
    const htmlId = line.match(/\bid="(root|el-\d+)"/);
    if (htmlId) {
      owner = htmlId[1];
      if (!VOID.has(find(owner)?.tag) && !line.includes("</")) htmlStack.push(owner);
    } else if (/^\s*<\//.test(line)) owner = htmlStack.pop() || "root";
    if (/^@media.*1024px/.test(line)) mediaScope = "tablet";
    if (/^@media.*600px/.test(line)) mediaScope = "mobile";
    const cssId = line.match(/^\s*#(root|el-\d+)\s*\{/);
    if (cssId) cssOwner = cssId[1];
    const cssHeading = line.match(/^\s*\/\* 元件 #(root|el-\d+)：/);
    if (cssHeading) cssOwner = cssHeading[1];
    const jsId = line.match(/^\/\/ 元件 #(root|el-\d+)：/);
    if (jsId) { jsOwner = jsId[1]; jsTarget = ""; }
    const jsDocumentId = line.match(/document\.getElementById\("(root|el-\d+)"\)/)?.[1];
    if (codeTab === "js" && line.startsWith("document.getElementById(") && jsDocumentId) jsOwner = jsDocumentId;
    if (codeTab === "js" && line.includes("const target =") && jsDocumentId) jsTarget = jsDocumentId;
    const relevant =
      codeTab === "html"
        ? index >= htmlLine && index < htmlEnd
        : codeTab === "css"
          ? cssOwner === selected
          : jsOwner === selected;
    if (relevant) span.classList.add("selected-line");
    if (codeBeforeChange && !before.has(line) && line.trim())
      span.classList.add("changed-line");
    if (
      codeTab === "css" &&
      mediaScope === activeBreakpoint &&
      cssOwner === selected &&
      lastStyleKey &&
      line.trimStart().startsWith(lastStyleKey + ":")
    )
      span.classList.add("property-line");
    if (codeTab === "html" && htmlId) {
      span.dataset.codeNode = owner;
      span.title = "點擊對照 " + nodeLabel(owner);
    }
    const lineOwner = codeTab === "html" ? owner : codeTab === "css" ? cssOwner : jsOwner;
    const context = codeTab === "js" && lineOwner
      ? "事件來源：" + nodeLabel(lineOwner) + (jsTarget ? "；目前動作目標：" + nodeLabel(jsTarget) : "") : "";
    span.dataset.codeOwner = lineOwner;
    span.setAttribute("role", "button");
    span.setAttribute("aria-label", "第 " + (index + 1) + " 行，點選查看解說：" + line.trim());
    span.tabIndex = index === 0 ? 0 : -1;
    const explain = () => {
      if (lineOwner && find(lineOwner) && selected !== lineOwner) select(lineOwner);
      showLineLesson(codeTab, index, line, lineOwner, context);
    };
    span.onclick = explain;
    span.onkeydown = event => {
      if (["Enter", " "].includes(event.key)) {
        event.preventDefault();
        explain();
        $("#source-code").children[index]?.focus({ preventScroll: true });
      }
      if (["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        const next = event.key === "ArrowDown" ? span.nextElementSibling : span.previousElementSibling;
        if (next) { span.tabIndex = -1; next.tabIndex = 0; next.focus(); }
      }
    };
    span.textContent = line + (index < lines.length - 1 ? "\n" : "");
    pre.append(span);
    if (codeTab === "css" && /^\s*}\s*$/.test(line)) cssOwner = "";
    if (codeTab === "css" && /^}\s*$/.test(line)) mediaScope = "desktop";
  });
  const active = pre.querySelector(".property-line") || pre.querySelector(".selected-line");
  if (active)
    pre.scrollTop = Math.max(
      0,
      active.getBoundingClientRect().top -
        pre.getBoundingClientRect().top +
        pre.scrollTop -
        pre.clientTop -
        45,
    );
  $("#code-explanation").textContent =
    codeTab === "html"
      ? "選取 " + nodeLabel(selected) + "；亮色行是它的 HTML 範圍。"
      : codeTab === "css"
        ? BREAKPOINTS[activeBreakpoint] +
          "：" +
          (lastStyleKey ? "剛才調整 " + lastStyleKey : "亮色區域對應目前元件。")
        : "目前事件來自 " + nodeLabel(selected) + "；藍框標出互動目標。";
  $("#code-section-title").textContent = { html: "HTML 原始碼 · 結構與內容", css: "CSS 原始碼 · 排版與外觀", js: "JavaScript 原始碼 · 事件與動作" }[codeTab];
  if (explainedCodeLine?.tab === codeTab && lines[explainedCodeLine.index] === explainedCodeLine.line) {
    const row = pre.children[explainedCodeLine.index];
    row?.classList.add("explained-line");
    if (row) { pre.firstElementChild.tabIndex = -1; row.tabIndex = 0; }
  } else {
    explainedCodeLine = null;
    $("#line-lesson-title").textContent = "點一行，看懂程式";
    $("#line-explanation").textContent = "點選上方任一行，查看用途、語法與畫面上的對應元件。每個 CSS 區段的小標題會標示元件與適用尺寸。";
  }
  document
    .querySelectorAll("[data-code]")
    .forEach((b) => b.classList.toggle("active", b.dataset.code === codeTab));
}

function refresh() {
  $("#project-name").value = model.name || "我的網頁作品";
  $("#breakpoint-label").textContent =
    "正在編輯：" +
    BREAKPOINTS[activeBreakpoint] +
    (activeBreakpoint === "desktop"
      ? "，其他尺寸可繼承。"
      : "。未設定的屬性繼承較大尺寸；清空欄位會移除本尺寸覆寫。");
  renderCode();
  renderTree();
  renderInspector();
  $("#canvas").srcdoc = documentHTML(true);
  $("#undo").disabled = !history.length;
  $("#redo").disabled = !future.length;
  $("#node-count").textContent = all().length + " 個元件";
  renderSelection();
}
function field(label, key, value, options, onchange) {
  const wrapper = document.createElement("label");
  wrapper.className = "field";
  const title = document.createElement("span");
  title.textContent = label;
  const control = document.createElement(
    options ? "select" : key === "text" ? "textarea" : "input",
  );
  control.dataset.field = key;
  if (options)
    for (const [v, t] of options) {
      const option = document.createElement("option");
      option.value = v;
      option.textContent = t;
      control.append(option);
    }
  control.value = value ?? "";
  control.addEventListener("change", () => onchange(control.value));
  wrapper.append(title, control);
  return wrapper;
}
function updateStyle(node, key, value) {
  if (value && !CSS.supports(key, value)) {
    message("這個 CSS 值無效，請選擇合適的單位或設定。");
    renderInspector();
    return;
  }
  lastStyleKey = key;
  commit(
    () => {
      const bucket = styleBucket(node);
      if (value) bucket[key] = value;
      else delete bucket[key];
    },
    "已修改 " + BREAKPOINTS[activeBreakpoint] + " 的 " + key + "。",
  );
}
function styleField(label, key, options) {
  const n = find(selected),
    value = effectiveStyles(n)[key] || "";
  const dimension =
    /^(width|height|min-height|max-width|padding.*|margin.*|gap|font-size|border-radius|top|right|bottom|left)$/.test(
      key,
    );
  if (options || !dimension)
    return field(label, key, value, options, (v) => updateStyle(n, key, v));
  const match = value.match(/^(-?\d*\.?\d+)(px|%|rem|em|vw|vh)?$/),
    initialUnit = value === "auto" ? "auto" : match?.[2] || "px";
  const wrapper = field(label, key, match ? match[1] : value, null, (v) =>
    updateStyle(n, key, /^-?\d*\.?\d+$/.test(v) ? v + unit.value : v),
  );
  const input = wrapper.querySelector("input");
  input.inputMode = "decimal";
  input.placeholder = "繼承／預設";
  const controls = document.createElement("div");
  controls.className = "dimension-control";
  const unit = document.createElement("select");
  unit.dataset.unit = key;
  unit.setAttribute("aria-label", label + "單位");
  for (const v of ["px", "%", "rem", "em", "vw", "vh", "auto"]) {
    const option = document.createElement("option");
    option.value = v;
    option.textContent = v;
    unit.append(option);
  }
  unit.value = initialUnit;
  unit.onchange = () =>
    updateStyle(
      n,
      key,
      unit.value === "auto" ? "auto" : String(parseFloat(input.value) || 0) + unit.value,
    );
  const minus = button("−", () =>
    updateStyle(
      n,
      key,
      String((parseFloat(input.value) || 0) - 1) + (unit.value === "auto" ? "px" : unit.value),
    ),
  );
  const plus = button("+", () =>
    updateStyle(
      n,
      key,
      String((parseFloat(input.value) || 0) + 1) + (unit.value === "auto" ? "px" : unit.value),
    ),
  );
  minus.setAttribute("aria-label", label + "減一");
  plus.setAttribute("aria-label", label + "加一");
  controls.append(minus, input, plus, unit);
  wrapper.append(controls);
  return wrapper;
}
function boxModel(box, n) {
  box.append(heading("盒模型：外距 margin → 邊框 → 內距 padding → 內容"));
  const diagram = document.createElement("div");
  diagram.className = "box-model";
  const outer = document.createElement("div");
  outer.className = "box-margin";
  const outerTitle = document.createElement("strong");
  outerTitle.textContent = "外距 margin";
  outer.append(outerTitle);
  const inner = document.createElement("div");
  inner.className = "box-padding";
  const title = document.createElement("strong");
  title.textContent = "內距 padding";
  inner.append(title);
  for (const [prefix, container] of [
    ["margin", outer],
    ["padding", inner],
  ]) {
    const grid = document.createElement("div");
    grid.className = "box-sides";
    for (const [side, label] of [
      ["top", "上"],
      ["right", "右"],
      ["bottom", "下"],
      ["left", "左"],
    ])
      grid.append(styleField(label + " " + prefix + "-" + side, prefix + "-" + side));
    container.append(grid);
  }
  const content = document.createElement("div");
  content.className = "box-content";
  content.textContent = "內容：" + n.tag + " #" + n.id;
  inner.append(content);
  outer.append(inner);
  diagram.append(outer);
  box.append(diagram);
}

function button(label, callback, cls = "") {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.className = cls;
  b.onclick = callback;
  return b;
}
function heading(text) {
  const h = document.createElement("div");
  h.className = "subheading";
  h.textContent = text;
  return h;
}
function row(...fields) {
  const r = document.createElement("div");
  r.className = "field-row";
  r.append(...fields);
  return r;
}
function dropParent() {
  let n = find(selected);
  while (n && !CONTAINERS.has(n.tag)) n = parentOf(n.id);
  return n || model.root;
}
function canContain(parent, node) {
  return (
    CONTAINERS.has(parent.tag) &&
    (parent.tag !== "ul" || node.tag === "li") &&
    (node.tag !== "li" || parent.tag === "ul") &&
    !(
      all(node).some((n) => n.tag === "form") &&
      (parent.tag === "form" || ancestors(parent).some((n) => n.tag === "form"))
    )
  );
}
function ancestors(n) {
  const result = [];
  while ((n = parentOf(n.id))) result.push(n);
  return result;
}
function add(tag, target = dropParent(), index = target.children.length) {
  const node = make(tag);
  if (!canContain(target, node)) {
    message(
      tag === "li"
        ? "清單項目需要放進 ul 清單裡。"
        : "這個區塊不能放入此元件，請先選擇其他容器。",
    );
    return;
  }
  commit(
    () => {
      target.children.splice(index, 0, node);
      selected = node.id;
    },
    "已加入 <" + tag + ">，HTML 原始碼同步更新。",
  );
}
function move(id, target, index) {
  const node = find(id);
  if (!node || id === "root" || target.id === id || all(node).some((n) => n.id === target.id)) {
    message("不能把元件放入自己或自己的子元件。");
    return;
  }
  if (!canContain(target, node)) {
    message("不符合 HTML 結構，請換一個容器。");
    return;
  }
  const old = parentOf(id),
    before = old.children.indexOf(node);
  commit(() => {
    old.children.splice(before, 1);
    if (old === target && before < index) index--;
    target.children.splice(index, 0, node);
    selected = id;
  }, "已移動元件與它的所有子元件。");
}
function removeSelected() {
  if (selected === "root") return;
  const node = find(selected),
    parent = parentOf(selected),
    ids = new Set(all(node).map((n) => n.id));
  commit(() => {
    parent.children = parent.children.filter((n) => n.id !== selected);
    for (const n of all())
      n.actions = n.actions.filter((a) => !actionReferences(a).some((id) => ids.has(id)));
    selected = parent.id;
  }, "已刪除元件；可按復原。");
}
function reorder(direction) {
  const parent = parentOf(selected);
  if (!parent) return;
  const index = parent.children.findIndex((n) => n.id === selected),
    next = index + direction;
  if (next < 0 || next >= parent.children.length) return;
  commit(() => {
    [parent.children[index], parent.children[next]] = [
      parent.children[next],
      parent.children[index],
    ];
  }, "已調整 HTML 元件順序。");
}
function duplicate() {
  if (selected === "root") return;
  const original = find(selected),
    parent = parentOf(selected),
    map = new Map();
  const copy = clone(original);
  for (const n of all(copy)) {
    const old = n.id;
    n.id = uid();
    map.set(old, n.id);
  }
  for (const n of all(copy))
    for (const a of n.actions) {
      for (const step of [a, ...(a.steps || []), ...(a.otherwise ? [a.otherwise] : [])])
        step.target = map.get(step.target) || step.target;
      if (a.condition) a.condition.source = map.get(a.condition.source) || a.condition.source;
    }
  commit(() => {
    parent.children.splice(parent.children.indexOf(original) + 1, 0, copy);
    selected = copy.id;
  }, "已複製元件與內部互動。");
}
function renderInspector() {
  const box = $("#properties"),
    n = find(selected);
  box.replaceChildren();
  document.querySelectorAll("[data-panel]").forEach((b) => {
    b.classList.toggle("active", b.dataset.panel === panel);
    b.setAttribute("aria-selected", b.dataset.panel === panel);
  });
  if (panel === "html") {
    const tip = document.createElement("p");
    tip.className = "help";
    tip.textContent = CONTAINERS.has(n.tag)
      ? "這是容器，可以放入其他元件。把標題、文字或按鈕拖到它的中央。"
      : "修改內容後離開欄位，HTML 與畫布會一起更新。";
    box.append(tip);
    if (!CONTAINERS.has(n.tag) && !VOID.has(n.tag))
      box.append(
        field("文字內容", "text", n.text, null, (value) =>
          commit(() => (n.text = value), "已更新文字內容。"),
        ),
      );
    if (n.tag === "input")
      box.append(
        field(
          "輸入類型",
          "type",
          n.attrs.type,
          [
            ["text", "文字"],
            ["email", "Email"],
            ["number", "數字"],
            ["checkbox", "核取方塊"],
            ["password", "密碼"],
          ],
          (value) => commit(() => (n.attrs.type = value)),
        ),
      );
    if (["input", "textarea"].includes(n.tag))
      box.append(
        field("提示文字", "placeholder", n.attrs.placeholder, null, (value) =>
          commit(() => (n.attrs.placeholder = value)),
        ),
      );
    if (n.tag === "a")
      box.append(
        field("連結（#、https:// 或 mailto:）", "href", n.attrs.href, null, (value) => {
          if (!/^(#|https?:\/\/|mailto:)/i.test(value)) {
            message("請輸入 #、https:// 或 mailto: 開頭的網址。");
            return;
          }
          commit(() => (n.attrs.href = value));
        }),
      );
    if (n.tag === "img") {
      box.append(
        field("圖片說明 alt", "alt", n.attrs.alt, null, (value) =>
          commit(() => (n.attrs.alt = value)),
        ),
      );
      const label = document.createElement("label");
      label.className = "field";
      label.textContent = "上傳圖片（PNG／JPEG／WebP，2 MB 以內）";
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/webp";
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        if (
          file.size > 2 * 1024 * 1024 ||
          !["image/png", "image/jpeg", "image/webp"].includes(file.type)
        ) {
          message("請選擇 2 MB 內的 PNG、JPEG 或 WebP。");
          return;
        }
        const reader = new FileReader();
        reader.onload = () => commit(() => (n.attrs.src = reader.result), "已載入本機圖片。");
        reader.readAsDataURL(file);
      };
      label.append(input);
      box.append(label);
    }
    if (n.id !== "root") {
      box.append(heading("階層與順序"));
      const choices = all()
        .filter((p) => p.id !== n.id && !all(n).some((c) => c.id === p.id) && canContain(p, n))
        .map((p) => [p.id, p.tag + " #" + p.id]);
      box.append(
        field("移入容器", "parent", parentOf(n.id).id, choices, (value) => {
          const target = find(value);
          move(n.id, target, target.children.length);
        }),
      );
      const actions = document.createElement("div");
      actions.className = "node-actions";
      actions.append(
        button("↑ 往前", () => reorder(-1)),
        button("↓ 往後", () => reorder(1)),
        button("複製元件", duplicate),
        button("刪除", removeSelected, "danger"),
      );
      box.append(actions);
    }
  } else if (panel === "css") {
    boxModel(box, n);
    if (activeBreakpoint !== "desktop")
      box.append(
        button("移除本尺寸所有覆寫，恢復繼承", () =>
          commit(() => {
            n.responsive ||= {};
            delete n.responsive[activeBreakpoint];
          }, "已恢復繼承較大尺寸樣式。"),
        ),
      );
    const presets = document.createElement("div");
    presets.className = "node-actions";
    for (const [title, styles] of [
      [
        "橫排置中",
        { display: "flex", "justify-content": "center", "align-items": "center", gap: "16px" },
      ],
      ["直向排列", { display: "flex", "flex-direction": "column", gap: "16px" }],
      ["三欄格線", { display: "grid", "grid-template-columns": "1fr 1fr 1fr", gap: "16px" }],
    ])
      presets.append(
        button(title, () =>
          commit(() => Object.assign(styleBucket(n), styles), "已套用 " + title + " 排版。"),
        ),
      );
    box.append(presets);
    const no = [["", "預設"]];
    box.append(
      heading("容器排版"),
      styleField("display · 排版方式", "display", [
        ...no,
        ["block", "Block 一般流"],
        ["flex", "Flex 彈性排列"],
        ["grid", "Grid 格線"],
        ["inline-block", "行內區塊"],
        ["none", "隱藏"],
      ]),
    );
    box.append(
      row(
        styleField("排列方向", "flex-direction", [
          ...no,
          ["row", "橫向 row"],
          ["column", "直向 column"],
          ["row-reverse", "橫向反轉"],
        ]),
        styleField("間距 gap", "gap"),
      ),
    );
    box.append(
      styleField("主軸對齊 justify-content", "justify-content", [
        ...no,
        ["flex-start", "靠起點"],
        ["center", "置中"],
        ["flex-end", "靠終點"],
        ["space-between", "兩端對齊"],
        ["space-around", "平均留白"],
      ]),
    );
    box.append(
      styleField("交叉軸 align-items", "align-items", [
        ...no,
        ["stretch", "延展"],
        ["flex-start", "靠起點"],
        ["center", "置中"],
        ["flex-end", "靠終點"],
      ]),
    );
    box.append(
      row(
        styleField("換行 flex-wrap", "flex-wrap", [
          ...no,
          ["nowrap", "不換行"],
          ["wrap", "換行"],
        ]),
        styleField("Grid 欄位", "grid-template-columns", [
          ...no,
          ["1fr", "一欄"],
          ["1fr 1fr", "兩欄"],
          ["1fr 1fr 1fr", "三欄"],
          ["1fr 2fr", "1：2 雙欄"],
        ]),
      ),
    );
    box.append(
      heading("大小與留白"),
      row(styleField("寬度 width", "width"), styleField("高度 height", "height")),
      row(styleField("內距 padding", "padding"), styleField("外距 margin", "margin")),
      row(styleField("最小高度", "min-height"), styleField("最大寬度", "max-width")),
    );
    box.append(
      heading("配色與文字"),
      row(styleField("背景顏色", "background-color"), styleField("文字顏色", "color")),
      row(styleField("字體大小", "font-size"), styleField("行高", "line-height")),
      row(
        styleField("文字粗細", "font-weight", [
          ...no,
          ["400", "一般 400"],
          ["600", "中粗 600"],
          ["700", "粗體 700"],
        ]),
        styleField("文字對齊", "text-align", [
          ...no,
          ["left", "靠左"],
          ["center", "置中"],
          ["right", "靠右"],
        ]),
      ),
    );
    // Native color controls supplement editable CSS color values.
    const colorRow = document.createElement("div");
    colorRow.className = "field-row";
    for (const [key, label] of [
      ["background-color", "背景選色"],
      ["color", "文字選色"],
    ]) {
      const fieldLabel = document.createElement("label");
      fieldLabel.className = "field";
      fieldLabel.textContent = label;
      const picker = document.createElement("input");
      picker.type = "color";
      picker.dataset.color = key;
      picker.value = /^#[0-9a-f]{6}$/i.test(effectiveStyles(n)[key] || "")
        ? effectiveStyles(n)[key]
        : "#ffffff";
      picker.onchange = () =>
        commit(() => (styleBucket(n)[key] = picker.value), "已更新配色。");
      fieldLabel.append(picker);
      colorRow.append(fieldLabel);
    }
    box.append(colorRow);
    box.append(
      heading("邊框與定位"),
      row(styleField("邊框 border", "border"), styleField("圓角", "border-radius")),
      styleField("陰影", "box-shadow", [
        ...no,
        ["none", "無"],
        ["0 4px 16px #00000018", "輕陰影"],
        ["0 12px 30px #00000024", "浮起陰影"],
      ]),
      styleField("position · 定位", "position", [
        ...no,
        ["static", "一般流 static"],
        ["relative", "相對 relative"],
        ["absolute", "絕對 absolute"],
        ["fixed", "固定 fixed"],
        ["sticky", "黏附 sticky"],
      ]),
      styleField("圖層順序 z-index", "z-index"),
      styleField("跳轉上方留白 scroll-margin-top", "scroll-margin-top"),
      row(styleField("上 top", "top"), styleField("右 right", "right")),
      row(styleField("下 bottom", "bottom"), styleField("左 left", "left")),
    );
    const help = document.createElement("p");
    help.className = "help";
    help.textContent =
      "例如：24px、50%、auto。絕對定位通常以最近的 relative 祖先為參考。CSS 控制會改變真正樣式，不會把元件固定成截圖。";
    box.append(help);
  } else renderActions(box, n);
  renderSelection();
}
function actionReferences(action) {
  return [
    action.target,
    action.condition?.source,
    action.otherwise?.target,
    ...(action.steps || []).map((step) => step.target),
  ].filter(Boolean);
}
function renderActions(box, n) {
  if (editingAction?.node !== n.id) editingAction = null;
  const existing = editingAction ? n.actions[editingAction.index] : null;
  const draft = clone(
    existing || { event: "click", type: "text", target: "", value: "互動成功！", steps: [] },
  );
  const help = document.createElement("p");
  help.className = "help";
  help.textContent =
    "誰發生事件 → 是否符合條件 → 依序執行動作。可以直接編輯既有互動，並到操作預覽測試。";
  box.append(help);
  n.actions.forEach((action, index) => {
    const card = document.createElement("div");
    card.className = "action-card";
    const title = document.createElement("p");
    title.textContent =
      action.event + " → " + ACTIONS[action.type] + " → " + nodeLabel(action.target);
    card.append(title);
    if (action.condition) {
      const note = document.createElement("p");
      note.textContent =
        "如果 " +
        nodeLabel(action.condition.source) +
        " " +
        {
          empty: "是空白",
          "not-empty": "不是空白",
          equals: "等於「" + action.condition.value + "」",
        }[action.condition.operator] +
        (action.otherwise
          ? "；否則 " +
            ACTIONS[action.otherwise.type] +
            " → " +
            nodeLabel(action.otherwise.target)
          : "");
      card.append(note);
    }
    (action.steps || []).forEach((step, i) => {
      const note = document.createElement("p");
      note.textContent =
        "接著 " + (i + 2) + "：" + ACTIONS[step.type] + " → " + nodeLabel(step.target);
      card.append(note);
    });
    if (action.type === "text") {
      const text = document.createElement("p");
      text.textContent = "文字：" + action.value;
      card.append(text);
    }
    card.append(
      button("編輯此互動", () => {
        editingAction = { node: n.id, index };
        renderInspector();
      }),
      button("移除此互動", () => {
        editingAction = null;
        commit(() => n.actions.splice(index, 1), "已移除互動。");
      }),
    );
    box.append(card);
  });
  const form = document.createElement("form");
  form.id = "action-form";
  const eventField = field(
    "觸發事件",
    "event",
    draft.event,
    [
      ["click", "點擊 click"],
      ["input", "輸入 input"],
      ["change", "變更 change"],
      ["submit", "表單送出 submit"],
    ],
    () => {},
  );
  form.append(eventField);
  function actionEditor(prefix, initial, allowNone = false) {
    const container = document.createElement("div");
    container.className = "action-editor";
    const type = field(
      "執行動作",
      prefix + "action-type",
      initial?.type || (allowNone ? "none" : "text"),
      [...(allowNone ? [["none", "不做其他動作"]] : []), ...Object.entries(ACTIONS)],
      () => update(),
    );
    const target = field("目標元件", prefix + "target", "", [], () => {});
    const value = field(
      "要顯示的文字",
      prefix + "action-value",
      initial?.value ?? "互動成功！",
      null,
      () => {},
    );
    container.append(type, target, value);
    function update() {
      const kind = type.querySelector("select").value,
        select = target.querySelector("select"),
        previous = select.value || initial?.target;
      select.replaceChildren();
      for (const candidate of all()) {
        if (
          ["text", "increment", "input"].includes(kind) &&
          (CONTAINERS.has(candidate.tag) ||
            VOID.has(candidate.tag) ||
            candidate.tag === "textarea")
        )
          continue;
        const option = document.createElement("option");
        option.value = candidate.id;
        option.textContent = nodeLabel(candidate.id);
        select.append(option);
      }
      if ([...select.options].some((o) => o.value === previous)) select.value = previous;
      target.hidden = kind === "none";
      value.hidden = kind !== "text";
    }
    update();
    return {
      container,
      read: () => ({
        type: type.querySelector("select").value,
        target: target.querySelector("select").value,
        value: value.querySelector("input").value,
      }),
    };
  }
  const conditionMode = field(
    "執行條件",
    "condition-mode",
    draft.condition?.operator || "always",
    [
      ["always", "每次都執行"],
      ["empty", "來源內容是空白"],
      ["not-empty", "來源內容不是空白"],
      ["equals", "來源內容等於指定文字"],
    ],
    () => updateCondition(),
  );
  const sources = all()
    .filter((item) => !CONTAINERS.has(item.tag) && !["img", "hr"].includes(item.tag))
    .map((item) => [item.id, nodeLabel(item.id)]);
  const conditionSource = field(
    "條件來源",
    "condition-source",
    draft.condition?.source || sources[0]?.[0] || "",
    sources,
    () => {},
  );
  const conditionValue = field(
    "要比對的文字",
    "condition-value",
    draft.condition?.value || "",
    null,
    () => {},
  );
  form.append(
    heading(editingAction ? "正在編輯互動" : "新增事件與動作"),
    conditionMode,
    conditionSource,
    conditionValue,
  );
  const first = actionEditor("", draft);
  form.append(heading("條件成立時：第一個動作"), first.container);
  const stepArea = document.createElement("div");
  const stepEditors = [];
  function appendStep(initial) {
    if (stepEditors.length >= 10) {
      message("單一互動最多 10 個後續動作。");
      return;
    }
    const item = actionEditor(
      "step-" + stepEditors.length + "-",
      initial || { type: "text", value: "下一個動作" },
    );
    item.removed = false;
    const remove = button("移除此步驟", () => {
      item.removed = true;
      item.container.remove();
    });
    item.container.prepend(heading("接著執行"));
    item.container.append(remove);
    stepEditors.push(item);
    stepArea.append(item.container);
  }
  (draft.steps || []).forEach(appendStep);
  form.append(
    stepArea,
    button("＋ 新增後續動作", () => appendStep()),
  );
  const otherwise = actionEditor("else-", draft.otherwise, true);
  const elseWrap = document.createElement("div");
  elseWrap.append(heading("否則執行"), otherwise.container);
  form.append(elseWrap);
  function updateCondition() {
    const mode = conditionMode.querySelector("select").value;
    conditionSource.hidden = mode === "always";
    conditionValue.hidden = mode !== "equals";
    elseWrap.hidden = mode === "always";
  }
  updateCondition();
  const submit = document.createElement("button");
  submit.className = "primary";
  submit.textContent = editingAction ? "儲存互動修改" : "＋ 新增互動";
  form.append(submit);
  if (editingAction)
    form.append(
      button("取消編輯", () => {
        editingAction = null;
        renderInspector();
      }),
    );
  form.onsubmit = (event) => {
    event.preventDefault();
    const group = { event: eventField.querySelector("select").value, ...first.read() };
    group.steps = stepEditors.filter((item) => !item.removed).map((item) => item.read());
    if (["input", "change"].includes(group.event) && !["input", "textarea"].includes(n.tag)) {
      message("輸入／變更事件請設定在輸入框上。");
      return;
    }
    if (group.event === "submit" && n.tag !== "form") {
      message("送出事件請設定在 form 上。");
      return;
    }
    const mode = conditionMode.querySelector("select").value;
    if (mode !== "always") {
      const source = conditionSource.querySelector("select").value;
      if (!source) {
        message("請先加入條件來源，例如輸入框。");
        return;
      }
      group.condition = {
        source,
        operator: mode,
        value: conditionValue.querySelector("input").value,
      };
      const other = otherwise.read();
      if (other.type !== "none") group.otherwise = other;
    }
    for (const action of [
      group,
      ...group.steps,
      ...(group.otherwise ? [group.otherwise] : []),
    ]) {
      if (!find(action.target)) {
        message("請選擇每個動作的目標元件。");
        return;
      }
      if (action.type === "input" && !["input", "textarea"].includes(n.tag)) {
        message("讀取目前輸入的動作必須放在輸入框上。");
        return;
      }
    }
    const edit = editingAction;
    editingAction = null;
    commit(
      () => {
        if (edit) n.actions[edit.index] = group;
        else n.actions.push(group);
      },
      edit ? "已更新互動及 JavaScript。" : "已新增條件與動作；請開啟操作預覽。",
    );
  };
  box.append(form);
}

function renderTree() {
  const tree = $("#tree");
  tree.replaceChildren();
  function visit(n, depth) {
    const row = document.createElement("div");
    row.className = "tree-row" + (selected === n.id ? " selected" : "");
    row.style.paddingLeft = depth * 10 + "px";
    row.dataset.node = n.id;
    const b = button("<" + n.tag + "> " + (n.text ? n.text.slice(0, 12) : "#" + n.id), () =>
      select(n.id),
    );
    b.draggable = n.id !== "root";
    b.addEventListener("dragstart", (e) => startDrag(e, { kind: "move", id: n.id }));
    row.append(b);
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      row.classList.add("drag-over");
    });
    row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      row.classList.remove("drag-over");
      handleDrop(e, n, row);
    });
    tree.append(row);
    n.children.forEach((c) => visit(c, depth + 1));
  }
  visit(model.root, 0);
}
function startDrag(event, data) {
  dragInfo = data;
  event.dataTransfer.setData("application/x-web-builder", JSON.stringify(data));
  event.dataTransfer.setData("text/plain", JSON.stringify(data));
  event.dataTransfer.effectAllowed = data.kind === "move" ? "move" : "copy";
}
function placement(event, node, element) {
  const rect = element.getBoundingClientRect(),
    fraction = (event.clientY - rect.top) / Math.max(rect.height, 1);
  if (node.id === "root" || (CONTAINERS.has(node.tag) && fraction > 0.22 && fraction < 0.78))
    return { target: node, index: node.children.length, inside: true };
  const parent = parentOf(node.id) || model.root,
    index = parent.children.findIndex((n) => n.id === node.id) + (fraction > 0.5 ? 1 : 0);
  return { target: parent, index, inside: false };
}
function dropProblem(info, place) {
  const node = info?.kind === "move" ? find(info.id) : { tag: info?.tag, children: [] };
  if (!node) return "找不到元件";
  if (
    info?.kind === "move" &&
    (node.id === place.target.id || all(node).some((n) => n.id === place.target.id))
  )
    return "不能放入自己或自己的子元件";
  if (!canContain(place.target, node))
    return place.target.tag === "ul"
      ? "ul 內只能放 li 清單項目"
      : node.tag === "li"
        ? "li 必須放進 ul 清單"
        : "這裡不能放入此元件（例如巢狀表單）";
  return "";
}
function dropFeedback(doc, event, element, info) {
  doc.querySelectorAll("[data-drop-target],[data-drop-invalid]").forEach((el) => {
    el.removeAttribute("data-drop-target");
    el.removeAttribute("data-drop-invalid");
  });
  let line = doc.getElementById("__builder-drop-line");
  if (!line) {
    line = doc.createElement("div");
    line.id = "__builder-drop-line";
    line.style.cssText = "position:fixed;pointer-events:none;height:3px;z-index:2147483647;";
    doc.body.append(line);
  }
  const node = find(element.dataset.builderId),
    place = placement(event, node, element),
    problem = dropProblem(info, place),
    rect = element.getBoundingClientRect();
  element.setAttribute("data-drop-target", "");
  if (problem) element.setAttribute("data-drop-invalid", "");
  line.style.display = place.inside ? "none" : "block";
  line.style.top =
    (event.clientY < rect.top + rect.height / 2 ? rect.top : rect.bottom - 2) + "px";
  line.style.left = rect.left + "px";
  line.style.width = rect.width + "px";
  line.style.background = problem ? "#be5546" : "#3d8a51";
  $("#drop-hint").textContent = problem
    ? "無法放置：" + problem
    : (place.inside
        ? "放入容器："
        : event.clientY < rect.top + rect.height / 2
          ? "插在此元件前面："
          : "插在此元件後面：") + nodeLabel(place.inside ? place.target.id : node.id);
}
function handleDrop(event, node, element) {
  let data;
  try {
    data = JSON.parse(
      event.dataTransfer.getData("application/x-web-builder") ||
        event.dataTransfer.getData("text/plain"),
    );
  } catch {
    message("請從左側拖入元件。");
    return;
  }
  const place = placement(event, node, element);
  const problem = dropProblem(data, place);
  if (problem) {
    message(problem);
    return;
  }
  // Let the native drop/dragend finish before replacing the iframe document.
  setTimeout(() => {
    if (data.kind === "new" && TAGS.has(data.tag) && data.tag !== "main")
      add(data.tag, place.target, place.index);
    if (data.kind === "move") move(data.id, place.target, place.index);
  }, 50);
  $("#drop-hint").textContent = "";
}
$("#canvas").addEventListener("load", () => {
  const doc = $("#canvas").contentDocument;
  if (!doc) return;
  let pointerDrag = null;
  let suppressClick = false;
  const clearDrop = () => {
    doc
      .querySelectorAll("[data-drop-target]")
      .forEach((el) => el.removeAttribute("data-drop-target"));
    doc.getElementById("__builder-drop-line")?.remove();
    doc
      .querySelectorAll("[data-drop-invalid]")
      .forEach((el) => el.removeAttribute("data-drop-invalid"));
    $("#drop-hint").textContent = "";
  };
  doc.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const el = event.target.closest("[data-builder-id]");
    if (!el || el.dataset.builderId === "root") return;
    pointerDrag = {
      id: el.dataset.builderId,
      x: event.clientX,
      y: event.clientY,
      active: false,
    };
    el.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  doc.addEventListener("pointermove", (event) => {
    if (!pointerDrag) return;
    if (
      Math.hypot(event.clientX - pointerDrag.x, event.clientY - pointerDrag.y) < 8 &&
      !pointerDrag.active
    )
      return;
    pointerDrag.active = true;
    const el = doc.elementFromPoint(event.clientX, event.clientY)?.closest("[data-builder-id]");
    clearDrop();
    if (el) dropFeedback(doc, event, el, { kind: "move", id: pointerDrag.id });
    event.preventDefault();
  });
  doc.addEventListener("pointerup", (event) => {
    const drag = pointerDrag;
    pointerDrag = null;
    if (!drag?.active) return;
    suppressClick = true;
    const el = doc.elementFromPoint(event.clientX, event.clientY)?.closest("[data-builder-id]");
    if (el) {
      const place = placement(event, find(el.dataset.builderId), el);
      setTimeout(() => move(drag.id, place.target, place.index), 50);
    }
    clearDrop();
  });
  doc.addEventListener("pointercancel", () => {
    pointerDrag = null;
    clearDrop();
  });
  doc.addEventListener("click", (event) => {
    event.preventDefault();
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const el = event.target.closest("[data-builder-id]");
    if (el) select(el.dataset.builderId);
  });
  doc.addEventListener("submit", (event) => event.preventDefault());
  // Palette/tree use native drag-and-drop. Canvas moves use pointer events so
  // replacing the iframe never destroys the browser's native drag source.
  doc.addEventListener("dragstart", (event) => event.preventDefault());
  doc.addEventListener("dragover", (e) => {
    e.preventDefault();
    const el =
      e.target.closest("[data-builder-id]") || doc.querySelector('[data-builder-id="root"]');
    doc
      .querySelectorAll("[data-drop-target]")
      .forEach((n) => n.removeAttribute("data-drop-target"));
    if (el) dropFeedback(doc, e, el, dragInfo);
  });
  doc.addEventListener("drop", (e) => {
    e.preventDefault();
    const el =
      e.target.closest("[data-builder-id]") || doc.querySelector('[data-builder-id="root"]');
    if (el) handleDrop(e, find(el.dataset.builderId), el);
  });
  doc.addEventListener("dragend", () => {
    clearDrop();
    doc
      .querySelectorAll("[data-drop-target]")
      .forEach((n) => n.removeAttribute("data-drop-target"));
    $("#drop-hint").textContent = "";
  });
  renderSelection();
});
function validateProject(input) {
  if (input?.version !== 1 || input.root?.id !== "root" || input.root?.tag !== "main")
    throw Error("請載入這個編輯器匯出的專案 JSON。");
  let count = 0;
  const ids = new Set();
  function cleanStyles(source) {
    const result = {};
    for (const [key, value] of Object.entries(source || {}))
      if (
        STYLE_KEYS.includes(key) &&
        typeof value === "string" &&
        !/[<>;{}]/.test(value) &&
        CSS.supports(key, value)
      )
        result[key] = value;
    return result;
  }
  function cleanStep(a) {
    if (!a || !Object.hasOwn(ACTIONS, a.type) || typeof a.target !== "string")
      throw Error("互動動作格式不正確");
    return { type: a.type, target: a.target, value: String(a.value || "").slice(0, 5000) };
  }
  function clean(n, depth = 0) {
    if (depth > 15 || ++count > 300) throw Error("限制 300 個元件、15 層巢狀。");
    if (!TAGS.has(n.tag) || !(n.id === "root" || /^el-\d+$/.test(n.id)) || ids.has(n.id))
      throw Error("元件種類或 ID 無效。");
    ids.add(n.id);
    const styles = {};
    for (const [k, v] of Object.entries(n.styles || {})) {
      if (
        STYLE_KEYS.includes(k) &&
        typeof v === "string" &&
        !/[<>;{}]/.test(v) &&
        CSS.supports(k, v)
      )
        styles[k] = v;
    }
    const attrs = {};
    for (const [k, v] of Object.entries(n.attrs || {})) {
      if (
        !["type", "placeholder", "href", "src", "alt", "rows", "aria-label"].includes(k) ||
        typeof v !== "string"
      )
        continue;
      if (k === "href" && !/^(#|https?:\/\/|mailto:)/i.test(v)) continue;
      if (k === "src" && !/^data:image\/(png|jpeg|webp|svg\+xml)[;,]/i.test(v)) continue;
      attrs[k] = v;
    }
    const text = String(n.text || "").slice(0, 5000),
      children = (Array.isArray(n.children) ? n.children : []).map((child) =>
        clean(child, depth + 1),
      );
    if (children.length && !CONTAINERS.has(n.tag)) throw Error("非容器元件不可有子元件。");
    if (n.tag === "ul" && children.some((c) => c.tag !== "li"))
      throw Error("ul 子元件必須是 li。");
    const responsive = {
      tablet: cleanStyles(n.responsive?.tablet),
      mobile: cleanStyles(n.responsive?.mobile),
    };
    const actions = (Array.isArray(n.actions) ? n.actions : [])
      .filter(
        (a) =>
          EVENTS.has(a.event) && Object.hasOwn(ACTIONS, a.type) && typeof a.target === "string",
      )
      .map((a) => {
        const action = { event: a.event, ...cleanStep(a) };
        if (a.condition) {
          if (
            !["empty", "not-empty", "equals"].includes(a.condition.operator) ||
            typeof a.condition.source !== "string"
          )
            throw Error("互動條件格式不正確");
          action.condition = {
            source: a.condition.source,
            operator: a.condition.operator,
            value: String(a.condition.value || "").slice(0, 5000),
          };
        }
        if (a.otherwise) action.otherwise = cleanStep(a.otherwise);
        if (a.steps) {
          if (!Array.isArray(a.steps) || a.steps.length > 10) throw Error("後續動作最多10步");
          action.steps = a.steps.map(cleanStep);
        }
        return action;
      });
    return { id: n.id, tag: n.tag, text, attrs, styles, responsive, children, actions };
  }
  const result = {
    version: 1,
    name: String(input.name || "我的網頁作品").slice(0, 60),
    root: clean(input.root),
  };
  for (const n of all(result.root))
    n.actions = n.actions.filter((action) =>
      actionReferences(action).every((id) => ids.has(id)),
    );

  return result;
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function demo() {
  commit(() => {
    model = blank();
    const section = make("section");
    section.styles = {
      display: "flex",
      "flex-direction": "column",
      gap: "16px",
      padding: "36px",
      "background-color": "#f0f5e9",
      "border-radius": "12px",
    };
    const h = make("h1");
    h.text = "讓你的第一個互動發生。";
    h.styles = { "font-size": "32px", margin: "0", color: "#224f36" };
    const p = make("p");
    p.text = "點擊按鈕，看看下方的數字。";
    p.styles = { margin: "0", color: "#65795d" };
    const count = make("p");
    count.text = "0";
    count.styles = { "font-size": "42px", "font-weight": "700", margin: "0" };
    const b = make("button");
    b.text = "＋ 增加一次";
    b.styles.width = "fit-content";
    b.actions = [{ event: "click", type: "increment", target: count.id, value: "" }];
    section.children = [h, p, count, b];
    model.root.children = [section];
    selected = section.id;
  }, "已載入可操作的範例；按「操作預覽」試試按鈕，也可以復原。");
}
function sidebarDemo() {
  commit(() => {
    model = blank();
    model.name = "可收合側邊欄範例";
    model.root.styles = {
      padding: "0", "min-height": "600px", "background-color": "#f4f6f2", color: "#263c2d",
    };
    const node = (tag, text, styles) => {
      const n = make(tag);
      n.text = text;
      n.styles = styles;
      n.responsive = { tablet: {}, mobile: {} };
      return n;
    };
    const header = node("header", "", {
      display: "flex", "align-items": "center", "flex-wrap": "wrap", gap: "16px",
      padding: "18px 24px", "background-color": "#ffffff", border: "1px solid #d9e3d2",
    });
    const toggle = node("button", "☰ 收合側邊欄", {
      padding: "10px 16px", "background-color": "#2d694c", color: "#ffffff",
      border: "none", "border-radius": "6px",
    });
    const brand = node("h1", "我的工作空間", { margin: "0", "font-size": "22px" });
    header.children = [toggle, brand];
    const layout = node("div", "", { display: "flex", "align-items": "stretch", "min-height": "510px" });
    const sidebar = node("nav", "", {
      display: "flex", "flex-direction": "column", gap: "12px", width: "220px", flex: "0 0 220px",
      padding: "24px", "background-color": "#e8efe4",
    });
    sidebar.attrs = { "aria-label": "工作空間導覽" };
    sidebar.responsive = { mobile: { width: "120px", flex: "0 0 120px", padding: "16px 12px" } };
    sidebar.children = [node("h2", "導覽選單", { margin: "0 0 12px", "font-size": "16px" })];
    const content = node("section", "", { flex: "1", width: "0", padding: "32px" });
    content.responsive = { mobile: { padding: "20px 12px" } };
    const title = node("h2", "總覽", { margin: "0 0 16px", "font-size": "28px" });
    const description = node("p", "歡迎回來！點擊左上角按鈕收合側邊欄，內容區就會自動展開。", { margin: "0 0 24px" });
    const card = node("article", "", {
      padding: "24px", "background-color": "#ffffff", border: "1px solid #d9e3d2", "border-radius": "8px",
    });
    card.children = [
      node("h2", "從這裡開始你的頁面", { margin: "0 0 12px", "font-size": "20px" }),
      node("p", "你可以修改文字、顏色和排版，或在側邊欄加入更多按鈕。導覽按鈕也能切換內容區的標題與說明。", { margin: "0" }),
    ];
    content.children = [title, description, card];
    for (const [label, detail] of [
      ["總覽", "歡迎回來！點擊左上角按鈕收合側邊欄，內容區就會自動展開。"],
      ["我的專案", "在這裡整理你的專案。你可以把這段內容換成專案清單。"],
      ["設定", "在這裡調整工作空間。你可以加入輸入框與更多互動。"],
    ]) {
      const item = node("button", label, {
        padding: "10px 12px", "text-align": "left", "background-color": "#ffffff", color: "#263c2d",
        border: "1px solid #c8d6c2", "border-radius": "6px",
      });
      item.actions = [{ event: "click", type: "text", target: title.id, value: label,
        steps: [{ type: "text", target: description.id, value: detail }] }];
      sidebar.children.push(item);
    }
    toggle.actions = [
      { event: "click", type: "text", target: toggle.id, value: "☰ 展開側邊欄",
        condition: { source: toggle.id, operator: "equals", value: "☰ 收合側邊欄" },
        otherwise: { type: "text", target: toggle.id, value: "☰ 收合側邊欄" } },
      { event: "click", type: "toggle", target: sidebar.id, value: "" },
    ];
    layout.children = [sidebar, content];
    model.root.children = [header, layout];
    selected = toggle.id;
  }, "已載入可收合側邊欄；按「操作預覽」即可試用，所有元件與互動都可以編輯。");
}
function stickyHeaderDemo() {
  commit(() => {
    model = blank();
    model.name = "捲動固定頂部導覽列";
    model.root.styles = { padding: "0", "background-color": "#f7f4ee", color: "#263c35" };
    const node = (tag, text, styles = {}) => {
      const n = make(tag);
      n.text = text;
      n.styles = styles;
      n.responsive = { tablet: {}, mobile: {} };
      return n;
    };
    const header = node("header", "", {
      position: "sticky", top: "0", "z-index": "10", display: "flex", "align-items": "center",
      "justify-content": "space-between", "flex-wrap": "wrap", gap: "12px", padding: "16px 24px",
      "background-color": "#ffffff", "box-shadow": "0 3px 16px rgba(38, 60, 53, 0.12)",
    });
    header.children = [node("h2", "向下探索 ↓", { margin: "0", "font-size": "20px" })];
    const nav = node("nav", "", { display: "flex", gap: "16px", "flex-wrap": "wrap" });
    nav.attrs = { "aria-label": "頁面區段導覽" };
    const content = node("div", "", { "max-width": "860px", margin: "0 auto", padding: "32px 24px" });
    for (const [name, title, description, color] of [
      ["開始", "往下捲動，導覽列會留在上方。", "使用滑鼠滾輪或觸控板往下捲。留意頂部白色導覽列，它會持續留在畫面上方；也可以點導覽連結跳到各區段。", "#e5eee5"],
      ["原理", "關鍵是 sticky 和 top。", "position: sticky 讓導覽列先參與正常排版，捲到 top: 0 的位置後停留。z-index: 10 讓它顯示在內容上方，白色背景避免底下文字透出。", "#ede7db"],
      ["練習", "修改一行，觀察差別。", "回到編輯畫布，選擇導覽列，點 CSS 原始碼中的 position: sticky。試著改成 static，或把 top 改成 16px，再按操作預覽向下捲動。", "#e5eaf1"],
    ]) {
      const section = node("section", "", { "min-height": "560px", "scroll-margin-top": "110px", padding: "32px", margin: "0 0 24px", "background-color": color, "border-radius": "16px" });
      section.responsive.mobile = { padding: "24px 16px" };
      section.children = [node("h1", title, { margin: "0 0 20px", "font-size": "30px" }), node("p", description, { "font-size": "18px", "line-height": "1.8" })];
      content.children.push(section);
      const link = node("a", name, { color: "#285d46", "font-weight": "700" });
      link.attrs = { href: "#" + section.id };
      nav.children.push(link);
    }
    header.children.push(nav);
    model.root.children = [header, content];
    selected = header.id;
  }, "已載入固定頂部導覽列；按「操作預覽」向下捲動，或點導覽連結。點 CSS 的 position、top、z-index 可查看解說。");
}
function toolRailDemo() {
  commit(() => {
    model = blank();
    model.name = "全高側邊工具列";
    model.root.styles = { padding: "0", "background-color": "#ffffff", color: "#292929" };
    const node = (tag, text, styles = {}) => {
      const n = make(tag);
      Object.assign(n, { text, styles, responsive: { tablet: {}, mobile: {} } });
      return n;
    };
    const shell = node("div", "", { position: "relative", display: "flex", height: "100vh", overflow: "hidden" });
    const rail = node("nav", "", {
      width: "64px", flex: "0 0 64px", display: "flex", "flex-direction": "column",
      "align-items": "center", gap: "16px", padding: "20px 8px", "background-color": "#202b40",
    });
    rail.attrs = { "aria-label": "面板工具列" };
    const pane = node("section", "", {
      width: "260px", flex: "0 0 260px", height: "100%", display: "flex", "flex-direction": "column",
      padding: "24px 18px", "background-color": "#f5f5f5", border: "1px solid #e7e7e7", overflow: "auto",
    });
    pane.attrs = { "aria-label": "全高工具側欄" };
    pane.responsive.mobile = { position: "absolute", left: "64px", top: "0", bottom: "0", width: "calc(100% - 64px)", "z-index": "2" };
    const title = node("h2", "專案", { margin: "0 0 24px", "font-size": "20px" });
    const detail = node("p", "你的工作空間", { margin: "0 0 12px", "font-size": "12px", color: "#737373" });
    const list = node("div", "", { display: "flex", "flex-direction": "column", gap: "4px" });
    const rows = ["我的網頁作品", "側邊欄設計練習", "固定導覽列範例"].map(text => node("p", text, { margin: "0", padding: "12px 10px", "font-size": "14px" }));
    list.children = rows;
    const footer = node("p", "再按目前的工具圖示即可收合側欄。", { "margin-top": "auto", "padding-top": "32px", "font-size": "12px", color: "#737373" });
    pane.children = [title, detail, list, footer];
    const content = node("section", "", { flex: "1", width: "0", height: "100%", overflow: "auto", display: "flex", "flex-direction": "column", padding: "24px 32px" });
    content.attrs = { "aria-label": "主要工作區" };
    content.responsive.mobile = { padding: "20px 16px" };
    const heading = node("p", "組裝室 / 側欄練習", { margin: "0", color: "#737373", "font-size": "14px" });
    const intro = node("article", "", { width: "100%", "max-width": "640px", margin: "auto", padding: "48px 0" });
    intro.children = [
      node("h1", "今天想做什麼？", { "font-size": "32px", margin: "0 0 20px" }),
      node("p", "從左邊選擇專案、筆記或設定。側欄會從頂部延伸到底部，和主要工作區並排。", { color: "#646464", "line-height": "1.8" }),
      node("h2", "試試工具按鈕", { "font-size": "16px", "margin-top": "32px" }),
      node("p", "按目前的圖示：收合或展開側欄。按其他圖示：開啟對應內容。收合後，右邊工作區會自動變寬。", { color: "#646464" }),
      node("p", "回到編輯器，點 CSS 的 height: 100vh、display: flex 和 overflow: auto，再看工具按鈕的條件判斷與 hidden 切換。", { "font-size": "13px", color: "#737373" }),
    ];
    const note = node("textarea", "", { width: "100%", "max-width": "640px", "min-height": "96px", margin: "0 auto", padding: "16px", border: "1px solid #dedede", "border-radius": "16px", "background-color": "#fafafa" });
    note.attrs = { "aria-label": "練習筆記", placeholder: "記下你觀察到的排版變化…", rows: "3" };
    content.children = [heading, intro, note];
    for (const [icon, name, description, items] of [
      ["▦", "專案", "你的工作空間", ["我的網頁作品", "側邊欄設計練習", "固定導覽列範例"]],
      ["✎", "筆記", "最近的學習筆記", ["HTML：頁面的結構", "CSS：全高與伸縮排版", "JavaScript：按鈕開關"]],
      ["⚙", "設定", "可以在編輯器調整的項目", ["側欄寬度：260px", "頁面高度：100vh", "手機版：側欄覆蓋內容"]],
    ]) {
      const tool = node("button", icon, { width: "44px", height: "44px", padding: "0", "font-size": "24px",
        border: "1px solid #53617a", "border-radius": "12px", "background-color": "#35435e", color: "#ffffff" });
      tool.attrs = { "aria-label": "切換" + name + "側欄" };
      tool.actions = [
        { event: "click", type: "toggle", target: pane.id, value: "",
          condition: { source: title.id, operator: "equals", value: name },
          otherwise: { type: "show", target: pane.id, value: "" } },
        { event: "click", type: "text", target: title.id, value: name, steps: [
          { type: "text", target: detail.id, value: description },
          ...rows.map((row, i) => ({ type: "text", target: row.id, value: items[i] })),
        ] },
      ];
      rail.children.push(tool);
    }
    shell.children = [rail, pane, content];
    model.root.children = [shell];
    selected = pane.id;
  }, "已載入全高側邊工具列；按同一圖示開關側欄，按其他圖示切換內容。桌面並排，手機覆蓋，工具列持續保留。");
}
for (const [tag, label] of TYPES) {
  const b = document.createElement("button");
  b.draggable = true;
  b.dataset.component = tag;
  b.textContent = label;
  const small = document.createElement("small");
  small.textContent = "<" + tag + ">";
  b.append(small);
  b.addEventListener("dragstart", (e) => startDrag(e, { kind: "new", tag }));
  b.onclick = () => add(tag);
  $("#palette").append(b);
}
document.querySelectorAll("[data-left]").forEach(
  (b) =>
    (b.onclick = () => {
      document
        .querySelectorAll("[data-left]")
        .forEach((item) => item.classList.toggle("active", item === b));
      $("#components").hidden = b.dataset.left !== "components";
      $("#tree-panel").hidden = b.dataset.left !== "tree";
    }),
);
document.querySelectorAll("[data-panel]").forEach(
  (b) =>
    (b.onclick = () => {
      panel = b.dataset.panel;
      codeTab = panel;
      renderInspector();
      renderCode();
    }),
);
document.querySelectorAll("[data-code]").forEach(
  (b) =>
    (b.onclick = () => {
      codeTab = b.dataset.code;
      renderCode();
    }),
);
$("#toggle-sidebar").onclick = () => {
  const hidden = $(".workspace").classList.toggle("sidebar-closed");
  $("#toggle-sidebar").setAttribute("aria-expanded", !hidden);
  $("#toggle-sidebar").textContent = hidden ? "← 展開右側欄" : "收合右側欄 →";
};
$("#undo").onclick = () => {
  if (!history.length) return;
  const previous = clone(model);
  future.push(clone(model));
  model = history.pop();
  selected = "root";
  refresh();
  persist();
  message("已復原上一個操作。");
  renderOperationLesson(BuilderLearning.operation(previous, model, "復原：把作品還原到上一個狀態。"));
};
$("#redo").onclick = () => {
  if (!future.length) return;
  const previous = clone(model);
  history.push(clone(model));
  model = future.pop();
  selected = "root";
  refresh();
  persist();
  message("已重做。");
  renderOperationLesson(BuilderLearning.operation(previous, model, "重做：重新套用剛才復原的變更。"));
};
$("#demo").onclick = () => $("#templates-dialog").showModal();
$("#close-templates").onclick = () => $("#templates-dialog").close();
document.querySelectorAll("[data-template]").forEach((button) => {
  button.onclick = () => {
    if (button.dataset.template === "sticky-header") stickyHeaderDemo();
    else if (button.dataset.template === "tool-rail") toolRailDemo();
    else if (button.dataset.template === "sidebar") sidebarDemo();
    else demo();
    $("#templates-dialog").close();
  };
});
$("#reset").onclick = () =>
  commit(() => {
    model = blank();
    selected = "root";
  }, "已清空畫布；可按復原找回剛才的設計。");
$("#preview-button").onclick = () => {
  $("#runtime").style.width = width === "full" ? "100%" : width + "px";
  $("#runtime").srcdoc = documentHTML(false);
  $("#preview-dialog").showModal();
};
$("#close-preview").onclick = () => {
  $("#preview-dialog").close();
  $("#runtime").removeAttribute("srcdoc");
};
$("#export-html").onclick = () => {
  download("my-visual-webpage.html", documentHTML(false), "text/html;charset=utf-8");
  message("已匯出包含 HTML、CSS、JavaScript 的獨立網頁，可直接用瀏覽器開啟。");
};
$("#save-project").onclick = () =>
  download("my-visual-project.json", JSON.stringify(model, null, 2), "application/json");
$("#import-project").onclick = () => $("#project-file").click();
let sourceConversion = null, sourceRevision = 0, sourceAssets = [], sourceBusy = false;
function invalidateSource() {
  sourceRevision++;
  sourceConversion = null;
  $("#load-source").disabled = true;
  $("#download-source").disabled = true;
  $("#source-result").textContent = "原始碼已變更，請重新分析。";
}
$("#import-source").onclick = () => $("#source-dialog").showModal();
$("#close-source").onclick = () => $("#source-dialog").close();
$("#clear-source-files").onclick = () => {
  sourceAssets = [];
  invalidateSource();
  $("#source-file-status").textContent = "已清除附加的 CSS／JS 檔案；下方貼上的原始碼仍會參與分析。";
};
for (const selector of ["#source-html", "#source-css", "#source-js"])
  $(selector).addEventListener("input", invalidateSource);
async function readSourceFiles(files) {
  invalidateSource();
  const revision = sourceRevision;
  try {
    const list = [...files];
    if (sourceBusy) throw Error("請等待目前分析完成後再選取檔案。");
    if (!list.length) return;
    if (list.length > 20) throw Error("一次最多選取 20 個檔案。");
    if (new Set(list.map(f => f.name)).size !== list.length) throw Error("附加檔案不可同名，請先重新命名並更新 HTML 中的引用。");
    if (list.some(f => !/\.(html?|css|m?js)$/i.test(f.name))) throw Error("僅接受 HTML、CSS、JavaScript 檔案。");
    if (list.reduce((sum, f) => sum + f.size, 0) > 5 * 1024 * 1024) throw Error("檔案合計最多 5 MB。");
    const html = list.filter(f => /\.html?$/i.test(f.name));
    if (html.length > 1) throw Error("每次只匯入一個 HTML 頁面，其他可選取 CSS、JS。");
    const values = await Promise.all(list.map(async f => ({ name: f.name, text: await f.text() })));
    if (revision !== sourceRevision) return;
    if (html.length) $("#source-html").value = values.find(f => f.name === html[0].name).text;
    sourceAssets = values.filter(f => !/\.html?$/i.test(f.name));
    $("#source-file-status").textContent = "已讀取：" + values.map(f => f.name).join("、") + "。CSS／JS 檔案會與上方貼上的內容一起分析。";
    $("#source-result").textContent = "檔案已就緒，按「分析並轉換」。";
  } catch (error) { $("#source-file-status").textContent = "讀取失敗：" + error.message; }
  finally { $("#source-files").value = ""; }
}
$("#source-files").onchange = () => readSourceFiles($("#source-files").files);
$(".source-files").addEventListener("dragover", event => event.preventDefault());
$(".source-files").addEventListener("drop", event => {
  event.preventDefault();
  readSourceFiles(event.dataTransfer.files);
});
$("#analyze-source").onclick = async () => {
  if (sourceBusy) return;
  invalidateSource();
  const revision = sourceRevision;
  sourceBusy = true;
  $("#analyze-source").disabled = true;
  $("#source-result").textContent = "正在分析結構、三種螢幕寬度的樣式與互動…";
  try {
    const result = await SourceImporter.convert({
      html: $("#source-html").value, css: $("#source-css").value,
      javascript: $("#source-js").value, assets: sourceAssets,
    }, { tags: [...TAGS], containers: [...CONTAINERS], styleKeys: STYLE_KEYS });
    if (revision !== sourceRevision) return;
    result.project = validateProject(result.project);
    sourceConversion = result;
    const summary = document.createElement("strong");
    summary.textContent = "轉換完成：" + result.stats.nodes + " 個元件、" + result.stats.actions + " 筆互動。";
    $("#source-result").replaceChildren(summary);
    if (result.warnings.length) {
      const ul = document.createElement("ul");
      for (const warning of result.warnings) {
        const li = document.createElement("li"); li.textContent = warning; ul.append(li);
      }
      $("#source-result").append(ul);
    }
    $("#load-source").disabled = false;
    $("#download-source").disabled = false;
  } catch (error) {
    if (revision === sourceRevision) $("#source-result").textContent = "轉換失敗：" + error.message;
  } finally {
    sourceBusy = false;
    $("#analyze-source").disabled = false;
  }
};
$("#load-source").onclick = () => {
  if (!sourceConversion) return;
  commit(() => {
    model = clone(sourceConversion.project);
    selected = "root";
  }, "已載入原始碼轉換結果；可繼續編輯，或按復原找回原作品。請到操作預覽確認成果。");
  $("#source-dialog").close();
};
$("#download-source").onclick = () => {
  if (sourceConversion) download("imported-visual-project.json", JSON.stringify(sourceConversion.project, null, 2), "application/json");
};
$("#project-file").onchange = async () => {
  const file = $("#project-file").files[0];
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw Error("專案檔限制 5 MB。");
    const input = validateProject(JSON.parse(await file.text()));
    commit(() => {
      model = input;
      selected = "root";
    }, "已載入專案，可繼續編輯。");
  } catch (error) {
    message("載入失敗：" + error.message);
  } finally {
    $("#project-file").value = "";
  }
};
$("#copy-code").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("#source-code").textContent);
    message("已複製 " + { html: "HTML", css: "CSS", js: "JavaScript" }[codeTab] + " 原始碼。");
  } catch {
    const selection = window.getSelection(),
      range = document.createRange();
    range.selectNodeContents($("#source-code"));
    selection.removeAllRanges();
    selection.addRange(range);
    message("瀏覽器未允許自動複製，已選取原始碼；請按 Ctrl／Command+C。");
  }
};
function setBreakpoint(button) {
  width = button.dataset.width;
  activeBreakpoint = width === "375" ? "mobile" : width === "768" ? "tablet" : "desktop";
  lastStyleKey = "";
  $("#canvas-wrap").style.width = width === "full" ? "calc(100% - 40px)" : width + "px";
  document
    .querySelectorAll("[data-width]")
    .forEach((item) => item.setAttribute("aria-pressed", item === button));
  refresh();
  message("正在編輯 " + BREAKPOINTS[activeBreakpoint] + "；樣式會匯出為真正的 @media。");
}
document
  .querySelectorAll("[data-width]")
  .forEach((button) => (button.onclick = () => setBreakpoint(button)));
new ResizeObserver(
  () =>
    ($("#canvas-width").textContent =
      Math.round($("#canvas").getBoundingClientRect().width) + " px"),
).observe($("#canvas"));
document.addEventListener("keydown", (e) => {
  const editable = e.target.closest("input,textarea,select,[contenteditable]");
  if (!editable && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    (e.shiftKey ? $("#redo") : $("#undo")).click();
  }
  if (!editable && e.key === "Delete") removeSelected();
});
function readVersions() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE + "-versions"));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
function saveVersion(note) {
  const record = {
    id: crypto.randomUUID(),
    name: note || model.name || "未命名版本",
    created: new Date().toISOString(),
    model: clone(model),
  };
  const versions = [record, ...readVersions()].slice(0, 10);
  try {
    localStorage.setItem(STORAGE + "-versions", JSON.stringify(versions));
    $("#version-status").textContent = "已保存「" + record.name + "」。";
    renderVersions();
    return true;
  } catch {
    $("#version-status").textContent =
      "版本儲存空間不足，請先下載專案 JSON 或刪除不需要的版本。";
    return false;
  }
}
function renderVersions() {
  const list = $("#version-list");
  list.replaceChildren();
  const versions = readVersions();
  if (!versions.length) {
    const p = document.createElement("p");
    p.textContent = "尚無存檔版本。自動草稿不受影響。";
    list.append(p);
  }
  for (const record of versions) {
    const card = document.createElement("article");
    card.className = "version-card";
    const title = document.createElement("strong");
    title.textContent = record.name;
    const date = document.createElement("p");
    date.textContent =
      new Date(record.created).toLocaleString() + " · " + (record.model.name || "我的網頁作品");
    const restore = button("還原這個版本", () => {
      try {
        const restored = validateProject(record.model);
        if (!saveVersion("還原前備份：" + (model.name || "我的作品"))) return;
        editingAction = null;
        commit(
          () => {
            model = restored;
            selected = "root";
          },
          "已還原「" + record.name + "」；還原前設計已另外備份，也可以復原。",
        );
        $("#versions-dialog").close();
      } catch (error) {
        $("#version-status").textContent = "無法還原：" + error.message;
      }
    });
    const remove = button("刪除此版本", () => {
      try {
        localStorage.setItem(
          STORAGE + "-versions",
          JSON.stringify(readVersions().filter((v) => v.id !== record.id)),
        );
        renderVersions();
      } catch {
        $("#version-status").textContent = "無法更新版本清單。";
      }
    });
    card.append(title, date, restore, remove);
    list.append(card);
  }
}
$("#project-name").onchange = () => {
  const name = $("#project-name").value.trim() || "我的網頁作品";
  commit(() => (model.name = name), "作品名稱已儲存。");
};
$("#versions-button").onclick = () => {
  renderVersions();
  $("#version-status").textContent = "";
  $("#versions-dialog").showModal();
};
$("#close-versions").onclick = () => $("#versions-dialog").close();
$("#save-version").onclick = () => {
  if (saveVersion($("#version-note").value.trim())) $("#version-note").value = "";
};

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE));
  model = saved ? validateProject(saved) : blank();
} catch {
  model = blank();
  message("無法載入既有草稿，已開啟空白畫布。");
}
refresh();
