# Pose Migration Log

## 2026-04-05 Step 8

鐩爣锛?- 琛ヨ涓婁竴娆℃湭鍐欏叆鏃ュ織鐨勫疄鏃堕〉瀵归綈鏀瑰姩
- 淇 `Coaching Tip` 鍦ㄦ湭鍚姩鎽勫儚澶存椂浠嶆樉绀轰腑鏂囩殑闂

鏈瀹屾垚锛?- 琛ヨ涓婁竴杞疄鏃堕〉瀵归綈椤癸細
  - 瀹炴椂宸ュ叿鏍忚ˉ鍏?`Mirror`
  - 瀹炴椂宸ュ叿鏍忚ˉ鍏?`Size`
  - 瀹炴椂鐢婚潰鏀逛负鎸夊鍣ㄥ～鍏?  - 鏂板 `Range Check`
  - 璋冩暣 `Range Check` 鍒?`Coaching Tip` 涔嬪墠
- 淇瀹炴椂椤甸粯璁ゅ缓璁枃妗?  - 鏈惎鍔ㄦ憚鍍忓ご鏃讹紝`Coaching Tip` 榛樿鏂囨鏀逛负鑻辨枃
  - 淇濆瓨璁粌璁板綍鏃跺啓鍏ョ殑鎻愮ず鏂囨涔熷悓姝ユ敼涓鸿嫳鏂囩増鏈?
鏈楠岃瘉锛?- 宸叉墽琛岋細`frontend` 涓嬬殑 `npm.cmd run typecheck`
  - 閫氳繃

## 2026-04-05 Step 9

鐩爣锛?- 鎺掓煡璁粌璁板綍淇濆瓨钀界偣
- 淇 `Export PDF` 鎵撳紑绌虹櫧椤电殑闂
- 鎻愰珮妯睆 / 绔栧睆鍒囨崲鐨勫彲鎰熺煡搴?
鏈瀹屾垚锛?- 纭瀹炴椂璁粌璁板綍淇濆瓨璺緞
  - 鍓嶇閫氳繃 `POST /api/pose/trainings` 鎻愪氦
  - 鍚庣鍐欏叆 `training_sessions` 涓?`training_sets`
  - 浼氳瘽绾ф姤鍛婂啓鍏?`training_sessions.report_json`
- 璋冩暣娴忚鍣ㄦ墦鍗伴〉鎵撳紑鏂瑰紡
  - 浠庣洿鎺?`document.write + 寰堢煭寤舵椂 print`
  - 鏀逛负鍩轰簬 `Blob URL` 鎵撳紑鐙珛鎵撳嵃椤碉紝骞跺湪椤甸潰 `load` 鍚庡啀瑙﹀彂鎵撳嵃
  - 鐩殑鏄伩鍏嶆柊绐楀彛灏氭湭瀹屾垚娓叉煋鏃跺嚭鐜扮┖鐧介〉
- 璋冩暣瀹炴椂鎽勫儚澶存í绔栧睆瀹瑰櫒姣斾緥
  - 妯睆鏀逛负鏇存槑纭殑 `16:9`
  - 绔栧睆鏀逛负鏇存槑纭殑 `9:16`
  - 鍚屾椂鍒嗗埆璁剧疆涓嶅悓鐨勬渶灏?/ 鏈€澶ч珮搴︼紝浣垮垏鎹㈡晥鏋滄洿鏄庢樉

鏈楠岃瘉锛?- 宸叉墽琛岋細`frontend` 涓嬬殑 `npm.cmd run typecheck`
  - 閫氳繃

## 2026-04-05 Step 10

鐩爣锛?- 淇 `Size` 鎸夐挳瀵艰嚧瀹炴椂棰勮鍖鸿繃绐勩€佽鎰熼毦鐪嬬殑闂

鏈瀹屾垚锛?- 璋冩暣瀹炴椂棰勮鍖哄昂瀵哥瓥鐣?  - 涓嶅啀鎶?`S / M / L` 鐩存帴鏄犲皠涓鸿繃灏忕殑鍥哄畾鍍忕礌瀹藉害
  - 鏀逛负鐩稿娓╁拰鐨勭櫨鍒嗘瘮妗ｄ綅
    - `S` -> `78%`
    - `M` -> `86%`
    - `L` -> `93%`
    - `XL` -> `100%`
