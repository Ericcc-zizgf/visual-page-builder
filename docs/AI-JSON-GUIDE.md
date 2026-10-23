# 給 AI 的 Visual Page Builder 專案格式規格

本文件依照 2026-10-23 的實際 app.js 匯入器整理。這是此編輯器的自訂專案格式，並非所有網站通用的 JSON 標準。

## 任務提示詞（將需求填在最後）

請根據本規格，把我提供的設計需求、截圖或 HTML/CSS 轉換成 Visual Page Builder 可匯入的 version 1 專案 JSON。
請先檢查結構、元件 ID、引用及所有樣式是否符合規格。若可提供檔案，請輸出 UTF-8 的 design.json；若只能輸出文字，請使用單一 JSON 程式碼區塊，JSON 內不要加入註解或解說。
不得輸出 HTML 字串、React、自由 JavaScript、不同版本 schema 或自行發明的欄位。
請將規格不支援的設計改成最接近的可編輯結構，並在 JSON 檔案之外列出無法還原之處。不可聲稱任意網頁都能無損轉換。
參考附帶 example-project.json 的實際結構，但請依照本次需求創作內容。
我的設計需求：【填寫在這裡】

## 外層結構

- version：必須為數字 1，不能是字串 "1"。
- name：作品名稱，最多 60 字元。
- root：根節點，id 必須是 "root"，tag 必須是 "main"。

## 每個節點

每個節點都明確提供以下欄位：

```json
{
  "id": "el-1",
  "tag": "section",
  "text": "",
  "attrs": {},
  "styles": {},
  "responsive": {"tablet": {}, "mobile": {}},
  "children": [],
  "actions": []
}
```

- 除根節點外，ID 使用 el-1、el-2、el-3 等，必須符合 ^el-\d+$，全專案不得重複。
- tag 只用：main、section、div、header、nav、article、h1、h2、p、button、input、label、textarea、a、img、ul、li、form、hr。建議 main 只用作根節點。
- 可放 children 的容器只有 main、header、nav、section、div、article、form、ul。
- ul 的直接 children 必須全部是 li；li 不接受 children，使用 text。
- 其他非容器節點的 children 必須是 []。不要巢狀 form。
- 容器有 children 時，產生 HTML 的程式只輸出 children，不會同時顯示它的 text。容器 text 使用空字串，實際文字放 h1、h2、p 等子元件。
- text 是純文字，不能把 <strong> 等 HTML 塞進 text；最多 5000 字元。
- 最多 300 個節點（含 root）。匯入器以 root 深度 0 計數，拒絕 depth > 15；保守生成時不超過 15 層。
- JSON 檔案最多 5 × 1024 × 1024 bytes；不允許註解、尾逗號或省略號。

## attrs

只允許 type、placeholder、href、src、alt、rows、aria-label，值一律使用字串。
不要在 attrs 放 id、class、style、onclick、data-*、for、name、value；目前匯入器不保留這些屬性。
button 建議 attrs = {"type":"button"}。
input 建議 attrs = {"type":"text","placeholder":"請輸入","aria-label":"文字輸入"}。
href 只允許 #、http://、https://、mailto: 開頭；建議頁內示範用 #。
img.src 只接受 data:image/png、data:image/jpeg、data:image/webp、data:image/svg+xml 的 data URL。遠端圖片 URL 會被丟棄。沒有有效圖片資料時，先以有背景色的 div 區塊替代。
不要在 CSS 使用外部 URL、背景圖、外部字型或 CDN；預覽與匯出限制外部資源。

## styles 與 responsive

CSS 使用 kebab-case 屬性名稱，所有值都用字串，例如 "font-size":"24px"，不能用 fontSize 或數字 24。
只允許下列屬性：

display, flex-direction, justify-content, align-items, flex-wrap, gap, grid-template-columns, width, height, min-height, max-width, padding, margin, background-color, color, font-size, font-weight, line-height, text-align, border, border-radius, box-shadow, position, top, right, bottom, left, flex, overflow, padding-top, padding-right, padding-bottom, padding-left, margin-top, margin-right, margin-bottom, margin-left

每個值須通過目標瀏覽器的 CSS.supports(key, value)，也不能含 < > ; { }。
單一屬性只填值，不包含屬性名稱或分號。例如 padding 的值為 "16px 24px"。
styles 是桌面基本樣式。responsive.tablet 在 <=1024px 覆寫，responsive.mobile 在 <=600px 再覆寫；mobile 會繼承桌面與平板未覆寫的樣式。
沒有自訂 media query、hover、動畫、偽元素、任意 class、任意選擇器或自由 CSS 區塊。

## actions

actions 放在「觸發事件的來源元件」上，而非放在被修改的目標上。
每筆基本動作：

```json
{"event":"click","type":"text","target":"el-2","value":"已點擊"}
```

- event：click、input、change、submit。
- type：text、toggle、class、increment、input。
- target：已存在的元件 ID。
- value：字串，最多 5000 字元；不需要值時仍填空字串。
- text：將目標 textContent 設為 value。請以文字葉節點為目標，避免替換容器子元件。
- toggle：切換目標 hidden 狀態。
- class：切換編輯器預設的 is-active 樣式，不是任意 CSS class；value 不決定 class 名稱。
- increment：把目標的文字當成數字加一，非數字從 0 開始。
- input：讀取觸發來源的 value，更新目標文字；來源使用 input 或 textarea。
- 不支援任意 JS、fetch、API、迴圈或 AI 呼叫。

可選條件欄位：

```json
{
  "event": "click",
  "type": "text",
  "target": "el-3",
  "value": "請先輸入",
  "condition": {"source":"el-2","operator":"empty","value":""},
  "otherwise": {"type":"text","target":"el-3","value":"已輸入"},
  "steps": []
}
```

condition.operator 只允許 empty、not-empty、equals；source 必須是存在的元件 ID。條件讀取來源 input/textarea 的 value，其他元素讀 textContent，再 trim。
主動作與 steps 在條件成立時依序執行；否則只執行 otherwise。steps 最多 10 個，單步格式為 {"type":"...","target":"...","value":"..."}，不帶 event 或巢狀條件。
所有 target、source、otherwise.target、steps[*].target 必須存在；失效引用可能造成整筆互動被匯入器移除。

## 使用及驗收

1. 將本文件與 example-project.json 一起交給 AI，加上設計需求。
2. 下載 AI 回傳的 .json，或將單一 JSON 區塊內容另存成 UTF-8 的 design.json，不要包含 Markdown 圍欄。
3. 在網站按「載入專案 JSON」，先備份重要的原作品。
4. 檢查桌面／平板／手機版面，並在「操作預覽」測試每個互動。
5. 匯入通過仍可能有不支援屬性被清除，因此一定要檢查實際成果。

來源：app.js 的 STYLE_KEYS、TAGS、CONTAINERS、actionLines、jsCode、validateProject、project-file onchange。
本文件不修改網站功能，也沒有新增通用 HTML 自動轉換器。
