# CAT LAB V5.1.2｜製作規則管理中心

## 操作
登入 /studio.html，管理者可見「製作規則管理中心」。調整數值、載入初始設定或最近 10 個歷史版本為草稿，按發布後才會生效。員工無權讀取歷史或發布。顧客每次完成作品、工作室每次開啟製作單時讀取最新發布規則；離線明確標示使用初始規則。

## 安裝與回退
1. 先在隔離的測試 Supabase 環境，依序完成原本 studio_v50.sql、studio_v501_photos.sql 後，執行 supabase/studio_v512_rules.sql 一次。
2. 設置 Preview 專用 Supabase 環境變數，避免測試發布寫入正式資料庫。原本 Preview 若連到正式資料庫，不要用它發布測試規則。
3. 測試 owner / staff / anonymous、兩裝置同時發布、歷史載入後再發布、顧客與工作室同一規則版本、未安裝表時預設提醒、重新開啟舊製作單。實測 Canvas 與手機。
4. 驗收後才經所有者批准在正式資料庫安裝新增表及 RPC，並合併既有 PR #9、#10。遷移不會改寫原訂單或色票；未安裝時規則中心不可發布。
5. 回退設定：從歷史版本載入草稿並再次發布（不刪除版本、不倒退版本號）。回退程式可部署原版本，新增表可保留，不需刪除資料。

## 權限與資料
規則表僅 service_role 可 SELECT/INSERT，啟用 RLS；發布 RPC 僅 service_role 可執行，API 先以實際登入 token 驗證 owner，RPC 再檢查 active owner 成員；交易內鎖定並檢查 expected revision，新增不可變版本。公開 API 僅回傳當前規則與版本時間，不公開發布者 UUID 或歷史。規則是提醒，不作為價格或拒單依據。既有訂單重新開啟時採最新規則，尚無逐單評估歷史快照。

## 檢查
node --test tests/share-production.test.cjs tests/production-rules.test.cjs tests/cloud-render.test.cjs
本次以 JS 測試 harness 執行純函式、模擬 HTTP 與靜態語法檢查；未實際執行 SQL、驗證 RLS 或測試瀏覽器。所有初始尺寸與門檻須由工作室依實體校正。
