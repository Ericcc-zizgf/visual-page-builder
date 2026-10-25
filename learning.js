"use strict";
window.BuilderLearning = (() => {
  const css = {
    "box-sizing": ["尺寸計算方式", "border-box 讓 width 與 height 包含內距與邊框，較容易控制元件總尺寸。", "這裡的 * 選擇器把同一規則套用到所有元素。"],
    "font-family": ["字型選擇順序", "從左到右嘗試使用可用的字型。", "system-ui 使用系統介面字型；sans-serif 是無襯線字型的備選分類。"],
    outline: ["外框提示", "在元件邊界外加上提示框，不佔用排版空間。", "此範例用它凸顯被切換為 is-active 的元件。"],
    display: ["排版模式", "決定元件本身與內部內容使用哪種排版。", "試著在 block、flex、grid 之間切換。"],
    "flex-direction": ["Flex 排列方向", "row 讓直接子元件橫向排列；column 讓它們由上到下排列。", "需要先在同一個容器設定 display: flex。"],
    "justify-content": ["主軸對齊", "安排主軸上的剩餘空間；row 時是左右方向，column 時是上下方向。", "可試 center 或 space-between，觀察子元件位置。"],
    "align-items": ["交叉軸對齊", "安排子元件在交叉軸上的位置。Flex 為 row 時，交叉軸是上下方向。", "stretch 會延伸交叉軸尺寸為 auto 的子元件；固定高度可能不會被拉長。"],
    "flex-wrap": ["Flex 換行", "nowrap 維持單行；wrap 允許子元件在空間不足時換行。", "配合子元件寬度，在較窄畫面觀察換行。"],
    gap: ["子元件間距", "設定 Flex 或 Grid 內相鄰子元件的空隙。", "16px 是 16 像素；兩個值分別代表列間距與欄間距。"],
    "grid-template-columns": ["Grid 欄位", "定義格線的欄數與每欄寬度。1fr 代表一份可分配的剩餘空間。", "1fr 1fr 是兩欄；repeat(3, 1fr) 是三個等寬欄。需要 display: grid。"],
    width: ["寬度", "設定元件的寬度，實際結果也可能受 Flex 與最大寬度等限制。", "100% 通常參照所在容器寬度；auto 由排版規則決定。"],
    height: ["高度", "設定元件高度。固定高度可能讓內容溢出。", "auto 通常會讓高度隨內容調整。"],
    "min-height": ["最小高度", "元件至少要這麼高；內容更多時，仍可以繼續長高。", "改成 200px 後，若內容已超過 200px，元件仍會被內容撐高。"],
    "max-width": ["最大寬度", "限制元件最多能有多寬。", "可用 width: 100% 配合 max-width，讓內容在小螢幕縮小、在大螢幕保有限制。"],
    padding: ["內距", "內容與元件邊框之間的留白，會露出這個元件的背景。", "一個值套用四側；兩個值是上下、左右；四個值依序是上、右、下、左。"],
    margin: ["外距", "設定元件邊框外的留白，用來調整它與周圍元件的距離。", "四個值依序是上、右、下、左；一般區塊的 margin: 0 auto 可配合寬度做水平置中。"],
    "background-color": ["背景顏色", "設定元件背景，不會直接改變文字顏色。", "#2d694c 是十六進位色碼，也可以使用 rgb(...) 或顏色名稱。"],
    color: ["文字顏色", "設定文字顏色，沒有自訂文字顏色的子元件通常會繼承它。", "試著修改父容器的 color，再觀察裡面的文字。"],
    "font-size": ["文字大小", "設定字體大小；文字可能因此重新換行，影響整體高度。", "24px 是 24 像素；rem 參照網頁根元素的字體大小。"],
    "font-weight": ["文字粗細", "設定字體粗細，例如 400 通常是一般字重、700 通常是粗體。", "可呈現的字重也取決於使用的字型。"],
    "line-height": ["行高", "設定每一行文字使用的高度。", "1.6 表示字體大小的 1.6 倍；不加單位可隨字體大小調整。"],
    "text-align": ["文字對齊", "控制區塊內文字等行內內容的水平對齊方式。", "center 讓裡面的文字置中，不會直接把這個區塊移到父容器中央。"],
    border: ["邊框", "在元件周圍畫出邊界。", "1px solid #d9e3d2 分別是線寬、實線樣式、顏色。"],
    "border-radius": ["圓角", "讓元件邊角呈現圓弧。", "8px 是圓角半徑；背景和邊框都會依照圓角呈現。"],
    "box-shadow": ["陰影", "在元件周圍增加陰影，不會替它預留額外排版空間。", "常見順序是水平位移、垂直位移、模糊半徑、擴張半徑與顏色。"],
    position: ["定位方式", "static 跟隨正常排版；relative 可以從原位置偏移；absolute 通常以最近的定位祖先為基準；fixed 通常以視窗為基準。", "absolute 與 fixed 會離開正常排版，周圍元件不會替它保留原空間。"],
    flex: ["Flex 子元件伸縮", "控制子元件如何分配或縮減主軸空間，設定在 Flex 容器內的子元件上。", "三個值依序是放大比例、縮小比例、基準尺寸；0 0 220px 表示不伸縮、以 220px 為基準。"],
    overflow: ["溢出內容處理", "設定內容超出元件範圍時要如何顯示。", "hidden 裁切、auto 在需要時提供捲動、visible 允許內容顯示在範圍外。"],
  };
  for (const side of ["top", "right", "bottom", "left"]) {
    const label = { top: "上", right: "右", bottom: "下", left: "左" }[side];
    css[side] = [label + "側定位偏移", "設定定位元件與基準" + label + "側的偏移距離，效果取決於 position。", "position: static 時，這個偏移不會生效。"];
    css["padding-" + side] = [label + "內距", "只設定內容與" + label + "邊框之間的留白。", "可與其他方向分開調整；數值通常不能是負數。"];
    css["margin-" + side] = [label + "外距", "只設定元件" + label + "側邊框外的留白。", "它與 padding 的差別，是留白位在邊框外面。"];
  }
  const tags = {
    main: "頁面主要內容", section: "一個內容區塊", div: "一般容器，用來分組與排版", header: "頁首或某區塊的介紹內容", nav: "導覽區域", article: "可以獨立理解的內容，例如卡片",
    h1: "主要標題", h2: "次要標題", p: "一段文字", button: "可以操作的按鈕", input: "單行輸入欄位", label: "表單欄位的文字標籤", textarea: "多行輸入欄位", a: "連結", img: "圖片", ul: "無序清單", li: "一個清單項目", form: "表單", hr: "主題分隔線",
  };
  function cssInfo(key, value) {
    const info = css[key] || ["CSS 設定", "設定這個元件的 " + key + " 屬性。", "請配合畫面與其他排版屬性觀察結果。"];
    let effect = info[1];
    if (key === "display") effect = ({ flex: "使用 Flex 排版。預設方向是 row，直接子元件通常會橫向排列。", grid: "使用 Grid 格線排版，可用 grid-template-columns 指定欄位。", none: "隱藏這個元件與其內容，也不保留原本佔用的排版空間。", block: "使用區塊排版；一般情況下會另起一行。" })[value.replace(/\s*!important$/, "")] || effect;
    return { title: info[0], effect, syntax: key + " 是屬性名稱，" + value + " 是設定值；冒號分開名稱與值，分號結束這筆設定。" + (/!important$/.test(value) ? " !important 會提高這筆宣告在 CSS 層疊中的優先程度。" : ""), tip: info[2] };
  }
  const label = n => n ? (tags[n.tag] || n.tag) + "（#" + n.id + "）" : "全頁共用規則";
  function lineInfo(tab, line, node, context) {
    const text = line.trim(), who = label(node);
    if (!text) return { title: "空白行", effect: "空白行用來分開程式區段，方便閱讀，不會改變畫面或執行結果。" };
    if (tab === "css") {
      const declaration = text.match(/^([\w-]+):\s*(.*?)\s*;$/);
      if (declaration) return { ...cssInfo(declaration[1], declaration[2]), who, code: line };
      if (/^@media/.test(text)) return { title: "響應式條件", who, effect: "只有視窗符合這個寬度條件時，裡面的樣式才會參與套用。", syntax: "max-width: 600px 表示寬度小於或等於 600 像素；大括號包住這個條件下的 CSS。", code: line };
      if (/^\/\*/.test(text)) return { title: "CSS 區段小標題", who, effect: "這是註解，用來標示下面的規則屬於哪個元件與畫面尺寸。", syntax: "/* 和 */ 之間是註解，瀏覽器不會把它當作樣式執行。", code: line };
      if (text === "}") return { title: "結束 CSS 區段", who, effect: "結束前面那一組選擇器規則，或結束媒體查詢。", syntax: "{ 開始一個區段，} 結束一個區段。", code: line };
      return { title: "CSS 選擇器", who, effect: text.startsWith("#") ? "下面的設定只套用到這個 ID 對應的元件。" : "下面的樣式套用到符合這個選擇器的元件。", syntax: "# 用 ID 選取；. 用 class 選取；* 選取所有元素；[hidden] 選取具有 hidden 屬性的元素。逗號可以分隔多個選擇器。", code: line };
    }
    if (tab === "html") {
      const match = text.match(/^<(\/?)([\w-]+)/), tag = match?.[2];
      if (match?.[1]) return { title: "HTML 結束標籤", who, effect: "結束這個 " + tag + " 元件。內部巢狀的標籤要先結束，再結束外面的容器。", syntax: "</" + tag + "> 中的 / 表示結束；縮排只是方便閱讀。", code: line };
      return { title: "HTML：" + (tags[tag] || "文字內容"), who, effect: tags[tag] ? "這行建立「" + tags[tag] + "」。標籤決定內容種類，樣式由 CSS 設定，互動由 JavaScript 設定。" : "這是元件內的文字內容。", syntax: "< > 包住標籤；id=\"...\" 是元件識別名稱，CSS 的 #id 和 JavaScript 都能用它找到同一個元件。", tip: ["input", "img", "hr"].includes(tag) ? "這是空元素，不需要結束標籤。" : "標籤之間可放文字；容器也能放其他元件。", code: line };
    }
    let title = "JavaScript 語法", effect = "這行是組裝室產生的互動程式的一部分。", syntax = "請配合前後行閱讀；點擊事件裡的內容要等事件發生才會執行。";
    if (text.startsWith("//")) { title = "互動區段小標題"; effect = "註解標示事件來源、要執行的動作及目標元件。"; syntax = "// 後面的文字是註解，不會被執行。"; }
    else if (text.includes("addEventListener(")) { title = "註冊事件"; effect = "讓來源元件在 click、input 等事件發生時，執行 function 大括號內的程式。"; syntax = "addEventListener(事件名稱, 處理函式)；event 是事件資料，可用 event.currentTarget 取得註冊事件的元件。"; }
    else if (text.includes("getElementById(") && text.startsWith("const ")) { title = "找到元件並存入變數"; effect = "依 ID 找到網頁上的元件，存入 target 或 source 變數，供後面的程式使用。"; syntax = "const 宣告不能重新指定的變數；= 將右側結果指定給左側；這不代表元件內容不能被修改。"; }
    else if (/^if\s*\(/.test(text) && text.includes("aria-controls")) { title = "確認目標後同步展開狀態"; effect = "確認按鈕控制的 ID 和目前目標元件相同，才把最新展開狀態寫入 aria-expanded。"; syntax = "getAttribute(...) 讀取屬性；=== 比較是否相等；setAttribute(...) 更新屬性。這個狀態供輔助工具讀取。"; }
    else if (text.includes("aria-controls")) { title = "設定按鈕控制的目標"; effect = "用 aria-controls 說明按鈕對應的受控元件，供輔助工具理解。"; syntax = "setAttribute(屬性名稱, 屬性值) 設定 HTML 屬性；此行本身不會收合側欄。"; }
    else if (text.includes("aria-expanded")) { title = "同步展開狀態"; effect = "把目前是否展開的狀態寫入 aria-expanded，供輔助工具讀取。"; syntax = "!target.hidden 在未隱藏時是 true；String(...) 把真假值轉成文字。此行本身不會改變顯示狀態。"; }
    else if (text.includes("target.hidden = !target.hidden")) { title = "反轉顯示／隱藏狀態"; effect = "先讀取目前 hidden 的真假值，再反轉並存回去：原本顯示就隱藏，原本隱藏就顯示。"; syntax = "= 是指定；! 是邏輯反轉。false → !false → true；hidden 為 true 表示隱藏。"; }
    else if (/^const inputValue\s*=/.test(text)) { title = "讀取條件要比較的內容"; effect = "輸入框讀 value，其他元件讀 textContent；轉成字串後移除前後空白。"; syntax = "條件 ? A : B 是三元運算；String(...) 轉成文字；trim() 去除前後空白；matches(...) 檢查元件種類。"; }
    else if (/^if\s*\(/.test(text)) { title = "判斷條件"; effect = "條件成立時才執行接下來大括號裡的動作。"; syntax = "=== 比較兩邊是否相等；!== 比較是否不相等；\"\" 是空字串。它們和用來指定值的 = 不同。"; }
    else if (text.includes("else")) { title = "條件不成立時的分支"; effect = "前面的 if 條件不成立時，執行 else 裡的程式。"; syntax = "if 與 else 是兩條分支，每次只會選擇其中一條。"; }
    else if (text.includes("target.textContent =")) { title = "更新目標文字"; effect = text.includes("event.currentTarget.value") ? "讀取觸發事件的輸入框目前內容，顯示在目標元件上。" : text.includes("current + 1") ? "將目前數字加一，再轉成文字顯示在目標元件上。" : "將等號右側的文字寫入目標元件，取代它原本的內容。"; syntax = "textContent 是元件的文字內容；= 把右邊結果指定給它；引號包住的是字串。"; }
    else if (text.includes("Number(")) { title = "把文字轉成數字"; effect = "把目前顯示的文字轉成數字，供下一步加一；無法轉成有效數字時，這個範例以 0 作為起點。"; syntax = "Number(...) 嘗試轉成數字；|| 0 在左側結果是假值時使用 0。"; }
    else if (text.includes("classList.toggle")) { title = "切換醒目樣式"; effect = "有 is-active 類別就移除，沒有就加入；外觀由 CSS 的 .is-active 規則決定。"; syntax = "classList 是元件的類別清單；toggle(...) 在加入與移除之間切換。"; }
    else if (text.includes("preventDefault")) { title = "取消預設行為"; effect = "阻止這次事件的瀏覽器預設行為，例如表單提交或連結跳轉。"; syntax = "呼叫 event.preventDefault() 不會自動停止其他事件處理函式。"; }
    else if (/^[{});]+$/.test(text)) { title = "程式區段邊界"; effect = text === "{" ? "開始一個區塊，裡面宣告的變數作用範圍受這組大括號限制。" : "結束前面開啟的區塊或函式呼叫。"; syntax = "{ } 包住區塊；( ) 包住參數；; 結束一筆敘述。}); 常用來結束事件註冊。"; }
    return { title, who: context || who, effect, syntax, code: line };
  }
  function operation(before, after, description) {
    const flatten = n => [n, ...n.children.flatMap(flatten)];
    const oldNodes = flatten(before.root), newNodes = flatten(after.root);
    const oldMap = new Map(oldNodes.map(n => [n.id, n])), newMap = new Map(newNodes.map(n => [n.id, n]));
    const entries = [];
    for (const n of newNodes) {
      const old = oldMap.get(n.id), who = label(n);
      if (!old) { entries.push({ title: "新增「" + (tags[n.tag] || n.tag) + "」", htmlNode: n.id, effect: who + " 已加入 HTML 結構。可以用 CSS 調整外觀，或在 JS 互動中設定動作。", code: "<" + n.tag + ' id="' + n.id + '">' + (n.text || "") + (["input", "img", "hr"].includes(n.tag) ? "" : "</" + n.tag + ">") }); continue; }
      if (old.text !== n.text) entries.push({ title: "更新 HTML 文字", htmlNode: n.id, effect: who + " 的內容已從「" + old.text.slice(0, 40) + "」改為「" + n.text.slice(0, 40) + "」。標籤種類沒有因此改變。", code: "<" + n.tag + ' id="' + n.id + '">' + n.text + "</" + n.tag + ">" });
      for (const breakpoint of ["desktop", "tablet", "mobile"]) {
        const prev = breakpoint === "desktop" ? old.styles : old.responsive?.[breakpoint] || {};
        const next = breakpoint === "desktop" ? n.styles : n.responsive?.[breakpoint] || {};
        for (const key of new Set([...Object.keys(prev), ...Object.keys(next)])) if (prev[key] !== next[key]) {
          const info = cssInfo(key, next[key] || "（移除）");
          entries.push({ title: info.title + " · " + ({ desktop: "桌面", tablet: "平板 ≤1024px", mobile: "手機 ≤600px" })[breakpoint], effect: who + "：" + (next[key] ? info.effect : "已移除這筆設定。會依照較大尺寸的樣式、繼承或瀏覽器預設值決定結果。"), syntax: next[key] ? info.syntax : "移除設定時，這一行也會從該尺寸的 CSS 規則移除。", tip: "原值：" + (prev[key] || "未設定") + " → " + (next[key] || "已移除") + "。" + info.tip, code: next[key] ? "#" + n.id + " {\n  " + key + ": " + next[key] + ";\n}" : "/* 移除 #" + n.id + " 的 " + key + " */" });
        }
      }
      if (JSON.stringify(old.attrs) !== JSON.stringify(n.attrs)) entries.push({ title: "更新 HTML 屬性", htmlNode: n.id, effect: who + " 的屬性已更新。屬性是寫在開始標籤裡的設定，例如 placeholder 是輸入提示，href 是連結目的地。", code: "<" + n.tag + ' id="' + n.id + '" ' + Object.entries(n.attrs).map(([k, v]) => k + '="' + v + '"').join(" ") + ">" });
      if (JSON.stringify(old.actions) !== JSON.stringify(n.actions)) {
        const names = { text: "更新文字", toggle: "顯示／隱藏", class: "切換醒目樣式", increment: "數字加一", input: "同步輸入內容" };
        const added = n.actions.filter(a => !old.actions.some(b => JSON.stringify(a) === JSON.stringify(b)));
        entries.push({ title: "更新 JavaScript 互動", actionNode: n.id, effect: who + (added.length ? "：" + added.map(a => a.event + " 事件 → " + names[a.type] + " → " + label(newMap.get(a.target)) + (a.condition ? "（先判斷條件）" : "") + (a.steps?.length ? "，接著執行 " + a.steps.length + " 個動作" : "")).join("；") : " 的既有動作已移除。"), tip: "新增事件只是註冊處理方式；請到「操作預覽」觸發事件，觀察程式執行。點 JavaScript 的各行可逐行解讀。" });
      }
      if (JSON.stringify(old.children.map(c => c.id)) !== JSON.stringify(n.children.map(c => c.id))) entries.push({ title: "改變 HTML 結構", effect: who + " 的直接子元件或順序改變了。HTML 巢狀關係會影響 CSS 排版、繼承與互動範圍。" });
    }
    for (const n of oldNodes) if (!newMap.has(n.id)) entries.push({ title: "移除元件", effect: label(n) + " 已從 HTML 結構移除；相關樣式與失效互動也會一起移除。可按復原找回。" });
    return { title: description || "作品已更新", entries: entries.length ? entries : [{ title: "作品設定", effect: before.name !== after.name ? "作品名稱已更新。它用來辨識專案，不會改變頁面元件。" : "作品資料已更新，請對照目前原始碼與畫面。" }] };
  }
  return { cssInfo, lineInfo, operation, label };
})();
