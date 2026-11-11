# 🐹 倉鼠小帳本

兩個人的共有伙食基金，用手機記帳、共用 Supabase 雲端資料庫，部署在 GitHub Pages。

正式網站：https://888god888.github.io/hamsteraccounting/

## 最新使用方式

- **自訂帳號＋密碼，不用綁定信箱。** 帳號為 3～24 個英文字母、數字、底線，大小寫視為相同帳號；密碼至少 8 個字元，註冊時輸入兩次確認。
- **餘額不夠時再充值。** 不再設定每月固定存款日，也不會將餘額補到一萬元。
- **充值總額與比例都能調整。** 在「小窩設定」修改每次總額與建立者的百分比，另一人的比例自動為剩餘百分比。預設總額 10,000、60%／40%，並非寫死。
- 比例只決定之後的建議充值額，**不會改寫已記錄的金額或餘額**。例如現有 500 元，兩人合計充值 10,000 元後就是 10,500 元。
- 在首頁點自己的充值卡片，會預填目前設定的分攤金額；款項實際存入後再儲存。也可以任意修改實際充值額，分次或不同日記錄。
- 支出可以直接打字填「吃了什麼好吃的？」，金額另外填寫。
- 月份只用來篩選流水帳及報表，不會重設餘額，也不會產生自動入帳。

## 雙人共用

1. 你先註冊並選「建立帳本」，輸入共同戶頭開始記帳前的實際餘額。
2. 到「小窩設定」產生邀請碼，私下分享給女友。
3. 女友以自己的帳號註冊，選「使用邀請碼」加入同一本帳本。
4. 每個帳本最多兩位成員，邀請碼 7 天到期、加入後即失效；兩人可隨時新增、修改記錄。

既有信箱帳號仍能在「帳號」欄輸入原 Email 登入，保留原身分與帳目。不要另建新帳號來取代已有帳本的帳號。

自訂帳號沒有真實信箱，因此沒有信箱找回密碼功能，請自行保管帳密。

## 手機安裝

- iPhone：Safari → 分享 → 加入主畫面。
- Android：Chrome → 選單 → 加入主畫面／安裝應用程式。
- 雲端記帳需網路。離線會暫停新增，避免兩台手機紀錄不同步。
- 可按右上角重新整理；Realtime 以外也會定期及回到前景時更新。

## GitHub Pages 部署

現有正式專案已設定好，更新後將程式推送到 `main` 即會自動測試、建置、部署。

全新部署：

1. 建立 Supabase 專案，在 SQL Editor 執行 `supabase/schema.sql`。
2. Authentication → Sign In / Providers：啟用 Email／密碼登入與註冊，**關閉 Confirm email**。自訂帳號使用內部識別，不寄信；匿名登入不需要啟用。
3. 將專案內容推送到 GitHub repository 根目錄，需包含 `.github/workflows/deploy.yml`。
4. Repository Settings → Secrets and variables → Actions → Variables 設定：
   - `SUPABASE_URL`：Project URL。
   - `SUPABASE_PUBLISHABLE_KEY`：公開 publishable key，不能使用 secret／service_role key 或資料庫密碼。
5. Settings → Pages → Source 選 GitHub Actions。
6. 到 Actions 執行 Deploy hamster wallet，或推送 `main` 觸發部署。
7. Supabase Authentication → URL Configuration：Site URL 及 Redirect URLs 填實際網站完整網址（包含 repository 路徑與結尾 `/`）。

也可修改 `public/config.js` 的公開連線設定；GitHub Variables 若已設定，建置時會以 Variables 為優先。

## 本機開發與驗證

需要 Node.js 22 以上：

```sh
npm ci
npm test
npm run build
npm run dev
```

開啟終端機顯示的本機網址（預設 http://127.0.0.1:4173）。未填雲端連線設定會進入明確標示的示範模式，資料只存在這台裝置，不會匯入正式帳本。

測試包含充值累加、跨月保留、任意比例與尾差、調整比例不改歷史、帳號正規化與登入對應、舊帳號相容、SQL 雙人權限、邀請、衝突與防重複。

## 實作與相容性

- `src/auth.js`：將帳號正規化為 Supabase Auth 的內部識別 `u_<帳號>@accounts.hamster.invalid`。`.invalid` 是不寄信的保留網域，使用者不需提供信箱；密碼只交給 Supabase Auth，不寫入帳本資料表或本機儲存。
- 真正的資料權限使用 `auth.uid()` 與成員表，沒有把顯示名稱或可修改的使用者 metadata 當成權限來源。
- 為保留既有帳本，沿用資料庫 `households.target` 儲存「每次建議充值總額」、`owner_share` 儲存比例；`refill_day` 是相容舊版保留欄位，新版不再用它切期或計算存款。
- 不需要重新建立資料庫或搬移資料，舊的支出與補款紀錄直接保留；補款在新版顯示為充值。
- 現有資料表皆有 RLS，直接寫入受限，修改透過 SQL RPC；只對同一本帳本的成員開放。
- 修改金額、刪除紀錄等會依實際流水帳重新計算餘額；期初餘額建立後不開放直接修改。

官方參考：[Supabase Auth](https://supabase.com/docs/reference/javascript/auth-signup)、[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)、[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
