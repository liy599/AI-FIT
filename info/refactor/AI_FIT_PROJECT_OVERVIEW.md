# AI-FIT 椤圭洰鍏ㄥ眬鐞嗚В锛堢敤浜庨噸鏋?鏂板璇濆揩閫熶笂鎵嬶級

鏈枃鐢ㄤ簬鍦ㄥ紑鍚柊瀵硅瘽鏃跺揩閫熸仮澶嶄笂涓嬫枃锛氶」鐩仛浠€涔堛€佸墠鍚庣鑱岃矗杈圭晫銆佸叧閿暟鎹祦涓庢墿灞曠偣銆傚唴瀹逛互鈥滆兘瀹氫綅銆佽兘澶嶇幇銆佽兘缁х画鎺ㄨ繘閲嶆瀯鈥濅负鐩爣锛屼笉杩芥眰瀹炵幇缁嗚妭銆?

---

## 1. 椤圭洰鐩爣涓庢牳蹇冩ā鍧?

AI-FIT 鏄竴涓仴韬?楗缁撳悎鐨?Web 搴旂敤锛屾牳蹇冭兘鍔涗富瑕佸垎涓猴細

- 璐﹀彿涓庣敤鎴疯祫鏂欙細鐧诲綍娉ㄥ唽銆丳rofile锛堟€у埆/韬珮/浣撻噸/鐩爣绛夛級
- Food 妯″潡锛氶鐗╁簱銆佽瘑鍒?鍖归厤銆侀娆¤褰曘€佸綋澶╂憚鍏ユ眹鎬?
- Pose 妯″潡锛氭祻瑙堝櫒绔Э鎬佽瘑鍒€佸姩浣滆娆′笌绾犻敊銆佽缁冭褰曚笌鎶ュ憡
- 鍐呭/杩愯惀锛氬崥瀹€佽瘎璁恒€佸弽棣堢瓑锛堜粠 routes 鍙锛?

---

## 2. 鎶€鏈爤涓庡伐绋嬪舰鎬?

### 2.1 Frontend

- 浣嶇疆锛歚frontend/`
- 褰㈡€侊細React + TypeScript + Vite锛堝瓨鍦?vite.config.ts銆乼sconfig銆乵ain.tsx/App.tsx锛?
- 闈欐€佽祫婧愶細`frontend/public/assets/`锛堝寘鍚?UI 闈欐€佽祫婧愪笌 MoveNet 妯″瀷鏂囦欢锛?
- Pose 鎺ㄧ悊锛氭祻瑙堝櫒绔墽琛岋紙TFJS MoveNet锛汳ediaPipe tasks-vision 浠ｇ爜瀛樺湪浣嗕笉鏄粯璁や富閾捐矾锛?

### 2.2 Backend

- 浣嶇疆锛歚backend/`
- 褰㈡€侊細Python Web API锛堝瓨鍦?routes銆乻ervices銆乵odels銆乼ests锛屽父瑙佷簬 Flask/FastAPI 椋庢牸锛涘叿浣撴鏋朵互 backend/app/__init__.py 涓?run.py 涓哄噯锛?
- 涓昏鑱岃矗锛?
  - 鐢ㄦ埛/閴存潈/鏉冮檺/闅愮绛栫暐
  - Food/Meals 鏁版嵁璇诲啓涓庡綋澶╂眹鎬?
  - Pose 璁粌璁板綍鐨勫瓨鍌ㄣ€佹姤鍛婄粨鏋勬牎楠屻€侊紙鍙€夛級AI 澧炲己鎶ュ憡

---

## 3. 鐩綍涓庡叧閿叆鍙ｏ紙鐞嗚В鐢級

### 3.1 Backend 鍏抽敭鍖哄煙

- 璺敱鑱氬悎锛歚backend/app/routes/`
  - Food/Meals锛歚food.py`銆乣foods.py`銆乣meals.py`
  - Pose锛歚pose.py`
  - Auth/User锛歚auth.py`銆乣user.py`
- 涓氬姟鏈嶅姟锛歚backend/app/services/`
  - Food 绉嶅瓙鏁版嵁涓庤繍琛屾椂琛ラ綈锛歚services/food/catalog_runtime.py`銆乣seed_foods.json`
  - Pose AI 鎶ュ憡缁撴瀯鏍￠獙锛歚services/pose/ai_report.py`
- 娴嬭瘯锛歚backend/tests/`锛堟湁 pose/ai_report 绛夋祴璇曪紝渚夸簬鍥炲綊锛?

### 3.2 Frontend 鍏抽敭鍖哄煙

