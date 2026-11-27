# CAT LAB V5.5｜商品預覽 2.0
## 操作
- 編輯頁原有預覽：設計圖仍無耳夾，切換 3D 時預設雙耳；可切左耳、右耳或雙耳。
- 完成頁「查看雙耳 3D 預覽」：直接開雙耳，拖曳、雙指縮放、滾輪與回正。同步旋轉預設開啟；獨立模式依初次觸控的左右半區選耳，鍵盤可使用操作左耳／右耳按鈕。
- 分享卡新增「雙耳 3D 商品圖」，仍提供原有 2D 商品模擬圖、9:16 / 4:5 PNG。3D 以固定商品角度、1456×696 離屏渲染並立即複製畫面，不需要顧客先開啟 3D。失敗時提示改選原有圖。
- 底色色票參考顯示設計原始顏色；CAT6 enamel mesh 正面寬 10.3388074785 mm、高 10.1305013523 mm，畫面標示約 10.34 × 10.13 mm。非螢幕 1:1、非實品量測。
## 工程
- 同一 WebGL2 context、同一模型 GPU buffers、兩個獨立 texture / pose；兩個不重疊 viewport。保留 STUDIO createPreview.setArtwork(svg,color)。
- vertex/fragment shader 原文與 79c4716 一致：柔亮陶瓷、16K 金電鍍完全不改。GLB 仍 fa2c99afebe11720c3a25e7f8f2677228d654df7。
- 實品校色須提供實際顏料樣片與一致光源的照片，不擅自改已認可材質；本版只有參考色票與模型尺寸。
- 5 組 tests/pair-preview.test.cjs 以模擬 WebGL 呼叫測試左右貼圖與硬體分支、viewport、旋轉縮放、擷取、競態與資源釋放。JS 靜態語法已檢查。未實際執行 GPU shader、真實瀏覽器或 PNG 像素測試。
- 疊在 V5.4 PR #12；未改正式 main、未新增 Supabase schema。實機驗收需含 iOS Safari / Android Chrome / Desktop、雙耳不同色、單耳切換、回正、WebGL context loss、分享 PNG、原有 2D 與 STUDIO 單耳、連續開關及 QDM iframe。前序 PR #9–#12 仍須依序驗收整合。
- 後續 V5.6–V5.8 尚待開發；V5.2.1～V5.2.3 暫緩。
