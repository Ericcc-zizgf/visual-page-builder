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
  codeBeforeChange = { html: nodeHTML(model.root), css: cssCode(), js: jsCode() };
  history.push(clone(model));
  if (history.length > 60) history.shift();
  future = [];
  change();
  if (!find(selected)) selected = "root";
  refresh();
  persist();
  message(description || "已更新畫布與原始碼。");
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
  const rule = (node, styles, indent = "") =>
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
        .map((n) => rule(n, n.responsive[key], "  "));
      if (rules.length)
        result += "\n@media (max-width: " + max + "px) {\n" + rules.join("\n\n") + "\n}\n";
    }
  return result;
}

function actionLines(action, indent = "  ") {
  const lines = [indent + `const target = document.getElementById(${jsValue(action.target)});`];
  if (action.type === "text")
    lines.push(indent + `target.textContent = ${jsValue(action.value || "")};`);
  if (action.type === "toggle") lines.push(indent + "target.hidden = !target.hidden;");
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
function jsCode() {
  const blocks = [];
  for (const node of all())
    for (const action of node.actions) {
      if (!find(action.target)) continue;
      const lines = [
        `// 元件 #${node.id}：${action.event} → ${ACTIONS[action.type]} → #${action.target}`,
        `document.getElementById(${jsValue(node.id)}).addEventListener(${jsValue(action.event)}, function (event) {`,
      ];
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
  return blocks.length
    ? blocks.join("\n\n") + "\n"
    : "// 尚未加入互動。\n// 在「JS 互動」選擇事件、條件、動作與目標元件。\n";
}

function documentHTML(editing = false) {
  const csp = editing
    ? "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'"
    : "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'";
  const extra = editing
    ? '\n[data-builder-id] { cursor: pointer; }\n[data-empty]::after { content: "拖入元件到這個區塊"; color: #93a18c; font-size: 12px; }\n[data-builder-selected] { outline: 2px solid #4b8e56 !important; outline-offset: -2px; }\n[data-drop-target] { outline: 2px dashed #c28b42 !important; }\n'
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
    mediaScope = "desktop";
  pre.replaceChildren();
  lines.forEach((line, index) => {
    const span = document.createElement("span");
    span.className = "code-line";
    span.dataset.line = index + 1;
    const htmlId = line.match(/\bid="(root|el-\d+)"/);
    if (htmlId) owner = htmlId[1];
    if (/^@media.*1024px/.test(line)) mediaScope = "tablet";
    if (/^@media.*600px/.test(line)) mediaScope = "mobile";
    const cssId = line.match(/^\s*#(root|el-\d+)\s*\{/);
    if (cssId) cssOwner = cssId[1];
    const jsId = line.match(/^\/\/ 元件 #(root|el-\d+)：/);
    if (jsId) jsOwner = jsId[1];
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
      span.onclick = () => select(owner);
    }
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
  future.push(clone(model));
  model = history.pop();
  selected = "root";
  refresh();
  persist();
  message("已復原上一個操作。");
};
$("#redo").onclick = () => {
  if (!future.length) return;
  history.push(clone(model));
  model = future.pop();
  selected = "root";
  refresh();
  persist();
  message("已重做。");
};
$("#demo").onclick = demo;
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