- 璋冩暣瀹炴椂棰勮鍖哄竷灞€
  - 棰勮瀹瑰櫒鏀逛负鍦ㄥ崱鐗囧唴姘村钩灞呬腑
  - 閬垮厤鍒囧埌灏忓昂瀵稿悗棰勮璐村乏銆佸彸渚х暀鍑哄ぇ鍧楃┖鐧介€犳垚鐗堥潰澶辫　

鏈楠岃瘉锛?- 宸叉墽琛岋細`frontend` 涓嬬殑 `npm.cmd run typecheck`
  - 閫氳繃

## 2026-04-05 Step 1

鐩爣锛?
- 寤虹珛杩佺Щ鏃ュ織
- 寮€濮嬬涓€闃舵杩佺Щ锛氫富椤圭洰鍓嶇 `PosePage` 瀹炴椂绾犻敊棣栫増
- 鏈鍙鐞嗗墠绔疄鏃跺姛鑳斤紝涓嶅鐞嗗悗绔ā鍨嬨€佹帴鍙ｅ拰绂荤嚎瑙嗛鍒嗘瀽

鏈鑼冨洿锛?
- 鍦?`frontend/` 杩佸叆瀹炴椂濮挎€佸垎鏋愭墍闇€鐨勫墠绔伐鍏蜂唬鐮?- 淇濇寔涓婚」鐩幇鏈夐〉闈㈤鏍煎熀纭€锛岄噸鏋?`PosePage`
- 鏀寔鎽勫儚澶村疄鏃舵娴嬨€侀鏋跺彔鍔犮€佽搴︽彁绀恒€佺籂閿欏缓璁€佹湰鍦?JSON/PDF 瀵煎嚭

娑夊強鏂囦欢锛?
- `frontend/package.json`
- `frontend/src/pages/PosePage.tsx`
- `frontend/src/styles.css`
- `frontend/src/lib/pose/*`
- `frontend/src/lib/report/*`

璇存槑锛?
- 鏈涓嶄慨鏀瑰悗绔?- 鏈涓嶆柊澧炴暟鎹簱琛?- 鏈涓嶆墦閫氱绾胯棰戝垎鏋?- 鏈涓嶆墽琛屼緷璧栧畨瑁咃紱濡傝鏈湴杩愯锛岄渶瑕佸湪 `frontend/` 涓嬪畨瑁呮柊澧炰緷璧?
瀹為檯瀹屾垚锛?
- 鏂板 `frontend/src/lib/pose/` 涓嬬殑瀹炴椂濮挎€佸伐鍏锋枃浠?- 鏂板 `frontend/src/lib/report/` 涓嬬殑鏈湴鎶ュ憡瀵煎嚭宸ュ叿鏂囦欢
- 鏂板 `frontend/src/pages/PoseRealtimePage.tsx` 浣滀负瀹炴椂绾犻敊棣栫増椤甸潰
- 淇敼 `frontend/src/App.tsx`锛屽皢 `/tools/pose` 璺敱鍒囧埌鏂伴〉闈?- 淇敼 `frontend/src/styles.css`锛岃ˉ鍏呭Э鎬侀〉灞€閮ㄦ牱寮?- 淇敼 `frontend/src/pages/PosePage.tsx`锛屽皢鍏惰浆涓哄鏂伴〉闈㈢殑鍏煎杞彂锛岄伩鍏嶆棫鏂囦欢璇硶闂褰卞搷缂栬瘧
- 淇敼 `frontend/package.json`锛屽０鏄?MoveNet / TensorFlow 鍓嶇渚濊禆

