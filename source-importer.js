/* Convert inert HTML and statically recognized JavaScript into builder data. */
"use strict";
window.SourceImporter = (() => {
  const omit = new Set(["script", "style", "link", "meta", "base", "title", "iframe", "object", "embed", "template", "noscript"]);
  const inheritable = new Set(["color", "font-size", "font-weight", "line-height", "text-align"]);
  const literal = n => n?.type === "StringLiteral" || n?.type === "NumericLiteral" || n?.type === "BooleanLiteral"
    ? n.value : n?.type === "TemplateLiteral" && !n.expressions.length ? n.quasis[0].value.cooked : undefined;
  const member = n => n?.type === "MemberExpression" ? (n.computed ? literal(n.property) : n.property.name) : null;
  const isCall = (n, method) => n?.type === "CallExpression" && member(n.callee) === method;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  async function convert(input, config) {
    const html = String(input.html || ""), css = String(input.css || ""), javascript = String(input.javascript || "");
    const assets = input.assets || [];
    const bytes = text => new TextEncoder().encode(text).length;
    if (!html.trim()) throw Error("請先貼上或選取 HTML。");
    if (bytes(html) > 2 * 1024 * 1024) throw Error("HTML 最多 2 MB。");
    if (bytes(html + css + javascript + assets.map(a => a.text).join("")) > 5 * 1024 * 1024)
      throw Error("原始碼合計最多 5 MB。");
    const warnings = new Set(), unsupportedCSS = new Set();
    const warn = text => { if (warnings.size < 80) warnings.add(text); else warnings.add("其他轉換提醒已省略，請以操作預覽確認成果。"); };
    const supported = new Set(config.tags), containers = new Set(config.containers), keys = config.styleKeys;
    const inspectStyle = style => {
      for (const property of style) {
        const represented = /^(?:flex-(?:grow|shrink|basis)|(?:row|column)-gap|border-(?:top|right|bottom|left)-(?:width|style|color)|border-(?:top|bottom)-(?:left|right)-radius)$/.test(property);
        if (!keys.includes(property) && !represented && !property.startsWith("--") && !["background", "transition", "animation"].includes(property))
          unsupportedCSS.add(property);
        if (/url\s*\(/i.test(style.getPropertyValue(property))) warn("CSS 外部資源／背景圖片未載入。");
      }
    };
    const template = document.createElement("template");
    template.innerHTML = html;
    const originalAttrs = new Map();
    let sourceSerial = 0;
    // Strip URLs before DOMParser: no source scripts, frames or resources can activate.
    for (const el of template.content.querySelectorAll("*")) {
      const key = String(++sourceSerial);
      originalAttrs.set(key, Object.fromEntries([...el.attributes].map(a => [a.name, a.value])));
      for (const attr of [...el.attributes])
        if (/^(src|srcdoc|srcset|href|action|formaction|poster|data|background|ping|codebase|manifest)$/i.test(attr.name) || /^on/i.test(attr.name))
          el.removeAttribute(attr.name);
      el.setAttribute("data-import-key", key);
    }
    const doc = new DOMParser().parseFromString(template.innerHTML, "text/html");
    const attrsOf = el => originalAttrs.get(el.getAttribute("data-import-key")) || {};
    // Fragment parsing omits document wrappers; recover their attributes inertly.
    for (const el of [doc.documentElement, doc.head, doc.body]) {
      const start = html.match(new RegExp("<" + el.localName + "\\b[^>]*>", "i"));
      if (start) {
        const probe = document.createElement("template");
        probe.innerHTML = start[0].replace(new RegExp("^<" + el.localName, "i"), "<div") + "</div>";
        const a = Object.fromEntries([...probe.content.firstChild.attributes].map(a => [a.name, a.value]));
        const key = String(++sourceSerial);
        originalAttrs.set(key, a);
        el.setAttribute("data-import-key", key);
        for (const name of ["id", "class", "style", "lang", "dir"])
          if (a[name]) el.setAttribute(name, a[name]);
      }
    }
    const elements = [...doc.querySelectorAll("*")];
    if (elements.length > 4000) throw Error("來源 HTML 超過 4000 個元素，請先擷取需要的區塊。");
    const scripts = [], styleSources = [], usedAssets = new Set();
    const assetFor = url => {
      const clean = String(url || "").split(/[?#]/)[0].replaceAll("\\", "/");
      const exact = assets.find(a => a.name === clean);
      const matches = assets.filter(a => a.name.split("/").pop() === clean.split("/").pop());
      const found = exact || (matches.length === 1 ? matches[0] : null);
      if (found) usedAssets.add(found);
      return found;
    };
    for (const el of elements) {
      const tag = el.localName, attrs = attrsOf(el);
      if (tag === "script") {
        if (attrs.type && !["module", "text/javascript", "application/javascript"].includes(attrs.type)) continue;
        const asset = attrs.src ? assetFor(attrs.src) : null;
        if (attrs.src && !asset) warn("未提供外部 JS：" + attrs.src);
        if (!attrs.src || asset) scripts.push({ name: attrs.src || "HTML 內的 script", text: asset?.text ?? el.textContent });
      }
      if (tag === "style") styleSources.push({ text: el.textContent, media: attrs.media });
      if (tag === "link" && /\bstylesheet\b/i.test(attrs.rel || "")) {
        const asset = assetFor(attrs.href);
        if (asset) styleSources.push({ text: asset.text, media: attrs.media });
        else warn("未提供外部 CSS：" + attrs.href);
      }
    }
    for (const asset of assets) if (!usedAssets.has(asset)) {
      if (/\.css$/i.test(asset.name)) styleSources.push({ text: asset.text });
      else if (/\.(m?js)$/i.test(asset.name)) scripts.push(asset);
    }
    if (css.trim()) styleSources.push({ text: css });
    if (javascript.trim()) scripts.push({ name: "貼上的 JavaScript", text: javascript });

    const project = { version: 1, name: (doc.title || input.name || "原始碼匯入作品").slice(0, 60), root: null };
    const mapping = new Map(), modelById = new Map();
    let serial = 0;
    const create = (tag, text = "", root = false) => {
      if (serial >= 299 && !root) throw Error("轉換後超過 300 個元件，請縮小 HTML 範圍。");
      const n = { id: root ? "root" : "el-" + ++serial, tag, text: text.slice(0, 5000), attrs: {}, styles: {},
        responsive: { tablet: {}, mobile: {} }, children: [], actions: [] };
      modelById.set(n.id, n);
      return n;
    };
    const textOf = el => {
      const copy = el.cloneNode(true);
      copy.querySelectorAll([...omit].join(",")).forEach(n => n.remove());
      return copy.textContent.replace(/\s+/g, " ").trim();
    };
    function build(el, depth, root = false) {
      const originalTag = el.localName;
      if (omit.has(originalTag)) return null;
      if (depth > 15) throw Error("轉換後超過 15 層巢狀，請簡化 HTML。");
      if (["svg", "math", "canvas", "video", "audio"].includes(originalTag)) {
        warn("略過不支援的圖像／媒體元件：" + originalTag);
        return null;
      }
      let tag = root ? "main" : supported.has(originalTag) ? originalTag
        : /^h[3-6]$/.test(originalTag) ? "h2" : el.children.length ? "div" : "p";
      if (!root && tag !== originalTag) warn("部分不支援的標籤已轉成 div、p 或 h2，外觀可能需要調整。");
      const n = create(tag, "", root), attrs = attrsOf(el);
      mapping.set(el, n);
      inspectStyle(el.style);
      if (["checked", "disabled", "value", "selected"].some(key => attrs[key] !== undefined))
        warn("部分表單的初始值、勾選或停用狀態未保留，請在匯入後檢查。");
      if (attrs.hidden !== undefined) warn("來源有預設隱藏元件，已保留隱藏外觀；其顯示狀態互動需另行設定。");
      for (const key of ["type", "placeholder", "href", "src", "alt", "rows", "aria-label"])
        if (typeof attrs[key] === "string") n.attrs[key] = attrs[key];
      if (tag === "button") n.attrs.type = "button";
      if (n.attrs.href && !/^(#|https?:\/\/|mailto:)/i.test(n.attrs.href)) {
        delete n.attrs.href;
        warn("相對路徑或未支援協定的連結未保留，請在匯入後重新設定網址。");
      }
      if (tag === "img" && !/^data:image\/(png|jpeg|webp|svg\+xml)[;,]/i.test(n.attrs.src || "")) {
        warn("外部／相對路徑圖片無法嵌入；已保留替代文字，可在編輯器重新上傳圖片。");
        n.attrs = { alt: n.attrs.alt || "請重新上傳圖片" };
      }
      if (containers.has(tag)) {
        for (const child of el.childNodes) {
          if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
            const p = create("p", child.textContent.replace(/\s+/g, " ").trim());
            p.styles.margin = "0";
            n.children.push(p);
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const next = build(child, depth + 1);
            if (next) n.children.push(next);
          }
        }
        if (tag === "ul") for (const child of n.children) if (child.tag !== "li") {
          child.tag = "li"; child.text = child.text || child.children.map(c => c.text).join(" "); child.children = [];
          warn("清單內容已簡化成純文字項目。");
        }
      } else {
        n.text = textOf(el).slice(0, 5000);
        if (el.children.length) warn("文字元件內的巢狀格式已合併為純文字；內部元件的獨立樣式與互動無法保留。");
      }
      return n;
    }
    project.root = build(doc.body, 0, true);
    if (!project.root.children.length) throw Error("HTML 中沒有可以匯入的內容。");
    for (const [el, node] of mapping) if (node.attrs.href?.startsWith("#") && node.attrs.href.length > 1) {
      const target = doc.getElementById(node.attrs.href.slice(1));
      const destination = mapping.get(target);
      if (destination) node.attrs.href = "#" + destination.id;
      else warn("部分頁內連結的目標未保留，請重新指定。");
    }

    // Source selectors keep their IDs/classes inside a script-disabled, network-disabled iframe.
    for (const el of elements) {
      if (!el.parentNode) continue;
      if (omit.has(el.localName) || el.namespaceURI !== "http://www.w3.org/1999/xhtml") { el.remove(); continue; }
      const attrs = attrsOf(el);
      for (const attr of [...el.attributes])
        if (!["id", "class", "style", "data-import-key", "hidden", "type", "dir", "lang"].includes(attr.name)) el.removeAttribute(attr.name);
      for (const key of ["id", "class", "style", "hidden", "type"])
        if (attrs[key] !== undefined) el.setAttribute(key, attrs[key]);
      for (const key of Object.keys(attrs)) if (/^on/i.test(key)) warn("HTML 內的事件屬性未轉換：" + key + "。請改用 addEventListener。");
    }
    // Resolve styles using the browser's own cascade at builder breakpoints.
    const sheets = styleSources.map(source => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(source.text);
      if (source.text.trim() && !sheet.cssRules.length) warn("有 CSS 內容無法解析或只有註解；請檢查來源樣式。");
      function inspect(rules) {
        for (const rule of rules) {
          if (rule.style) inspectStyle(rule.style);
          if (rule.selectorText && /::|:(hover|focus|active|visited|checked)\b/.test(rule.selectorText)) warn("偽元素與 hover／focus 等狀態樣式未轉換。");
          if (rule.type === CSSRule.IMPORT_RULE) warn("CSS @import 未載入，請一併選取依賴的 CSS 檔案。");
          if (rule.cssRules) inspect(rule.cssRules);
        }
      }
      inspect(sheet.cssRules);
      return { text: [...sheet.cssRules].map(r => r.cssText).join("\n"), media: source.media };
    });
    if (unsupportedCSS.size) warn("未支援的 CSS 屬性：" + [...unsupportedCSS].slice(0, 12).join("、") + (unsupportedCSS.size > 12 ? "等" : "") + "；相關外觀可能需要調整。");
    if (styleSources.some(s => /@(?:keyframes|font-face)|\b(?:animation|transition)\s*:/i.test(s.text)))
      warn("動畫、轉場與外部字型未轉換成可編輯設定。");
    if (sheets.some(s => /@media/i.test(s.text))) warn("響應式樣式取樣為桌面 1200px、平板 800px、手機 390px，並映射到編輯器的 1024px／600px 分界。");
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-same-origin");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.cssText = "position:fixed;left:-20000px;top:0;width:1200px;height:800px;border:0;visibility:hidden";
    const safeDoc = doc.cloneNode(true);
    const csp = safeDoc.createElement("meta");
    csp.httpEquiv = "Content-Security-Policy";
    csp.content = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
    safeDoc.head.prepend(csp);
    const noMotion = safeDoc.createElement("style");
    noMotion.textContent = "*,*::before,*::after { animation:none !important;transition:none !important; }";
    for (const sheet of sheets) {
      const style = safeDoc.createElement("style");
      style.textContent = sheet.text.replace(/</g, "\\3c ");
      if (sheet.media) style.media = sheet.media;
      safeDoc.head.append(style);
    }
    safeDoc.head.append(noMotion);
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error("樣式分析逾時，請縮小 HTML／CSS。")), 8000);
        frame.onload = () => { clearTimeout(timer); resolve(); };
        frame.srcdoc = "<!doctype html>" + safeDoc.documentElement.outerHTML;
        document.body.append(frame);
      });
      const mappedNodes = new Set(mapping.values());
      for (const [breakpoint, width] of [["desktop", 1200], ["tablet", 800], ["mobile", 390]]) {
        frame.style.width = width + "px";
        // Force a fresh layout for media queries before reading computed values.
        void frame.contentDocument.documentElement.offsetWidth;
        for (const [source, node] of mapping) {
          const key = source.getAttribute("data-import-key");
          const target = source === doc.body ? frame.contentDocument.body
            : key ? frame.contentDocument.querySelector('[data-import-key="' + key + '"]') : null;
          if (!target) continue;
          const computed = frame.contentWindow.getComputedStyle(target);
          const typed = target.computedStyleMap?.();
          const styles = {};
          for (const property of keys) {
            let value = computed.getPropertyValue(property).trim();
            // Preserve percentages and auto dimensions rather than freezing used pixel widths.
            if (["width", "height", "min-height", "max-width", "top", "right", "bottom", "left", "flex", "gap", "padding", "margin", "grid-template-columns"].includes(property)) {
              const computedValue = typed?.get(property)?.toString();
              if (computedValue && !/\[object|var\(/.test(computedValue)) value = computedValue;
            }
            if (value && !/[<>;{}]/.test(value) && CSS.supports(property, value)) styles[property] = value;
          }
          if (attrsOf(source).hidden !== undefined) styles.display = "none";
          if (breakpoint === "desktop") node.styles = styles;
          else {
            const base = breakpoint === "mobile" ? { ...node.styles, ...node.responsive.tablet } : node.styles;
            node.responsive[breakpoint] = Object.fromEntries(Object.entries(styles).filter(([k, v]) => base[k] !== v));
          }
          // Direct text nodes inherit typography from their source container.
          for (const child of node.children) if (!mappedNodes.has(child))
            for (const k of inheritable) if (styles[k]) {
              const bucket = breakpoint === "desktop" ? child.styles : child.responsive[breakpoint];
              bucket[k] = styles[k];
            }
        }
      }
    } finally { frame.remove(); }
    // Only recognized AST patterns become actions. Source scripts are never evaluated.
    const select = (method, selector) => {
      let el;
      try { el = method === "getElementById" ? doc.getElementById(selector) : doc.querySelector(selector); }
      catch { return null; }
      return mapping.get(el) || null;
    };
    for (const script of scripts) {
      if (!script.text.trim()) continue;
      try {
        if (bytes(script.text) > 1024 * 1024) throw Error("單份 JavaScript 最多 1 MB，請縮小來源檔案");
        convertJS(script.text, select, modelById, text => warn((script.name || "JavaScript") + "：" + text));
      }
      catch (error) { warn((script.name || "JavaScript") + " 未轉換：" + error.message); }
    }
    let actions = 0;
    for (const n of modelById.values()) actions += n.actions.length;
    return { project, warnings: [...warnings], stats: { nodes: modelById.size, actions } };
  }

  function convertJS(source, select, nodes, warn) {
    const ast = window.prettierPlugins.babel.parsers.babel.parse(source);
    const body = ast.program?.body || ast.body;
    let registrations = 0, unsupported = 0;
    function resolve(n, env, current) {
      if (!n) return null;
      if (n.type === "Identifier") return env.get(n.name) || null;
      if (n.type === "ThisExpression") return current ? { ref: current.id } : null;
      const property = member(n);
      if (["currentTarget", "target"].includes(property) && n.object.type === "Identifier" && env.get(n.object.name)?.event)
        return current ? { ref: current.id } : null;
      if (property === "textContent" || property === "value" || property === "hidden") {
        const object = resolve(n.object, env, current);
        return object?.ref ? { read: property, ref: object.ref } : null;
      }
      if (["style", "classList"].includes(property)) return resolve(n.object, env, current);
      if (n.type === "CallExpression") {
        if (n.callee.type === "Identifier" && n.callee.name === "String" && n.arguments.length === 1)
          return resolve(n.arguments[0], env, current);
        if (isCall(n, "trim") && !n.arguments.length) return resolve(n.callee.object, env, current);
        if (n.callee.object?.name === "document" && ["getElementById", "querySelector"].includes(member(n.callee)) && typeof literal(n.arguments[0]) === "string") {
          const node = select(member(n.callee), literal(n.arguments[0]));
          return node ? { ref: node.id } : null;
        }
      }
      // Builder-generated input/textarea read expression.
      if (n.type === "ConditionalExpression" && isCall(n.test, "matches") && literal(n.test.arguments[0]) === "input, textarea") {
        const a = resolve(n.consequent, env, current), b = resolve(n.alternate, env, current);
        if (a?.read === "value" && b?.read === "textContent" && a.ref === b.ref) return { read: "content", ref: a.ref };
      }
      return null;
    }
    function variables(statement, env, current) {
      for (const declaration of statement.declarations) {
        if (declaration.id.type !== "Identifier") throw Error("不支援的變數解構");
        const value = resolve(declaration.init, env, current);
        if (!value) {
          // Allow a literal numeric read used by the generated increment action.
          const init = declaration.init;
          if (init?.type === "LogicalExpression" && init.operator === "||" && literal(init.right) === 0 && init.left?.callee?.name === "Number") {
            const read = resolve(init.left.arguments[0], env, current);
            if (read?.read === "textContent") { env.set(declaration.id.name, { numeric: read.ref }); continue; }
          }
          throw Error("無法辨識的變數或運算");
        }
        env.set(declaration.id.name, value);
      }
    }
    function condition(test, env, current) {
      if (test?.type !== "BinaryExpression" || !["===", "==", "!==", "!="].includes(test.operator)) return null;
      const read = resolve(test.left, env, current), value = literal(test.right);
      if (!read?.read || !["textContent", "value", "content"].includes(read.read) || typeof value !== "string") return null;
      const node = nodes.get(read.ref);
      if (read.read === "value" && !["input", "textarea"].includes(node.tag)) return null;
      if (read.read === "textContent" && ["input", "textarea"].includes(node.tag)) return null;
      if (["!==", "!="].includes(test.operator) && value !== "") return null;
      return { source: read.ref, operator: value === "" ? (["!==", "!="].includes(test.operator) ? "not-empty" : "empty") : "equals", value };
    }
    function parseStatements(statements, env, current) {
      const steps = [];
      for (const statement of statements) {
        if (statement.type === "EmptyStatement") continue;
        if (statement.type === "VariableDeclaration") { variables(statement, env, current); continue; }
        if (statement.type === "BlockStatement") { steps.push(...parseStatements(statement.body, new Map(env), current)); continue; }
        if (statement.type === "IfStatement") {
          // Accessibility state sync is rebuilt by the builder's toggle generator.
          if (statement.test?.type === "BinaryExpression" && isCall(statement.test.left, "getAttribute") && literal(statement.test.left.arguments[0]) === "aria-controls" && !statement.alternate) {
            const body = statement.consequent.type === "BlockStatement" ? statement.consequent.body : [statement.consequent];
            if (body.length === 1 && isCall(body[0].expression, "setAttribute") && literal(body[0].expression.arguments[0]) === "aria-expanded") continue;
          }
          const test = condition(statement.test, env, current);
          if (!test) throw Error("條件不在目前支援範圍");
          warn("條件比較依組裝室規則，會先移除來源文字前後空白。");
          const list = s => s?.type === "BlockStatement" ? s.body : s ? [s] : [];
          const yes = parseStatements(list(statement.consequent), new Map(env), current);
          const no = parseStatements(list(statement.alternate), new Map(env), current);
          if (!yes.length || yes.length > 11 || no.length > 1 || [...yes, ...no].some(a => a.condition)) throw Error("條件分支過於複雜");
          steps.push({ ...yes[0], condition: test, ...(yes.length > 1 ? { steps: yes.slice(1) } : {}), ...(no.length ? { otherwise: no[0] } : {}) });
          continue;
        }
        const expression = statement.type === "ExpressionStatement" ? statement.expression : null;
        if (isCall(expression, "preventDefault") && expression.callee.object.type === "Identifier" && env.get(expression.callee.object.name)?.event) continue;
        if (expression?.type === "AssignmentExpression" && expression.operator === "=") {
          const left = resolve(expression.left, env, current), right = expression.right;
          if (!left?.read) throw Error("不支援的指定動作");
          if (left.read === "hidden" && right.type === "UnaryExpression" && right.operator === "!" && same(resolve(right.argument, env, current), left)) {
            if (nodes.get(left.ref).styles.display === "none") throw Error("預設隱藏元件需手動設定顯示狀態");
            steps.push({ type: "toggle", target: left.ref, value: "" }); continue;
          }
          if (left.read === "textContent") {
            if (nodes.get(left.ref).children.length) throw Error("更新容器文字會刪除其子元件，請改以文字元件為目標");
            const value = literal(right);
            if (["string", "number", "boolean"].includes(typeof value)) { steps.push({ type: "text", target: left.ref, value: String(value) }); continue; }
            const read = resolve(right, env, current);
            if (read?.read === "value" && read.ref === current.id && ["input", "textarea"].includes(current.tag)) {
              steps.push({ type: "input", target: left.ref, value: "" }); continue;
            }
            const sum = right?.callee?.name === "String" ? right.arguments[0] : right;
            if (sum?.type === "BinaryExpression" && sum.operator === "+" && literal(sum.right) === 1) {
              const previous = sum.left;
              const numeric = previous.type === "Identifier" ? env.get(previous.name)?.numeric
                : previous.callee?.name === "Number" ? resolve(previous.arguments[0], env, current)?.ref : null;
              if (numeric === left.ref) { steps.push({ type: "increment", target: left.ref, value: "" }); continue; }
            }
          }
        }
        if (isCall(expression, "toggle") && member(expression.callee.object) === "classList" && expression.arguments.length === 1 && literal(expression.arguments[0]) === "is-active") {
          const node = resolve(expression.callee.object, env, current);
          if (node?.ref) { steps.push({ type: "class", target: node.ref, value: "" }); continue; }
        }
        throw Error("包含未支援的運算、函式或控制流程");
      }
      return steps;
    }
    function top(statements, env) {
      for (const statement of statements) {
        try {
          if (statement.type === "VariableDeclaration") { variables(statement, env, null); continue; }
          const call = statement.expression;
          if (isCall(call, "setAttribute") && ["aria-controls", "aria-expanded"].includes(literal(call.arguments[0]))) continue;
          if (isCall(call, "addEventListener")) {
            const event = literal(call.arguments[0]), fn = call.arguments[1];
            if (event === "DOMContentLoaded" && call.callee.object?.name === "document" && fn?.body?.type === "BlockStatement") {
              top(fn.body.body, new Map(env)); continue;
            }
            const currentRef = resolve(call.callee.object, env, null);
            const current = nodes.get(currentRef?.ref);
            if (!current || !["click", "input", "change", "submit"].includes(event) || !["FunctionExpression", "ArrowFunctionExpression"].includes(fn?.type) || fn.async || fn.generator || call.arguments.length !== 2) throw Error("事件來源、事件種類或回呼不支援");
            const local = new Map(env);
            if (fn.params[0]?.type === "Identifier") local.set(fn.params[0].name, { event: true });
            const statements = fn.body.type === "BlockStatement" ? fn.body.body : [{ type: "ExpressionStatement", expression: fn.body }];
            const steps = parseStatements(statements, local, current);
            if (!steps.length) throw Error("沒有可轉換的動作");
            // Keep independent statements ordered; each maps to an existing builder action.
            if (steps.length <= 11 && steps.every(step => !step.condition))
              current.actions.push({ event, ...steps[0], ...(steps.length > 1 ? { steps: steps.slice(1) } : {}) });
            else current.actions.push(...steps.map(step => ({ event, ...step })));
            registrations++;
            continue;
          }
          throw Error("頂層程式未轉換");
        } catch (error) {
          unsupported++;
          warn("JavaScript 第 " + (statement.loc?.start.line || "?") + " 行未轉換：" + error.message + "。");
        }
      }
    }
    top(body, new Map());
    if (!registrations && !unsupported) warn("此份 JavaScript 沒有可辨識的互動。");
  }
  return { convert };
})();
