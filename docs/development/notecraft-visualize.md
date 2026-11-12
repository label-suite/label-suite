---
title: NoteCraft 視覺化與插圖規範
description: docs/ 底下 @ai-visualize 標記、生成元件與獨立插圖的規範。
tags: [notecraft, docs]
---

# NoteCraft 視覺化與插圖規範

目標是**幫助理解**，不是每篇都要有圖。調性：專業、克制，像技術文件或顧問報告裡的圖，不走 Q 版或卡通路線。
生成流程依 `content-visualize` skill，視覺 token 依 `label-suite-design` skill（來源 `design/prototype/assets/tokens.css`）。
文件語法見 [notecraft-writing.md](notecraft-writing.md)。

## `@ai-visualize` 標記

```mdx
{/* @ai-visualize
id: spec-06-01-account-lifecycle-flow
type: motion
prompt: |
  核心洞察：帳號從邀請到停用，每一步都由系統管理員觸發，受邀的使用者只在啟用時參與。
  互動：tab 切換「邀請」「停用」，按鈕「下一步」逐步揭露節點與連線。
  圖形：左右兩條泳道（系統管理員、受邀的使用者）；例外流程用黃色虛線拉回。
  資料/數值：每一步標出對應的驗收 Scenario。
caption: 切換流程，逐步看帳號在誰手上
status: pending
*/}
```

- `id` 為 kebab-case，同時是元件檔名 `.notecraft/components/<id>.tsx`
- `type`：`diagram`、`chart`、`timeline`、`table`、`motion`、`free`（只是提示）
- `status`：`pending` 待生成、`generated` 已生成（明確要求才重生）、`locked` 永遠跳過、`failed` 生成失敗
- prompt 一定寫「互動」與「圖形」兩段；有數值就寫「資料/數值」
- 標記不要包在程式碼圍欄裡（會把 prompt 顯示給讀者）
- 生成後 skill 會在標記下方寫入 `GeneratedFrame` 與 import，不要手動改格式；有互動才加 `client:visible`
- 請 agent 處理時說「處理 `docs/xxx.mdx` 的視覺化標記」
- PRD 的三張圖見 `prd-writing` 的 `references/visualize.md`；規格的業務流程圖見 `spec-writing` 的 `references/flow.md`，兩者都從骨架複製、只換資料
- 規格「規格」章節的畫面用 `PrototypeFrame` 嵌入 `design/prototype/` 的頁面，不另畫 wireframe

## 何時加互動元件

- 內容有「變化、取捨、流程、比較」才下標記；純觀念或查表型文件只用文字與表格
- **互動優先**：slider、stepper／tab 走查、並排模擬、逐步揭露動畫；內容本質靜態（查表、結構快照）才用靜態圖

## 圖形

- 首選資訊圖形：時間軸、甘特圖、流程圖、泳道圖、狀態機、雷達圖、座標圖、架構圖、看板
- 需要具象畫面時只畫物件或場景的簡化示意（伺服器、文件、佇列、瀏覽器）
- **不畫 Q 版人物**（大頭、腮紅、表情、冒汗、歡呼）；表示「人／角色」用中性角色標籤或簡單剪影
- 不加裝飾元素（星光、彩帶、太陽、樹、金幣）
- 圖要參與互動：隨 state 改變位置、長度、數量、顏色，不是旁邊放一張裝飾圖

## 視覺風格

- 細線 1–2px、無粗黑外框；以面積、色塊、留白區分層次
- 主色靛藍（`--color-primary`）＋ 警示黃（`--color-warning`）＋ 中性灰（slate 色階）；語意色只用於狀態（完成、警示、待處理）
- 文字標籤清楚對齊；有數值標數值與單位；有軸畫刻度與格線
- **底要乾淨**：整塊背景白底 `#FFFFFF` + 1px `#E2E8F0`（`--color-border`）細框；SVG 背景 rect 寫 `x="0.5" y="0.5"`、寬高各減 1
- 不用灰底整塊墊底；物件底下不墊淺色橢圓或大色塊

## 元件實作