褰撳墠鏁堟灉锛?
- 宸插畬鎴愮涓€闃舵鐨勫墠绔疄鏃堕〉杩佺Щ棣栫増
- 椤甸潰椋庢牸淇濇寔涓婚」鐩幇鏈?breadcrumb銆佸崱鐗囥€佸尯鍧楀竷灞€椋庢牸
- 鍔熻兘鍖呭惈锛?  - 鎽勫儚澶村惎鍔?鍋滄
  - 瀹炴椂楠ㄦ灦鍙犲姞
  - 娣辫共娆℃暟涓庡叧閿搴﹀睍绀?  - 瀹炴椂绾犻敊寤鸿
  - 鏈湴 JSON 瀵煎嚭
  - 鏈湴 PDF 瀵煎嚭

鑷煡缁撴灉锛?
- 宸叉墽琛?`frontend` 涓嬬殑 `npm.cmd run typecheck`
- 褰撳墠澶辫触鍘熷洜涓嶆槸椤甸潰浠ｇ爜璇硶閿欒锛岃€屾槸缂哄皯鏂颁緷璧栧寘锛?  - `@tensorflow/tfjs-core`
  - `@tensorflow/tfjs-converter`
  - `@tensorflow/tfjs-backend-webgl`
  - `@tensorflow-models/pose-detection`

涓嬩竴姝ュ墠缃潯浠讹細

- 闇€瑕佸湪 `frontend/` 瀹夎鏂板渚濊禆鍚庯紝鍐嶇户缁仛杩愯楠岃瘉鍜岀粏鑺備慨姝?
## 2026-04-05 Step 1.1

鐩爣锛?
- 妫€鏌?`README.md` 涓庤嚜鍔ㄥ垵濮嬪寲鑴氭湰鏄惁闇€瑕佷负鏂板墠绔緷璧栧仛璋冩暣

缁撹锛?
- 闇€瑕佽皟鏁?
鍘熷洜锛?
- 鏃х増 `scripts/dev.ps1` 鍙湁鍦?`frontend/node_modules` 涓嶅瓨鍦ㄦ椂鎵嶄細鎵ц `npm.cmd install`
- 杩欎細瀵艰嚧浠撳簱鏂板鍓嶇渚濊禆鍚庯紝宸叉湁寮€鍙戠幆澧冧笉浼氳嚜鍔ㄨˉ瑁呮柊鍖?- 鏈鏂板鐨勫Э鎬佽瘑鍒緷璧栧氨浼氳Е鍙戣繖涓棶棰?
宸插畬鎴愪慨鏀癸細

- 淇敼 `scripts/dev.ps1`
  - 鐜板湪姣忔鍚姩閮戒細鎵ц涓€娆?`frontend` 涓嬬殑 `npm.cmd install`
  - 杩欐牱鍙互淇濊瘉鏂板渚濊禆浼氳鑷姩琛ヨ

寰呭悓姝ヨ鏄庯細

- `README.md` 闇€瑕佽ˉ涓€鍙ワ細褰撳墠绔柊澧炰緷璧栨椂锛岄噸鏂版墽琛?`npm.cmd install` 鎴栫洿鎺ヨ繍琛?`scripts/dev.ps1`

## 2026-04-05 Step 2

鐩爣锛?
- 瀹夎骞堕獙璇佸墠绔柊澧炰緷璧?- 纭瀹炴椂椤靛湪褰撳墠浠ｇ爜鐘舵€佷笅鍙€氳繃绫诲瀷妫€鏌ヤ笌鐢熶骇鏋勫缓

鎵ц杩囩▼锛?
- 棣栨鍦ㄦ矙绠卞唴鎵ц `npm.cmd install` 澶辫触
  - 鍘熷洜锛歯pm 鍛戒腑 `only-if-cached` 缂撳瓨闄愬埗锛屾棤娉曡仈缃戞媺鍙栨柊鍖?- 闅忓悗浣跨敤鏀惧紑闄愬埗鏂瑰紡鎵ц `npm.cmd install`
  - 鎴愬姛瀹夎鏂板鍓嶇渚濊禆
  - `frontend/package-lock.json` 宸叉洿鏂?- 鎵ц `npm.cmd run typecheck`
  - 閫氳繃
