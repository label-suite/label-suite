細長的進度條，用填滿比例表示一件已知總量的工作做了多少。

## 何時使用

- 已知總量的進度：任務標註完成率、批次完成數、成員進度。
- 總量未知或只是在等待時不用它；目前沒有不確定（indeterminate）狀態，等待請用 Skeleton 或按鈕 loading。

## 結構與使用方提供的內容

- `.progress` > `span`，填滿寬度由使用方以行內 `style="width: 65%"` 給。
- 軌道高 6px，軌道色 `--color-border`，填滿色 `--color-cta`。
- ARIA 由使用方補：`role="progressbar"`、`aria-valuenow`、`aria-valuemin="0"`、`aria-valuemax="100"`，以及 `aria-label` 或可見的標籤文字。
- 數字（「65%」「12 / 20」）放在進度條旁邊的文字裡，不放進條內。
- 寬度跟著容器走，沒有固定寬；放在表格欄位裡時由欄寬決定長度。

```html
<div class="progress" role="progressbar" aria-valuenow="65" aria-valuemin="0" aria-valuemax="100" aria-label="標註完成率">
  <span style="width: 65%"></span>
</div>
```

## 變體

- 只有一種。填滿色永遠是 `--color-cta`，不隨進度好壞改色。

## 狀態

- 0%：只看得到軌道。
- 部分：寬度變化有 300 ms 過渡。
- 100%：整條填滿，顏色不變。
- 沒有錯誤、暫停、不確定狀態；需要表達健康度或異常時，旁邊加一個 Badge。

## 該做／不該做

- 該做：旁邊附上數字或文字，讓不看顏色也能知道進度。
- 該做：補齊 `role="progressbar"` 與 `aria-value*`。
- 不該做：用紅、黃、綠表示進度好壞；健康度交給 Badge。
- 不該做：拿它當載入動畫。
