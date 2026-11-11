# 🐹 倉鼠小帳本

兩個人的共同伙食基金，手機瀏覽器就能用。可部署到 **GitHub Pages**，用 **Supabase** 儲存共用資料、登入與即時同步。

已設定為：**每月 15 日補滿 NT$10,000；建立帳本的你負擔 60%，女友負擔 40%。**

## 先看效果

專案包含建置好的 `dist/`。安裝 Node.js 22 以上後，在此資料夾執行：

```sh
npm run dev
```

打開終端機顯示的網址（預設 `http://127.0.0.1:4173`）。未設定雲端時會進入明確標示的「本機示範」，可以新增、修改、刪除、搜尋及查看報表。**示範資料不會同步，也不會匯入正式雲端帳本。**

若要修改程式後重新建置：

```sh
npm ci
npm test
npm run build
npm run dev
```

## 部署步驟（只需要設定一次）

### 1. 建立 Supabase 共用資料庫

1. 前往 [Supabase](https://supabase.com/) 登入，建立一個新專案，保管好資料庫密碼。選擇適合自己的方案；額度及是否暫停以 Supabase 當時的方案為準。
2. 等待專案建立完成，開啟 **SQL Editor → New query**。
3. 複製這份專案的 **`supabase/schema.sql` 全部內容**，貼上執行。請使用全新專案；此 SQL 不會刪除你的資料。
4. 專案的 **Connect** 或 **Settings → API Keys** 中，找到 **Project URL** 與 **Publishable key**。介面名稱可能隨 Supabase 更新；舊專案也能使用 `anon` key。
5. **只能使用公開 publishable／anon key。不可把 secret、service_role key 或資料庫密碼放進前端／GitHub。** 程式與 SQL 已搭配登入與 RLS，資料只對同一本帳本的兩個成員開放。

SQL 同時會設定 Realtime publication。若沒有即時更新，查看 **Database → Publications → supabase_realtime**，確認 `entries`、`households`、`members` 已啟用。網頁另有每 30 秒更新與手動重新整理作為備援。

### 2. 把專案放上 GitHub

1. 建立一個新的 GitHub repository，例如 `hamster-wallet`。使用免費 GitHub Pages 時可選公開 repository，帳目本身仍留在 Supabase 的權限保護內。
2. 把這個資料夾的**內容**上傳到 repository 根目錄。根目錄應直接看到 `package.json`，不能多包一層 `hamster-wallet/`。
3. 請確認 **`.github/workflows/deploy.yml`** 也有上傳，這是自動部署設定。不要上傳 `node_modules/`、私人密碼或其他無關檔案。
4. 主要分支請使用 **`main`**。若使用其他分支，修改 `deploy.yml` 的 `branches`。

### 3. 填寫公開連線資訊

在 GitHub repository 的 **Settings → Secrets and variables → Actions → Variables → New repository variable**，新增兩個變數：

| 名稱 | 值 |
| --- | --- |
| `SUPABASE_URL` | 你的 Project URL，例如 `https://xxxxx.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | 你的公開 `sb_publishable_...` 金鑰（或舊版 anon key） |

也可以直接修改 `public/config.js` 的兩個欄位再提交；如果 GitHub Variables 已有設定，建置會以 Variables 為優先。只選一種方法即可。

### 4. 啟用 GitHub Pages

1. 開啟 repository 的 **Settings → Pages → Build and deployment → Source**，選 **GitHub Actions**。
2. 到 **Actions → Deploy hamster wallet → Run workflow → Run workflow**。
3. 等流程全部變綠；部署網址會出現在 GitHub Pages 設定與 Actions 的 deployment 結果中，通常是 `https://你的帳號.github.io/hamster-wallet/`。
4. 之後每次推送 `main` 都會自動執行測試、建置並部署。

### 5. 設定登入信件的回跳網址

回 Supabase 的 **Authentication → URL Configuration**：

- **Site URL**：填上實際 GitHub Pages 網址，包含 repository 路徑與結尾 `/`。
- **Redirect URLs**：加入同一個完整網址。若你也在本機測試，可另加入 `http://127.0.0.1:4173/`。
- 保持 Email 登入可用。若開啟 Email confirmation，註冊後請先收驗證信。
- 忘記密碼功能也會使用這個回跳網址；驗證或重設連結需在同一個已設定專案的網站開啟。

### 6. 你先建立，女友再加入

1. **你**在網站註冊、驗證 Email 並登入。選「建立帳本」，輸入共同戶頭**開始記帳當下**的實際餘額。
2. 到 **小窩設定 → 顯示邀請碼 → 複製邀請碼**，私下分享給女友。
3. **女友**用自己的 Email 註冊並登入，選「使用邀請碼」加入。不要由女友再建立另一個帳本。
4. 邀請碼 7 天到期、只能加入一位夥伴；加入後即失效。你也可以更新邀請碼讓舊碼失效。
5. 兩台手機使用**同一個網站網址**與各自帳號，就能共用資料。登入狀態會保留在各自手機。

## 放進手機主畫面

- **iPhone**：Safari 開啟網站 → 分享 → 加入主畫面。
- **Android**：Chrome 開啟網站 → 選單 → 加入主畫面／安裝應用程式。
- 使用 HTTPS 的 GitHub Pages 可提供 PWA 體驗。程式會快取介面檔案；雲端帳目需要網路。離線不開放新增記帳，沒有背景待同步佇列。
- 本機預覽網址只在電腦上有效；**兩台手機請使用部署完成的 HTTPS 網址**。

## 補款到底怎麼算？

每期是台北時間 **15 日 00:00 到下個月 14 日 23:59**，記帳以日期為單位。

假設 15 日開始時，上期結餘是 **NT$3,000**：

| 項目 | 金額 |
| --- | ---: |
| 本期需補款 | 10,000 − 3,000 ＝ **7,000** |
| 你應補 60% | **4,200** |
| 女友應補 40% | **2,800** |

即使你們晚幾天才補款，15 日後的新支出也不會增加這次的應補金額。支出會降低現有餘額，供下一期結算使用。**這不是每個月額外存一萬，也不會在跨月時把帳戶餘額清零。**

- 每筆補款必須在實際存入後手動記錄，網站不串接銀行、不轉帳、不自動新增虛構入帳。
- 月中第一次啟用時，以今天為第一期的實際開始日；填入的期初餘額視為已存在的錢，從它補到一萬。不能新增啟用日之前的紀錄。
- 單位為新台幣整數。你應補金額四捨五入到元，女友補剩餘差額，兩者加總必定等於本期應補。
- 分次補款會持續扣除各自的應補餘額；若有人超額補款，錢會保留在共同餘額。個人剩餘欄依原分攤各自計算，不會自動把另一人的份額轉移。總補款充足時共同缺額為零。
- 結餘高於目標，當期不用補款；結餘為負，會連同不足額一起補到目標。
- 補登／修改上期紀錄會重新計算之後的結餘與應補款。沒有鎖帳，請兩人協調後修改。
- 可在設定修改目標金額、補款日、比例與名稱。**規則變更會重新計算歷史報表**，沒有各月份獨立規則版本。
- 期初餘額建立後不可在介面直接修改；請建立帳本時核對實際餘額。

## 已有功能

- 可愛雙倉鼠原創 SVG 插畫、奶油綠介面、手機底部導覽。
- 收支新增、修改、刪除、分類、日期與記帳成員。
- 跨月結餘、補款進度、60／40 分攤與每天可用金額估算。
- 當期與歷史期別的流水帳、關鍵字搜尋、收支篩選、分類圖表。
- 全部或篩選結果匯出 CSV，含 Excel 中文 BOM 與公式注入防護。
- 雙人 Email 登入、驗證信、忘記密碼、限兩人的單次邀請碼。
- Realtime 同步、回到前景重新載入、定期與手動更新。
- UUID 重試防重複、版本衝突檢查，避免兩台手機互相覆蓋修改。
- 資料庫軟刪除，只有帳本成員可讀取資料；寫入由受控 SQL RPC 驗證。

## 驗證與限制

```sh
npm test
```

測試包括跨年、15 日切期、短月份／閏年、餘額結轉、60／40 尾差、分次補款、非法輸入、CSV 轉義，以及 PGlite 中執行完整 SQL 的雙人流程、RLS、未授權存取、重試與修改衝突。PGlite 驗證 PostgreSQL 邏輯，不代表已驗證你實際專案的 Email 寄送與 Supabase Realtime 網路連線；部署後請依下列清單完成實機檢查。

首次上線檢查：

1. 兩個不同帳號成功加入同一本帳本。
2. 手機 A 新增一筆支出，手機 B 顯示相同餘額。
3. 手機 B 修改該筆支出，手機 A 更新。
4. 登出後不能讀取帳目；第三個帳號不能加入已滿的帳本。
5. 測試 CSV 與加入主畫面；完成後刪除自己的測試紀錄。

## 常見問題

**上線後仍是示範模式**：檢查兩個 GitHub Variables 名稱與值，重新跑部署；或修改 `public/config.js`。沒有設定雲端時，網站會明確顯示示範模式。

**出現 relation/function does not exist**：確認在相同 Supabase 專案執行完整 `supabase/schema.sql`。

**無法寄驗證信或信件太頻繁**：查看 Supabase Auth 設定、垃圾信匣、寄送限制與 SMTP 設定；程式使用 Supabase 的寄信服務，不自行寄信。

**手機沒即時看到更新**：確認網路及 Realtime publication，按右上角重新整理。Supabase 專案若暫停，需先恢復。

**另一台手機已修改**：關閉編輯視窗並重新整理，檢查對方最新內容，再重新編輯。

**GitHub Pages 404**：確認 Pages Source 是 GitHub Actions、workflow 成功，網址包含正確 repository 路徑。資源皆使用相對路徑，可用於 repository 子目錄。

**要換到另一個 Supabase 專案**：更新 GitHub Variables 或 `public/config.js` 後重新部署，並以新專案的帳號登入；不會自動遷移舊資料。

## 專案結構

```text
.github/workflows/deploy.yml  GitHub Pages 自動部署
public/                      HTML、樣式、設定、PWA 與插畫
src/app.js                   網頁互動、登入與同步
src/domain.js                期間、金額、分攤與 CSV 邏輯
supabase/schema.sql          資料表、RLS 與受控寫入函式
tests/                       計算與資料庫權限測試
scripts/                     建置與本機預覽
dist/                        已建置的靜態網站
```

部署方式依 [GitHub Pages 官方文件](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)；共用資料權限與同步依 [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)、[Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) 與 [登入 API](https://supabase.com/docs/reference/javascript/auth-signinwithpassword)。