- 棣栨鎵ц `npm.cmd run build`
  - 鍦ㄦ矙绠卞唴鍥?`esbuild` 瀛愯繘绋嬪惎鍔ㄥ彈闄愬け璐?- 闅忓悗浣跨敤鏀惧紑闄愬埗鏂瑰紡鎵ц `npm.cmd run build`
  - 鎴愬姛

鏈缁撹锛?
- 瀹炴椂椤靛綋鍓嶄唬鐮佸凡缁忛€氳繃鍓嶇绫诲瀷妫€鏌?- 瀹炴椂椤靛綋鍓嶄唬鐮佸凡缁忛€氳繃鍓嶇鐢熶骇鏋勫缓
- 鍓嶇渚濊禆閾惧凡缁忚ˉ榻愶紝鍚庣画鍙互缁х画杩涘叆鍚庣鏈€灏忔ā鍨嬩笌鎺ュ彛姝ラ

褰撳墠宸茬‘璁ょ殑闄勫姞浜嬮」锛?
- 鏋勫缓杈撳嚭鍑虹幇澶?chunk 璀﹀憡
  - `pose-detection` 涓?TensorFlow 鐩稿叧鍖呮樉钁楀澶у墠绔骇鐗╀綋绉?  - 杩欎笉鏄樆濉為棶棰橈紝浣嗗悗缁缓璁仛鎸夎矾鐢辨垨鎸夊姛鑳藉姩鎬佸姞杞?
鍚庣画寤鸿锛?
- 涓嬩竴姝ヨ繘鍏ュ悗绔渶灏忔暟鎹ā鍨嬩笌鎺ュ彛
- 鍚庣画鍦ㄥ墠绔啀琛ヤ竴杞紭鍖栵細
  - 瀹炴椂椤垫噿鍔犺浇 MoveNet/TensorFlow
  - 闄嶄綆棣栧睆 bundle 浣撶Н

## 2026-04-05 Step 3

鐩爣锛?
- 鍦?Flask 鍚庣琛ラ綈 pose 鐩稿叧鏈€灏忔暟鎹ā鍨嬩笌鎺ュ彛
- 鎵撻€氬悗绔渶灏忛棴鐜紝涓哄悗缁绾胯棰戝垎鏋愪笌瀹炴椂璁粌淇濆瓨鍋氬噯澶?
鏈宸插畬鎴愭ā鍨嬶細

- `video_assets`
- `analysis_tasks`
- `analysis_results`
- `training_sessions`
- `training_sets`

娑夊強鏂囦欢锛?
- `backend/app/models.py`
- `backend/app/routes/pose.py`
- `backend/app/__init__.py`

鏈宸插畬鎴愭帴鍙ｏ細

- `GET /api/pose/videos`
- `POST /api/pose/videos`
- `GET /api/pose/videos/<id>/file`
- `POST /api/pose/analysis/tasks`
- `GET /api/pose/analysis/tasks/<id>`
- `POST /api/pose/analysis/tasks/<id>/complete`
- `POST /api/pose/analysis/tasks/<id>/fail`
- `POST /api/pose/trainings`

鏈鍚屾椂瀹屾垚锛?
- 娉ㄥ唽鏂拌摑鍥?`/api/pose`
- 灏嗗叏灞€涓婁紶澶у皬涓婇檺浠?`5MB` 鎻愰珮鍒?`80MB`
- 灏?413 閿欒鎻愮ず鍚屾鏇存柊涓?`max 80MB`

