# CAT LAB 開發路線與驗收閘門｜2026-11-27

## 範圍
依序推進 V5.2 驗收、V5.3、V5.4、V5.5、V5.6、V5.7、V5.8。V5.2.1 歷史工時/員工名稱/補登、V5.2.2 材料成本、V5.2.3 自動工時成本模型暫緩。不自動擴張定價、薪資或付費服務。

## 基線與本次實作
- 正式 main 26b6d49；PR #9 79c4716、PR #10 e926e10 尚待正式整合。
- Preview Supabase avciiiwqvgzmxeeohvkm 已安裝 studio_v512_rules 與 studio_v520_work；真實 service_role SQL 交易測試通過：owner 發布、staff 拒絕、版本衝突、start 冪等、禁止重複開啟與控制他人計時、pause/resume/finish、owner/staff snapshot。交易 rollback；1 初始規則、0 sessions、0 intervals。
- RLS 已啟用，新表不授權 anon/authenticated 讀寫，三個 RPC 僅 service_role 執行，均 security invoker。
- Vercel connector 回 403/404，不能核實預覽的實際 API、資料庫環境變數或瀏覽器操作；暫不合併正式版本或安裝正式資料庫。既有 security advisor 警告（原有 3 個 authenticated security definer RPC、洩漏密碼保護未啟用）需另檢核，新增表無 policy 為刻意 server-only。
- V5.3 第一階段在 feature/mobile-canvas-v53 / PR #11，保留 mobileCanvas46，增加 1–3 倍縮放、雙指移動、單指移動模式、回正、第二指取消未完成筆畫；純函式測試。未做手機真機測試。

## 開發順序與驗收
| 版本 | 實作內容 | 驗收與依賴 |
|---|---|---|
| V5.2 | Preview 瀏覽器完整顧客創作→分享→送件→工作室接件→品檢照片→規則發布→工時計時；owner/staff/anon、雙裝置、斷線、跨日；確認 Vercel Preview 環境指向測試 DB | 恢復 Vercel 專案授權或由使用者實機驗收，備份正式 DB，安裝兩個 additive migrations；先 PR9，再 retarget PR10 到 main，合併後驗證正式站；失敗則不推後續版本 |
| V5.3 | 保留既有底部面板、左右耳縮圖和專注模式；畫布 pinch/pan、縮放按鈕、取消誤畫；再依手機實測優化 safe area、觸控區域、流程與螢幕鍵盤 | iOS Safari、Android Chrome、QDM iframe 實機；畫布與原始座標一致、復原/重做、單指筆畫、第二指取消、pointercancel、雙耳切換、完成與收藏 |
| V5.4 | 先沿用既有 refFile/refImage 本機參考圖，再新增點選取色及主要色彩→現行發布色票匹配、可選擇套用；版本化範本，owner 管理排序/啟停/發布，staff 讀取 | 不上傳照片；不可改寫原設計，套用前確認可復原；停用色票要提示重新對應，不自動產生不可製作花色 |
| V5.5 | 同一 WebGL context/兩件模型及獨立 texture；單/雙耳顯示、同步/獨立旋轉；實品樣片校色，讀取型 3D 分享 PNG 與比例尺 | 保持 16K 鼻/五金與柔亮陶瓷；GLB 不變；WebGL 不支援時回退 2D；不可把未測量的顯示器比例當真實大小 |
| V5.6 | 從 V2 可見色區分析取得 region bbox/centroid，於製作圖標記；手動對齊成品照片疊圖與透明度；結構化 QC；原設計/修訂提案/顧客確認分離 | 保留 immutable 原始設計；照片僅授權工作室；提示區域非工藝判決；版本衝突、未確認修訂不得代替原設計 |
| V5.7 | QDM 官方自訂結帳欄位（擴充 > 自訂結帳欄位）可收設計收件編號；先人工核對設計、商品、正式訂單、已付款；再接授權唯讀 API 取訂單資料及付款狀態；一對多與退款例外需處理 | QDM 商店方案/權限、產品 URL/SKU、價格、實際 API 回傳結帳欄位與付款狀態待確認。金流由 QDM 完成；不可憑瀏覽器回跳或顧客自填標記已付款。進度查詢用私密 token/顧客身分而非公開可猜編號；不公開個資 |
| V5.8 | 保留免登入創作、本機收藏；顧客身分獨立於 studio_members；雲端收藏 CRUD、明確 opt-in 分享 token、可撤銷、再次訂製以新設計複本 | RLS 按作品所有者；分享只含公開設計資料，不含私密照片/顏料編號/訂單；跨裝置、撤銷、刪除、舊色票重新對應、不可自動成立新訂單 |

## QDM 官方依據
- https://help.qdm.tw/support/solutions/articles/67000746298-api-%E2%96%8C%E5%A6%82%E4%BD%95%E6%89%BE%E5%88%B0-api%E6%86%91%E8%AD%89- ：創作室或品牌商方案與最高權限才有 API。
- https://ecapis.qdm.cloud/doc/ ：授權 API 文件。
- https://help.qdm.tw/support/solutions/articles/67000727942-%E8%B3%A3%E9%BB%9E%E9%AB%94%E9%A9%97%E6%9C%8D%E5%8B%99-%E2%96%8C%E8%87%AA%E8%A8%82%E7%B5%90%E5%B8%B3%E6%AC%84%E4%BD%8D ：結帳自訂欄位會進入訂單明細，但不進入下單通知信。
- 不假設 API 已能返回此欄位，或具備 webhook、checkout 預填功能，必須以實際測試確認。憑證只放伺服器環境變數，不寫入 repo 或前端。

## 下一個實際驗收
以 Preview 使用測試帳號和測試單執行，不在正式環境建立假訂單。V5.4–V5.8 本次僅規劃，尚未開發完成。各版本分支/PR 在前一版本驗收完成後依序合併，避免堆疊 PR 意外發布。