- 檔案 `.notecraft/components/<id>.tsx`：default export、無 required props、根元素不自帶卡片外框（外框由 `GeneratedFrame` 提供）
- import 白名單：`react`、`react-dom`、`motion`、`recharts`、`d3`、`lucide-react`、`clsx`、`tailwind-merge`、`three`
- 3D（`three`）只在空間關係是重點、或作者明確要求時用；寫法依 `content-visualize` skill「3D 元件（three）」，HTML 部分照下方「顏色與樣式」用 Tailwind class
- **不從別的生成元件 import**；圖直接寫在檔內（SVG JSX，拆成檔內小函式元件）
- **顏色與樣式依 `label-suite-design` 的「怎麼用」**：HTML 元素（面板、按鈕、標籤、表格）用對照表裡的 Tailwind class；
  SVG 屬性、tsx 骨架的色票常數與傳給 three 的值用檔內 hex 常數，每個常數以註解標出 token 名稱
  - 生成元件的 Tailwind class 會被編譯；Tailwind 只產生有元件用到的 class，沒人用的 class 在建好的 CSS 裡搜不到是正常的
- SVG 要有 `viewBox`、`width="100%"`、`role="img"` 與描述畫面的 `aria-label`
- 禁止 emoji；尊重 `useReducedMotion()`（關閉動畫時直接呈現終態）
- 按鈕列、選項不用 `<ul>`／`<ol>`（prose 樣式會加編號或圓點），改 `<div role="group">`

### 滿版

- 根元素 `width: "100%"`，不設 `maxWidth` + `margin: auto`
- 橫向延展的圖（時間軸、甘特圖、並排面板）用 ResizeObserver 量 SVG 實際寬度，讓 `viewBox` 寬 ＝ 像素寬
  （設最小設計寬度，窄螢幕才等比縮小），座標依寬度計算；量測 hook 寫在該元件檔內

```tsx
function useMeasuredWidth(min: number) {
  const ref = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(min);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(min, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return { ref, width };
}
```

## 獨立插圖（選用）

- 只在一張圖明顯幫助理解時才放（公認模型圖、架構圖）；緊接著已有互動元件表達同一件事就不放
- 路徑 `docs/assets/illustrations/<筆記slug>-<主題>.svg`，手寫 SVG，風格同上；插圖傳達概念，不是 logo 或情境漫畫
- 以相對路徑嵌入：`![描述性 alt](../assets/illustrations/xxx.svg)`
- **`<svg>` 的 `width`／`height` 設為 viewBox 的 2 倍**，`<img>` 才會縮到剛好滿版：

  ```xml
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 320" width="1520" height="640">
  ```

  不寫成與 viewBox 同寬（寬版兩側留白），也不用 `width="100%"`（`<img>` 內沒有固定內在尺寸）

## 驗證

生成或修改元件後，觀察開著的 `pnpm docs:serve`，**或**跑 `pnpm exec notecraftapp build docs`。
**只改了元件、沒改 MDX 時**，快取不會察覺，要跑 `pnpm exec notecraftapp build --rebuild docs`。
在瀏覽器實際操作每個互動（tab、按鈕、逐步播放）再算完成。

⚠️ **兩條路徑不要同時走。** `docs:serve` 的 `--watch` 預設開著，存檔會觸發它自己的一次 build；它和你手動跑的那一次共用同一個 `.astro/`、沒有跨行程鎖，**撞在同一個瞬間時其中一個會失敗**（[#172](https://github.com/label-suite/label-suite/issues/172)）。這是**間歇**的，不是必定：碰撞視窗只有 build 最前面的一兩秒，watcher 那一輪落在什麼時間點也不受你控制。
**這不是叫人別用 `docs:serve`**——用 watcher 驗就別再手動 build；要手動 build 就先停掉 `docs:serve`，**而且 build 完要重新開起來才看得到新產物**（`--rebuild` 輪替過 `dist` 之後，原本開著的那個 serve 會一直服務舊的 `dist.prev`）。判準與怎麼分辨真失敗見 [spec-migration.md §建置閘門要重跑確認](./spec-migration.md#建置閘門要重跑確認)。
