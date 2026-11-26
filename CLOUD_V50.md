# CAT LAB V5.0｜雲端工作室預覽

這是可設定部署的雲端基礎版本，不是已完成正式營運驗收的系統。基於 V4.7.2 及 V4.6.2。

## 已實作
- 顧客 index.html：讀取已發布色票及版型（不含工作室顏料編號），送出作品、收件編號、同一頁內重試識別碼，無雲端時保留下載／試玩。
- /studio.html：登入（電子郵件／密碼）、owner/staff 角色、雲端製作單分頁、指定負責人／日期／備註、左右顏料勾選、QC、進度更新與下載原始製作快照。
- /api/studio.js：Vercel serverless API，公開色票、收件、登入、私人製作單與管理者發布。伺服器根據不可變色票版本補入顏料編號；不信任顧客傳入的編號、狀態或製作規格。
- supabase/studio_v50.sql：角色及 RLS、不可變色票版本、原始訂製資料與營運欄位分離、版本衝突保護、原子發布、重試辨識、基礎每 IP 雜湊限流。公共 API 不提供訂單查詢。
- 管理者可選取 V4.7 完整備份，只上傳 palette 及 geometry.published，不傳備份的其他內容。

## 設定流程（需專案所有者操作）
1. 建立 Supabase 專案；在 SQL Editor 執行 supabase/studio_v50.sql（新資料庫，一次性 migration）。
2. 在 Auth 建立第一位工作室管理者，將其真實 auth.users UUID 插入 studio_members，role='owner'。每位員工各有獨立帳號，role='staff'。停用公開註冊。不要把使用者密碼寫入 GitHub。
3. 建立 Vercel Preview（從 feature/cloud-v50）。在專案 Environment Variables 配置：
   - SUPABASE_URL（https://<project>.supabase.co）
   - SUPABASE_ANON_KEY（Supabase legacy anon JWT key）
   - SUPABASE_SERVICE_ROLE_KEY（Supabase legacy service_role JWT key，**僅伺服器**）
   - STUDIO_RATE_SECRET（至少 32 字元高熵隨機秘密，**僅伺服器**）
   不得使用 NEXT_PUBLIC_ 等公開前綴，不得提交 .env 或密鑰。
4. 重新部署 Preview，訪問 /studio.html 登入，從 V4.7 本機工作室備份發布實際色票與版型。所有啟用顏料須有真實且唯一的編號。
5. 開啟顧客端，使用測試設計送出，記錄收件編號；以另一個 staff 帳號登入確認同步。用兩裝置更新同一單，第二次舊 revision 應收到 409。
6. 檢查匿名或非成員無法查詢訂單、員工不能發布、公開色票 JSON 無 code、服務金鑰不在客戶端。使用測試資料驗收，不要先導入正式顧客資料。
7. 完成安全／瀏覽器驗收後，再評估正式 main 合併及部署。

## 尚未完成
- 真正的 Supabase／Vercel 設定、SQL migration 執行、端到端登入/角色/RLS/並行寫入測試、跨裝置實測。
- V4.7 完整專注製作視圖尚未整合至雲端後台；目前雲端工作室可下載設計快照，由 V4.7 本機工作台匯入製作。照片尚未雲端儲存，備份整體遷移與雲端工作單匯入也尚未完成。
- QDM 訂單、付款、收件通知、顧客聯絡及狀態追蹤未串接。收件不代表成立交易。
- MFA、登入節流/驗證碼、完整稽核、IP 雜湊限流清理、監控、備份及災難還原等正式環境硬化需驗收。基本每 IP 限流不是完整反濫用機制。
- 登入 token 僅在頁面記憶體，重新整理需要重新登入，沒有持久登入或 token 自動刷新；未設環境變數時 API 503，不會宣稱成功。
- API 作品上限約 950KB，超大設計應走原本的下載檔流程。
- 歷史本機設計若色票／版型與目前發布版本不同，線上送出會拒絕而非自動改色。
- 真實實體顏料編號及映射尚未提供；測試僅使用測試值。
- 分色與手工可行性仍需人工確認。

## 本輪驗證
JS 語法檢查、GitHub 遠端原始碼檢查；API 純函式 9 項測試通過：公開投影不含 code/停用色、忽略顧客偽造編號、移除偽造製作 metadata、拒絕缺編號及重複編號、修改版型、停用顏料、非法筆畫、超範圍版型。這些不是部署後的資料庫權限或真實瀏覽器驗收。不要直接投入正式營運。