- 椤甸潰锛歚frontend/src/pages/`
  - Pose 鐩稿叧锛歚PoseSelectPage.tsx`銆乣PoseToolPage.tsx`銆乣PoseTrainingHistoryPage.tsx`銆乣PoseTrainingReportPage.tsx`
- Pose 涓氬姟搴擄細`frontend/src/lib/pose/`
  - 瀹炴椂 provider锛歚livePoseProvider.ts`
  - MoveNet 鎺ㄧ悊/绂荤嚎鎶藉抚锛歚movenetPose.ts`
  - 杩借釜绋冲畾鍖栵細`movenetTracker.ts`銆乣distanceTracker.ts`
  - 缁樺埗锛歚draw.ts`
  - 閫氱敤鎸囨爣锛歚poseFrame.ts`銆乣poseMetrics.ts`銆乣poseMetricTracker.ts`銆乣genericMotion.ts`
  - 鍔ㄤ綔 analyzers锛歚realtime*.ts`
- Pose 椤甸潰 helper/鎶ュ憡锛歚frontend/src/pages/poseTool/poseToolHelpers.ts` 涓?`frontend/src/pages/poseTool/helpers/*`

---

## 4. Pose锛氱幇鏈夊叏娴佺▼锛堥珮灞傛娊璞★級

### 4.1 瀹炴椂锛圠ive锛夐摼璺?

1) 鎽勫儚澶撮噰闆嗭紙鍓嶇椤甸潰锛?
- Pose 宸ュ叿椤佃姹傛憚鍍忓ご娴侊紝杩涘叆 RAF 寰幆骞舵寜鐩爣 FPS 鑺傛祦銆?

2) 濮挎€佹帹鐞嗭紙妯″瀷灞傦級
- 褰撳墠瀹炴椂鎺ㄧ悊榛樿浣跨敤 MoveNet锛圱FJS pose-detection锛夈€?
- 杈撳嚭鍖呭惈锛?
  - 鍘熺敓 MoveNet 17 鐐癸紙x/y/score/name锛?
  - 涓哄吋瀹瑰巻鍙叉帴鍙ｈ€岀敓鎴愮殑鈥滅被 MediaPipe 33 鐐规暟缁勨€濓紙鍙槧灏勯儴鍒嗙偣锛屽叾瀹冧负缂哄け/鍚堟垚锛?

3) 绋冲畾鍖栦笌璐ㄩ噺闂ㄦ帶锛堝伐绋嬪眰锛?
- 浣跨敤绋冲畾鍣?璺熻釜鐘舵€侊紙calibrating/tracking/lost锛変笌璺濈鎻愮ず锛坱oo close/too far锛夛紝闄嶄綆璇姤涓庢彁绀烘姈鍔ㄣ€?

4) 鍔ㄤ綔鍒嗘瀽锛堣鍒?鐘舵€佹満锛?
- 姣忎釜鍔ㄤ綔瀵瑰簲涓€涓?Realtime Analyzer锛堣鍒?+ 鐘舵€佹満锛夛紝杈撳嚭锛?
  - repCount銆乧orrect/incorrect銆亀arnings/issues銆乴astRepReasonCodes/Corrections 绛?
- 椤甸潰浣跨敤 analyzer 杈撳嚭鐢熸垚瀹炴椂鎻愮ず銆佽娆?UI銆侀棶棰樼粺璁′笌 session 鎬荤粨銆?

5) 鎶ュ憡涓庡瓨妗?
- 缁撴潫鏃舵眹鎬绘姤鍛婄粨鏋勫苟鎻愪氦缁欏悗绔繚瀛橈紙鍚庣涓嶅弬涓庨€愬抚濮挎€佹帹鐞嗭級銆?

### 4.2 绂荤嚎锛圴ideo锛夐摼璺?

1) 瑙嗛杈撳叆
- 鐢ㄦ埛涓婁紶/閫夋嫨瑙嗛锛堝墠绔湰鍦板鐞嗕负涓伙級銆?

2) 鎶藉抚 + 濮挎€佹帹鐞?
- 褰撳墠榛樿绂荤嚎涔熻蛋 MoveNet锛氭寜绛栫暐鎶藉抚骞朵及璁″Э鎬併€?
- 鎶藉抚浜х墿閫氬父鍚屾椂鍖呭惈锛?
  - frames锛氱敤浜庡巻鍙查€昏緫鐨?landmarks锛堝綋鍓嶅涓衡€滀吉 33 鐐规暟缁勨€濓級
  - nativeFrames锛歁oveNet 17 鐐瑰簭鍒楋紙鍙敤浜庡悗缁?17-only 杩佺Щ锛?

3) 鍥炴斁寮忓垎鏋愶紙澶嶇敤瀹炴椂 analyzer锛?
- 瀵规娊甯у簭鍒楅€愬抚鍥炴斁锛屽杺缁欏悓涓€濂?Realtime Analyzer锛屽緱鍒板拰瀹炴椂涓€鑷寸殑璁℃/绾犻敊杈撳嚭銆?
- 鍚屾椂鐢熸垚绂荤嚎 overlay锛堟瘡甯?tone/message锛変笌瑙嗛鎶ュ憡銆?

---

## 5. Pose锛氭墿灞曠偣锛堝姞鍔ㄤ綔/鏀硅鍒欑殑鍦版柟锛?

### 5.1 鏂板鍔ㄤ綔鐨勪竴鑸矾寰?

1) 鍔ㄤ綔鍏冩暟鎹笌涓婃灦
- `frontend/src/lib/pose/exercises.ts`锛氬姩浣?slug銆佸睍绀哄悕銆佹彁绀烘枃妗堢瓑

2) Analyzer 瀹炵幇
- `frontend/src/lib/pose/realtime<Exercise>.ts`锛氳鍒?鐘舵€佹満瀹炵幇

3) 鎺ュ叆鍒涘缓鍣ㄤ笌鎶ュ憡
- `frontend/src/pages/poseTool/poseToolHelpers.ts`锛歚createAnalyzer(slug)`銆乻uggestion 鏄犲皠銆乺eport builder

4) 椤甸潰灞曠ず
- `PoseSelectPage` 涓婃灦涓庡睍绀猴紙宸叉敮鎸佽繃婊?ready/coming_soon锛?
- `PoseToolPage` 瀹炴椂/绂荤嚎鍒嗘敮锛堥€氬父鏃犻渶鏂板澶ч噺 UI 閫昏緫锛?

### 5.2 褰撳墠 Pose 閲嶆瀯鐒︾偣锛?7-only锛?

椤圭洰鐩墠鍚屾椂瀛樺湪锛?
- 鈥?3 绱㈠紩璇箟鈥濈殑 analyzer/鎸囨爣宸ュ叿锛堝ぇ閲?`landmarks[idx]`锛?
- 鈥?7 鐐规寜 name鈥濈殑 analyzer锛堝凡鏈?analyzeNative 涓?MoveNetKeypoint锛?

涓轰簡闄嶄綆鍙ｅ緞娣蜂贡涓庝吉 33 鐨勯闄╋紝璁″垝鏂瑰悜鏄細
- analyzer 缁熶竴浠?MoveNet 17 鐐癸紙鎸?name锛変綔涓鸿緭鍏ヨ涔?
- 绂荤嚎鍥炴斁鍙緷璧?17 鐐瑰簭鍒楋紙nativeFrames锛?
- 鍚屾缁熶竴 issues.joints 鐨勮涔夛紙閬垮厤缁х画浣跨敤 MediaPipe 33 绱㈠紩锛?
- 浠ｇ爜鍛藉悕閬垮厤鍑虹幇 鈥滃姩浣滃悕+鏁板瓧鈥?鍚庣紑锛屾棫瀹炵幇杩佺Щ鍒?legacy/classic 鍛藉悕

瀵瑰簲鎵ц娓呭崟瑙侊細
- `info/refactor/POSE_17POINT_ANALYZER_MIGRATION_CHECKLIST.md`

---

## 6. Food锛氬叧閿簨瀹烇紙楂樺眰锛?

- 鍚庣椋熺墿搴撳瓨鍦ㄢ€滅瀛愭暟鎹?+ 杩愯鏃惰ˉ榻愨€濇満鍒讹細
  - 绉嶅瓙 JSON锛歚backend/app/services/food/seed_foods.json`
  - 鍚姩鏃惰ˉ榻愶細鐢?catalog_runtime 璇诲彇 JSON 骞跺悜 foods 琛ㄨˉ缂?
- 褰撳ぉ姹囨€绘帴鍙ｅ綋鍓嶄富瑕佽繑鍥炩€滄憚鍏?totals鈥濓紝涓嶅寘鍚惀鍏荤洰鏍?杩涘害鏉＄洰鏍囨暟鎹紙濡傞渶鐩爣锛岄渶瑕佹墿灞?profile/鎺ュ彛鍙ｅ緞锛夈€?

---

## 7. 鏂板璇濆揩閫熷惎鍔ㄥ缓璁紙鎬庝箞鎻愰棶鏈€鐪佹椂闂达級

- 鑻ヨ鎺ㄨ繘鈥?7-only analyzer 閲嶆瀯鈥濓細
  - 鍏堣鍔╂墜璇诲彇 `info/refactor/POSE_17POINT_ANALYZER_MIGRATION_CHECKLIST.md`
  - 鍐嶆寜鈥滃姩浣滀紭鍏堢骇鈥濋€愪釜杩佺Щ锛屽苟鍦ㄦ瘡涓€姝ュ仛绂荤嚎鍥炴斁瑙嗛鐨勫洖褰掑姣?
- 鑻ヨ鏂板鍔ㄤ綔锛?
  - 璇存槑鍔ㄤ綔 slug銆佹湡鏈涜瑙掞紙渚ц/姝ｈ锛夈€佽娆¤鍒欙紙鍏抽敭瑙掑害/闃堝€硷級銆佺籂閿欑偣鍒楄〃锛堣杈撳嚭鍝簺鎻愮ず锛?