瀹炵幇鍙栬垗锛?
- 瑙嗛鍏堝瓨鏈湴纾佺洏
- 瑙嗛璁块棶鍏堜娇鐢?`send_file(..., conditional=True)`锛屾敮鎸佸熀纭€ Range/鏉′欢鍝嶅簲鑳藉姏
- 鍒嗘瀽缁撴灉鍏堢洿鎺ュ瓨 JSON
- 涓嶅紩鍏?worker锛屼笉鍋氬悗绔帹鐞?
楠岃瘉缁撴灉锛?
- 宸查獙璇?Flask 搴旂敤鍙甯稿鍏ュ苟鍒涘缓
- 宸查獙璇佹柊璺敱鎴愬姛娉ㄥ唽
- 宸叉墽琛岀幇鏈夎璇佹祴璇曪細
  - `backend/.venv/Scripts/python.exe -m pytest tests/test_auth.py -q`
  - 缁撴灉锛歚2 passed`

褰撳墠鐘舵€侊細

- 鍓嶇瀹炴椂椤靛凡鍙瀯寤?- 鍚庣鏈€灏忔暟鎹ā鍨嬩笌鏍稿績鎺ュ彛宸茶惤鍦?- 涓嬩竴姝ュ彲浠ュ紑濮嬫妸鍓嶇绂荤嚎瑙嗛鍒嗘瀽鎺ュ埌杩欎簺鏂版帴鍙ｄ笂

褰撳墠鏈鐩栵細

- 灏氭湭涓?`pose.py` 鏂板涓撻棬鐨?API 娴嬭瘯
- 灏氭湭浠庡墠绔疄闄呬覆鑱斺€滀笂浼犺棰?-> 鍒涘缓浠诲姟 -> 鏈湴鍒嗘瀽 -> 鍥炲啓缁撴灉鈥?- 灏氭湭鎶婂疄鏃堕〉鐨勨€滀繚瀛樿缁冭褰曗€濇寜閽帴鍒?`/api/pose/trainings`
## 2026-04-05 Step 4

鐩爣锛?- 缁х画鎵挎帴 Step 3 鐨勫墠绔覆鑱?- 鎶婂Э鎬侀〉鏀规垚鈥滃疄鏃剁籂閿?/ 绂荤嚎瑙嗛鍒嗘瀽鈥濆弻妯″紡鍏ュ彛
- 鎺ラ€氣€滆棰戜笂浼?-> 鍒涘缓浠诲姟 -> 娴忚鍣ㄤ晶鍒嗘瀽 -> 鍥炲啓缁撴灉鈥?- 鎶婂疄鏃堕〉鈥滀繚瀛樿缁冭褰曗€濇寜閽帴鍒?`/api/pose/trainings`

鏈瀹屾垚锛?- 鏂板 `frontend/src/lib/poseApi.ts`
  - 鍩轰簬鐜版湁 `api.ts` 琛ヤ簡 pose 鐩稿叧鍓嶇灏佽
  - 鍖呭惈瑙嗛涓婁紶銆佷换鍔″垱寤恒€佷换鍔″畬鎴?澶辫触鍥炲啓銆佽缁冭褰曚繚瀛樸€佽棰戞枃浠?blob 鎷夊彇
- 鎵╁睍 `frontend/src/lib/api.ts`
  - 鏂板 `apiFetchBlob()`
  - 瑙ｅ喅绂荤嚎鍒嗘瀽鍦烘櫙涓?HTMLVideoElement 涓嶈兘鐩存帴甯?`Authorization` 澶寸殑闂
- 鍦?`frontend/src/lib/pose/` 琛ラ綈绂荤嚎鍒嗘瀽鎵€闇€鑳藉姏灞?  - `mediapipePose.ts`
  - `poseMetrics.ts`
  - `poseFrame.ts`
  - `poseMetricTracker.ts`
  - `motionCompare.ts`
  - `motionStandards.ts`
  - `analysisSelector.ts`
  - `genericMotion.ts`
  - `report.ts`
  - `motionStandardCompareReport.ts`
- 鏂板 `frontend/src/pages/PoseToolPage.tsx`
  - 浣滀负褰撳墠濮挎€佸伐鍏锋寮忛〉闈?  - 淇濇寔涓荤珯 breadcrumb / 鍗＄墖 / 宸ュ叿椤靛竷灞€椋庢牸
  - 椤靛唴鍒囨崲涓ょ妯″紡锛?    - 瀹炴椂绾犻敊
    - 绂荤嚎瑙嗛鍒嗘瀽
- 瀹炴椂妯″紡鏂板锛?  - 鈥滀繚瀛樿缁冭褰曗€濇寜閽?  - 璋冪敤 `/api/pose/trainings`
  - 浣跨敤褰撳墠瀹炴椂缁熻缁撴灉鐢熸垚鍗曟潯 `sets` 骞惰繛鍚?report 涓€璧蜂繚瀛?  - 鏈櫥褰?/ 鏃犳湁鏁?reps 鏃剁粰鍑哄墠绔彁绀?- 绂荤嚎妯″紡鎵撻€氾細
  - 閫夋嫨瑙嗛鏂囦欢
  - 閫夋嫨瑙嗚
  - 杈撳叆鍒嗘瀽璇存槑
  - 涓婁紶瑙嗛鍒?`/api/pose/videos`
  - 鍒涘缓浠诲姟鍒?`/api/pose/analysis/tasks`
  - 浠?blob URL 鏂瑰紡鍔犺浇鍙椾繚鎶よ棰戞枃浠?  - 娴忚鍣ㄤ晶杩愯 MediaPipe 鎶藉抚鎻愬彇
  - 鏍规嵁瑙嗚閫夋嫨鏍囧噯妯℃澘鎴栭€氱敤鍒嗘瀽
  - 鎴愬姛鍚庤皟鐢?`/api/pose/analysis/tasks/<id>/complete`
  - 澶辫触鏃惰皟鐢?`/api/pose/analysis/tasks/<id>/fail`
  - 椤甸潰鍐呭睍绀轰换鍔″揩鐓с€佽繘搴︺€佹憳瑕併€佹寚鏍囥€侀棶棰樸€佸缓璁拰鏃堕棿绾?  - 鏀寔绂荤嚎鎶ュ憡 JSON / PDF 瀵煎嚭
- 鏇存柊璺敱锛?  - `/tools/pose` 鐜板湪鎸囧悜 `PoseToolPage`
  - `PosePage.tsx` 鍚屾杞彂鍒版柊椤甸潰锛屽吋瀹规棫寮曠敤
- 鏇存柊鏍峰紡锛?  - 鍦?`frontend/src/styles.css` 澧炶ˉ鍙屾ā寮忓垏鎹€佽〃鍗曘€佽繘搴﹀崱銆佹姤鍛婂睍绀虹瓑灞€閮ㄦ牱寮?- 鏇存柊鍓嶇渚濊禆锛?  - `frontend/package.json`
  - 鏂板 `@mediapipe/tasks-vision`
  - `frontend/package-lock.json` 宸插悓姝ユ洿鏂?
鏈楠岃瘉锛?- 宸叉墽琛?`frontend` 涓嬬殑 `npm.cmd install`
  - 琛ラ綈 `@mediapipe/tasks-vision`
- 宸叉墽琛?`npm.cmd run typecheck`
  - 閫氳繃
- 宸叉墽琛?`npm.cmd run build`
  - 閫氳繃
  - 浠嶆湁澶?chunk 璀﹀憡锛屼富瑕佹潵鑷?TensorFlow / MediaPipe / pose-detection 鐩稿叧渚濊禆

褰撳墠鐘舵€侊細
- 濮挎€侀〉鍓嶇宸插畬鎴愪袱鏉￠棴鐜?  - 瀹炴椂绾犻敊 -> 淇濆瓨璁粌璁板綍
  - 绂荤嚎涓婁紶 -> 鍒嗘瀽 -> 鍥炲啓
- 褰撳墠鍙互杩涘叆涓嬩竴姝ョ粏鍖?  - 鐪熷疄鎺ュ彛鑱旇皟涓庢墜宸ュ啋鐑?  - 鍚庣 pose API 涓撻」娴嬭瘯
  - 鍓嶇鎸夎矾鐢辨垨鎸夋ā寮忚繘涓€姝ュ仛鍔ㄦ€佹媶鍖咃紝闄嶄綆棣栧睆 bundle 浣撶Н

## 2026-04-05 Step 5

鐩爣锛?- 琛ラ綈鍚庣 `pose` 鏂版帴鍙ｇ殑涓撻」娴嬭瘯
- 楠岃瘉杩欐鏂板鐨勬暟鎹祦闂幆鍦?Flask 渚хǔ瀹氬彲鐢?
鏈瀹屾垚锛?- 鏂板 `backend/tests/test_pose.py`
- 瑕嗙洊鎺ュ彛锛?  - `POST /api/pose/videos`
  - `GET /api/pose/videos`
  - `GET /api/pose/videos/<id>/file`
  - `POST /api/pose/analysis/tasks`
  - `POST /api/pose/analysis/tasks/<id>/complete`
  - `GET /api/pose/analysis/tasks/<id>`
  - `POST /api/pose/analysis/tasks/<id>/fail`
  - `POST /api/pose/trainings`
- 瑕嗙洊鍦烘櫙锛?  - 瑙嗛涓婁紶銆佸垪琛ㄦ煡璇€佹枃浠惰鍙?  - 鍒嗘瀽浠诲姟鍒涘缓涓庢垚鍔熷洖鍐?  - 鍒嗘瀽浠诲姟澶辫触鍥炲啓
  - 瀹炴椂璁粌璁板綍淇濆瓨

鏈楠岃瘉锛?- 宸叉墽琛岋細
  - `backend/.venv/Scripts/python.exe -m pytest tests/test_pose.py -q`
- 缁撴灉锛?  - `4 passed`

褰撳墠鐘舵€侊細
- 鍓嶇瀹炴椂涓庣绾夸覆鑱斾唬鐮佸凡钀藉湴
- 鍚庣 pose 鏂版帴鍙ｅ凡鏈変笓椤规祴璇曡鐩?- 涓嬩竴姝ユ洿閫傚悎杩涘叆锛?  - 娴忚鍣ㄧ鐪熷疄鑱旇皟鍜屽啋鐑?  - 鍓嶇棣栧睆/妯″瀷鍖呬綋绉紭鍖?
## 2026-04-05 Step 6

鐩爣锛?- 浼樺寲瀹炴椂鎽勫儚澶撮瑙堢殑妗岄潰绔綋楠?- 淇棰勮妗嗚繃楂樸€佷汉鐗╂樉绀鸿繃杩戠殑闂
- 淇瀹炴椂椤靛眬閮ㄧ櫧搴曠櫧瀛楀彲璇绘€ч棶棰?
鏈瀹屾垚锛?- 璋冩暣瀹炴椂鎽勫儚澶磋姹傚弬鏁?  - 浠庡亸绔栧睆鐨?`720x1280` 璋冩暣涓烘洿閫傚悎妗岄潰鎽勫儚澶寸殑 `1280x720`
- 璋冩暣瀹炴椂棰勮瀹瑰櫒
  - 灏嗛瑙堝尯浠庢洿闀跨殑绔栧悜姣斾緥鏀朵负鏇撮€傚悎妗岄潰棰勮鐨?`4:3`
  - 鍚屾椂涓嬭皟鏈€灏忛珮搴︼紝閬垮厤宸ュ叿椤靛乏渚ч瑙堟杩囬暱
- 鏂板瀹炴椂棰勮妯珫灞忓垏鎹?  - 鏀寔鍦ㄥ疄鏃舵憚鍍忓ご鍖哄煙鎵嬪姩鍒囨崲鈥滄í灞?/ 绔栧睆鈥?  - 閫氳繃涓嶅悓棰勮姣斾緥閫傞厤涓嶅悓绔欎綅鍜屾媿鎽勭┖闂?- 鏂板瀹炴椂棰勮缂╂斁鎺у埗
  - 鍦ㄥ疄鏃舵憚鍍忓ご鍖哄煙澧炲姞鈥滅敾闈㈢缉鏀锯€濇粦鏉?  - 鏀寔鍓嶇渚ф帶鍒剁敾闈㈣繙杩戯紝鏂逛究鐢ㄦ埛鎶婂叏韬斁杩涚敾闈?- 淇缂╂斁鎺у埗涓嶇敓鏁堥棶棰?  - 鍘熷洜鏄疄鏃舵娴嬪惊鐜棴鍖呮崟鑾蜂簡鏃х殑 `previewScale`
  - 鏀逛负浣跨敤 `previewScaleRef`锛屼繚璇佹粦鏉嗘嫋鍔ㄥ悗瀹炴椂娓叉煋绔嬪嵆鐢熸晥
- 浼樺寲瀹炴椂鐢婚潰缁樺埗绛栫暐
  - 缁х画浣跨敤 canvas 鍚堟垚棰勮
  - 浠ュ眳涓缉鏀炬柟寮忕粯鍒舵憚鍍忓ご鐢婚潰锛岃€屼笉鏄畝鍗曢摵婊¤鍒?- 淇瀹炴椂椤电櫧搴曠櫧瀛楅棶棰?  - 瀹炴椂鍗＄墖鍓爣棰樻敼涓烘繁鑹?  - 鐘舵€佽鏀逛负娴呭簳娣卞瓧
  - 瀹炴椂鍒嗘瀽鍗＄墖涓殑鍒嗗尯鏍囬鏀逛负娣辫壊

鏈楠岃瘉锛?- 宸叉墽琛?`frontend` 涓嬬殑 `npm.cmd run typecheck`
  - 閫氳繃
## 2026-04-05 Step 7

鐩爣锛?- 缁х画瀵归綈 `train` 瀹炴椂椤电殑浜や簰涓庡睍绀烘ā鍧?- 鍦ㄤ笉鏀瑰彉褰撳墠涓婚」鐩〉闈㈤鏍肩殑鍓嶆彁涓嬶紝琛ラ綈鐢ㄦ埛鐐瑰悕缂哄け椤?
鏈瀹屾垚锛?- 鍦ㄥ疄鏃舵憚鍍忓ご宸ュ叿鏍忚ˉ鍏?`Mirror` 寮€鍏?- 鍦ㄥ疄鏃舵憚鍍忓ご宸ュ叿鏍忚ˉ鍏?`Size` 鎸夐挳缁勶紙`S / M / L / XL`锛?- 璋冩暣瀹炴椂鐢婚潰缁樺埗閫昏緫
  - 浠庘€滃眳涓缉鏀剧暀杈光€濇敼涓衡€滄寜瀹瑰櫒 cover 濉厖鈥?  - 妯睆銆佺珫灞忛兘鏀逛负浼樺厛濉弧瀹炴椂鎽勫儚澶村尯鍩?  - `Mirror` 寮€鍏崇洿鎺ヤ綔鐢ㄤ簬 canvas 缁樺埗鏂瑰悜
- 琛ュ叆 `Range Check` 妯″潡
  - 灞曠ず `In range / Out of range`
  - 灞曠ず褰撳墠鑼冨洿鍒ゆ柇鍘熷洜
  - 灞曠ず鏈€杩戜竴娆″姩浣滅殑甯ф暟
- 灏?`Range Check` 鐨勫睍绀洪『搴忎笂绉诲埌鈥滅籂閿欏缓璁?/ Coaching Tip鈥濅箣鍓?- 寮€濮嬫妸濮挎€侀〉鍙鏂囨缁熶竴鏀跺彛涓鸿嫳鏂?  - 鏈疆浼樺厛澶勭悊瀹炴椂椤垫柊澧炴帶浠跺拰鏂板妯″潡
  - 鏃ュ織涓庡璇濊鏄庝粛淇濇寔涓枃

鏈楠岃瘉锛?- 宸叉墽琛岋細`frontend` 涓嬬殑 `npm.cmd run typecheck`
  - 閫氳繃
- 宸插皾璇曪細`npm.cmd run build`
  - 鍙楀綋鍓嶆湰鏈?`vite/esbuild spawn EPERM` 鐜闄愬埗锛屾湭瀹屾垚鏋勫缓
  - 褰撳墠鍙‘璁?TypeScript 绫诲瀷妫€鏌ラ€氳繃

褰撳墠鐘舵€侊細
- 瀹炴椂椤靛凡琛ラ綈鏈疆鎸囧畾鐨?4 涓噸鐐归」
- 涓嬩竴姝ユ洿閫傚悎缁х画鍋氾細
  - 鎶婂疄鏃堕〉鍓╀綑鏃ф枃妗堢户缁交搴曠粺涓€涓鸿嫳鏂?  - 缁х画鎶婂彸渚у弽棣堝尯鍚?`train` 鐨?`Session Actions / History` 缁撴瀯闈犻綈

