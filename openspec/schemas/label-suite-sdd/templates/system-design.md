# System Design

## 分層與類別

```mermaid
classDiagram
  class ExampleRouter
  class ExampleService
  class ExampleRepository
  class ExampleModel
  ExampleRouter --> ExampleService
  ExampleService --> ExampleRepository
  ExampleRepository --> ExampleModel
```

## 關鍵情境

<!-- 每個關鍵 Scenario 一張，標題與 specs 的 Scenario 名稱相同（規格書的驗收標準怎麼命名就怎麼寫） -->

### Scenario: <名稱>

```mermaid
sequenceDiagram
  participant Client
  participant Router
  participant Service
  participant Repository
  participant DB
  Client->>Router: HTTP request
  Router->>Service: 呼叫
  Service->>Repository: 查詢／寫入
  Repository->>DB: SQLAlchemy
  Router-->>Client: 回應
```

## 常駐文件異動

<!-- 上面兩節仍畫這次新增或修改的類別與這次的 Scenario。
     沒有異動時，刪掉路徑與表格，只寫一行「本次無常駐文件異動」。 -->

- 常駐文件：`docs/diagrams/architecture/backend-modules.mdx`

| 節 | 異動 | 摘要 |
| :--- | :--- | :--- |

## 資料模型異動

<!-- schema 只由 Alembic 管理（含 dev 與 test）。已部署的 migration 不再修改。
     沒有資料模型異動時，刪掉路徑與表格，只寫一行「本次無資料模型異動」。 -->

- 字典：`docs/diagrams/architecture/data-table-dictionary.mdx`
- ER：`docs/diagrams/architecture/database-schema.er.json`

| 表 | 異動 | 欄位／索引 | 波及的表（依字典 FK 與被參照） | Alembic migration 可逆 | SQLite 與 PostgreSQL 的差異 |
| :--- | :--- | :--- | :--- | :--- | :--- |

## 權限檢查點

<!-- 哪一層檢查哪個角色；哪些欄位依角色遮蔽。
     涉及測試集答案時，寫出「標記員能接觸到的任何地方都看不到答案」怎麼在這一層成立。 -->
