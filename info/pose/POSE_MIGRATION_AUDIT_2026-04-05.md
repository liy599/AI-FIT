# 濮挎€佽縼绉诲鏌ユ姤鍛?
鏃ユ湡锛?026-04-05

瀹℃煡鑼冨洿锛?
- 瀵圭収 `train/TRAIN_鍙屽姛鑳界湡瀹炶縼绉绘柟妗坃鍩轰簬褰撳墠浠撳簱.md` 瀹℃煡 pose 杩佺Щ鐩爣鏄惁鐪熸钀藉湴
- 浜ゅ弶鏍稿 `info/pose/POSE_MIGRATION_LOG.md` 涓褰曠殑杩佺Щ杩囩▼
- 妫€鏌ュ綋鍓?AI-FIT 鍓嶅悗绔疄鐜版槸鍚︿笌鏂囨。鎻忚堪涓€鑷?- 鍒ゆ柇褰撳墠鐘舵€佹槸鍚﹀凡缁忊€滅湡姝ｅ榻?train鈥濓紝鑰屼笉鍙槸鍋氫簡鏈€灏忛棴鐜?
鏈楠岃瘉锛?
- `frontend`锛歚npm.cmd run typecheck`锛岄€氳繃
- `backend`锛歚.\\.venv\\Scripts\\python.exe -m pytest tests/test_pose.py -q`锛岀粨鏋滀负 `4 passed`

## 涓€銆佹墽琛岀粨璁?
褰撳墠缁撹寰堟槑纭細

- 杩欐 pose 杩佺Щ鏄€滅湡瀹炶縼绉烩€濓紝涓嶆槸鍋囪縼绉汇€傚疄鏃剁籂閿欍€佺绾胯棰戝垎鏋愩€佸悗绔换鍔￠棴鐜€佽缁冭褰曡惤搴撻兘宸茬粡鍦ㄤ富浠撳簱鐪熷疄钀藉湴銆?- 浣嗗鏋滄爣鍑嗘槸鈥滀笌 `train` 鐪熸瀹屾暣瀵归綈鈥濓紝鐩墠杩樻病鏈夊畬鎴愩€?
鏇村噯纭殑鐘舵€佸簲琛ㄨ堪涓猴細

- `鏍稿績鑳藉姏宸茶縼绉籤
- `璁粌鍘嗗彶 / 鎶ュ憡鏌ョ湅閾捐矾鏈畬鍏ㄨ縼绉籤
- `缁熶竴鎶ュ憡褰掓。灞備粎閮ㄥ垎杩佺Щ`
- `濮挎€侀〉婧愮爜娓呯悊鏈畬鎴恅

涓€鍙ヨ瘽鎬荤粨锛?
- 濡傛灉鏍囧噯鏄€滄槸鍚﹀凡鎶?pose 涓昏兘鍔涜縼鍏?AI-FIT 骞舵墦閫氬墠鍚庣闂幆鈥?-> 鏄?- 濡傛灉鏍囧噯鏄€滄槸鍚﹀凡缁忚揪鍒?train 鐨勪骇鍝佺骇瀵归綈鐘舵€佲€?-> 杩樻病鏈?
## 浜屻€佷富瑕佸彂鐜?
### 楂樹紭鍏堢骇闂

1. 璁粌鍘嗗彶鑳藉姏鍙縼浜嗕竴鍗婏紝褰撳墠鍙湁鈥滀繚瀛樿缁冭褰曗€濓紝娌℃湁鎶?`train` 鐨勨€滃巻鍙叉煡鐪嬮摼璺€濈湡姝ｈ縼杩囨潵銆?
璇佹嵁锛?
- AI-FIT 鍚庣鍦?[`backend/app/routes/pose.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/pose.py#L240) 鍙彁渚涗簡 `POST /api/pose/trainings`锛屾病鏈?`GET /api/pose/trainings`锛屼篃娌℃湁璁粌浼氳瘽璇︽儏銆佸垹闄ゃ€佹洿鏂扮瓑鎺ュ彛銆?- 浠?[`backend/app/routes/pose.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/pose.py#L79) 鍒?[`backend/app/routes/pose.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/pose.py#L240) 鐨勮矾鐢辨竻鍗曞彲纭锛宼raining 鐩稿叧鍙湁涓€涓啓鍏ユ帴鍙ｃ€?- 鍓嶇濮挎€侀〉铏界劧宸茬粡鑳介€氳繃 [`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L308) 涓殑 `createPoseTraining()` 淇濆瓨璁粌璁板綍锛屼絾 AI-FIT 褰撳墠璺敱涓苟娌℃湁瀵瑰簲鐨勨€滃Э鎬佽缁冨巻鍙查〉鈥濇垨鈥滄煡鐪嬪凡淇濆瓨鎶ュ憡鈥濆叆鍙ｏ紱[`frontend/src/App.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/App.tsx#L24) 鐩墠鍙湁 `/tools/pose`銆?- `train` 渚ф槸鏈夊畬鏁村巻鍙查摼璺殑锛?  - 瀹炴椂椤甸噷鏈?鈥淰iew saved report鈥?鍜?鈥淕o to History鈥濓紝瑙?[`train/src/app/live/LiveClient.tsx`](/d:/trae/trae_projects/AI-FIT/train/src/app/live/LiveClient.tsx#L828)
  - 鍘嗗彶椤靛疄鐜板瓨鍦ㄤ簬 [`train/src/app/history/HistoryClient.tsx`](/d:/trae/trae_projects/AI-FIT/train/src/app/history/HistoryClient.tsx#L1)
  - 鍘嗗彶鍒楄〃 API 瀛樺湪浜?[`train/src/app/api/v1/private/trainings/route.ts`](/d:/trae/trae_projects/AI-FIT/train/src/app/api/v1/private/trainings/route.ts#L14)

褰卞搷锛?
- 褰撳墠 AI-FIT 宸插畬鎴愨€滀繚瀛樿缁冭褰曗€濓紝浣嗚繕娌℃湁瀹屾垚鈥滀娇鐢ㄨ缁冨巻鍙测€濄€?- 杩欒鏄庡畠宸茬粡杈惧埌杩佺Щ鏂规涓殑鏈€灏忔寔涔呭寲鐩爣锛屼絾杩樻病鏈夎揪鍒?`train` 鐨勫畬鏁翠骇鍝佹祦銆?
鍒ゆ柇锛?
- `涓庢渶灏忚縼绉绘柟妗堝榻恅
- `涓?train 浜у搧閾捐矾鏈畬鏁村榻恅

1. 缁熶竴鎶ュ憡褰掓。灞傛病鏈夌湡姝ｈ縼瀹岋紝AI-FIT 褰撳墠杩樻槸鏈€灏忓崰浣嶅疄鐜帮紝涓嶆槸 `train` 閭ｅ瑙勮寖鍖栧綊妗ｇ绾裤€?
璇佹嵁锛?
- AI-FIT 鐨?`normalizeReportForArchive()` 鍦?[`frontend/src/lib/report/unified.ts`](/d:/trae/trae_projects/AI-FIT/frontend/src/lib/report/unified.ts#L1) 涓疄闄呬笂鏄?no-op銆?- AI-FIT 鐨?PDF 鎶ュ憡娓叉煋鍦?[`frontend/src/lib/report/unified.ts`](/d:/trae/trae_projects/AI-FIT/frontend/src/lib/report/unified.ts#L5) 閲屽彧鏄€氱敤 key/value 杈撳嚭銆?- `train` 涓瓨鍦ㄧ湡姝ｇ殑缁熶竴褰掓。灞傦紝浼氬仛缁撴瀯娓呮礂銆佸瓧娈垫爣鍑嗗寲銆侀敊璇粺璁°€佹椂闂寸嚎閲囨牱鍜岀粨鏋勫寲 PDF 娓叉煋锛岃 [`train/src/lib/report/unified.ts`](/d:/trae/trae_projects/AI-FIT/train/src/lib/report/unified.ts#L179) 鍜?[`train/src/lib/report/unified.ts`](/d:/trae/trae_projects/AI-FIT/train/src/lib/report/unified.ts#L236)銆?
褰卞搷锛?
- 褰撳墠 AI-FIT 鐨勬姤鍛婂彲浠ュ鍑恒€佸彲浠ュ瓨妗ｏ紝浣嗗綊妗ｄ竴鑷存€у拰缁撴瀯绋冲畾鎬у急浜?`train`銆?- 濡傛灉鎶ュ憡 schema 鍚庣画婕斿寲锛孉I-FIT 褰撳墠瀵圭粨鏋勬紓绉荤殑鎶垫姉鍔涗笉濡?`train`銆?
鍒ゆ柇锛?
- `鍔熻兘鍙敤`
- `瀹炵幇娣卞害灏氭湭瀵归綈 train`

### 涓紭鍏堢骇闂

1. 濮挎€侀〉婧愮爜涓粛淇濈暀澶ч噺涓枃鏂囨鍜?CSS 瑕嗙洊寮忓厹搴曪紝鍥犳鈥滄簮鐮佸凡瀹屾垚鑻辨枃缁熶竴鍜屾竻鐞嗏€濊繖涓€鐐瑰苟涓嶆垚绔嬨€?
璇佹嵁锛?
- [`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L97)銆乕`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L155)銆乕`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L376)銆乕`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L487)銆乕`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L708)銆乕`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L954) 绛変綅缃粛鐩存帴瀛樺湪涓枃瀛楃涓层€?- 澶氬鍙鏂囨鏄€氳繃 CSS 鎶婂師鏂囧瓧浣撹鎴?`0` 鍐嶇敤 `::after` 娉ㄥ叆鑻辨枃鍐呭鏉ュ厹搴曪紝瑙?[`frontend/src/styles.css`](/d:/trae/trae_projects/AI-FIT/frontend/src/styles.css#L41)銆乕`frontend/src/styles.css`](/d:/trae/trae_projects/AI-FIT/frontend/src/styles.css#L124)銆乕`frontend/src/styles.css`](/d:/trae/trae_projects/AI-FIT/frontend/src/styles.css#L152)銆乕`frontend/src/styles.css`](/d:/trae/trae_projects/AI-FIT/frontend/src/styles.css#L195)銆乕`frontend/src/styles.css`](/d:/trae/trae_projects/AI-FIT/frontend/src/styles.css#L387)銆?- 瀹炴椂鍙嶉鍖哄煙杩橀€氳繃 nth-of-type 鏂瑰紡闅愯棌鏃у崱鐗囷紝瑙?[`frontend/src/styles.css`](/d:/trae/trae_projects/AI-FIT/frontend/src/styles.css#L354)銆?
褰卞搷锛?
- 椤甸潰杩愯鏃剁湅璧锋潵鍙兘宸茬粡鍩烘湰鍙敤锛屼絾婧愮爜灞傞潰浠嶇劧澶勪簬鈥滆繃娓℃€佲€濄€?- 鍚庣画缁存姢鎴愭湰鏇撮珮锛屼篃鏇村鏄撳湪缁х画淇敼鏃跺紩鍏ラ棶棰樸€?
鍒ゆ柇锛?
- `琛ㄩ潰 UI 鍙兘宸插榻恅
- `婧愮爜璐ㄩ噺灏氭湭鐪熸瀵归綈`

1. AI-FIT 鐨勫疄鏃惰缁冧繚瀛樿涔変笌 `train` 鍦ㄤ竴涓噸瑕佽竟鐣屽満鏅笂瀛樺湪琛屼负宸紓銆?
璇佹嵁锛?
- AI-FIT 鍦?[`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L313) 涓紝褰?rep 鏁颁负 `0` 鏃剁洿鎺ユ嫆缁濅繚瀛樸€?- `train` 鍦?[`train/src/app/live/LiveClient.tsx`](/d:/trae/trae_projects/AI-FIT/train/src/app/live/LiveClient.tsx#L312) 涓細鏁呮剰鍐欏叆涓€涓?placeholder set锛屼粠鑰屽厑璁糕€? reps 浣嗘湁鎶ュ憡鈥濈殑鍦烘櫙涔熻兘杩涘叆鍘嗗彶褰掓。銆?
褰卞搷锛?
- 鍦ㄧ煭鏃跺け璐ヨ缁冦€佹湭瀹屾垚鍔ㄤ綔浣嗕粛甯屾湜淇濈暀鎶ュ憡鐨勫満鏅笅锛孉I-FIT 褰撳墠浼氫涪澶变竴娆″彲褰掓。鏈轰細锛岃€?`train` 涓嶄細銆?
鍒ゆ柇锛?
- `浜у搧璇箟瀛樺湪宸紓`
- `涓嶆槸褰撳墠杩佺Щ闃诲椤筦

### 浣庝紭鍏堢骇闂

1. 鍚庣 pose 璺緞宸叉湁涓撻」娴嬭瘯锛屼絾鏇村畬鏁寸殑鍓嶇鍒版祻瑙堝櫒渚ц仈璋冭鐩栦粛鐒朵笉瓒炽€?
璇佹嵁锛?
- 鍚庣璺敱娴嬭瘯宸茬粡瀛樺湪浜?[`backend/tests/test_pose.py`](/d:/trae/trae_projects/AI-FIT/backend/tests/test_pose.py#L1)銆?- 鐩墠娌℃湁娴忚鍣ㄧ骇闆嗘垚楠岃瘉鍘昏瘉鏄庡畬鏁寸殑鍓嶇绂荤嚎鍒嗘瀽閾捐矾鍦ㄧ湡瀹?MediaPipe 鎵ц涓嬪缁堢ǔ瀹氥€?
褰卞搷锛?
- 褰撳墠瀵?API 姝ｇ‘鎬х殑淇″績杈冮珮銆?- 瀵规祻瑙堝櫒杩愯鏃惰竟鐣屽満鏅殑淇″績杩樹笉澶熼珮銆?
鍒ゆ柇锛?
- `鍚庣鍙潬鎬у凡鏈夎緝濂戒繚璇乣
- `鍓嶇 E2E 绾ч獙璇佷粛鍋忓急`

## 涓夈€佸榻愮煩闃?
### 1. 瀹炴椂绾犻敊

鐘舵€侊細`鏍稿績鑳藉姏宸插榻恅

宸茬‘璁ゅ畬鎴愶細

- 鎽勫儚澶村惎鍔?/ 鍋滄
- MoveNet 瀹炴椂妫€娴?- 楠ㄦ灦鍙犲姞
- 娆℃暟涓庤搴︽樉绀?- Coaching Tip 灞曠ず
- JSON / PDF 瀵煎嚭
- 淇濆瓨璁粌璁板綍鍒板悗绔?
璇佹嵁锛?
- 涓婚〉闈㈠疄鐜颁綅浜?[`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L30)
- 淇濆瓨璺緞浣嶄簬 [`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L308)

缁撹锛?
- 杩欎竴閮ㄥ垎宸茬粡鏄湡瀹炶縼绉伙紝涓嶆槸浼棴鐜€?
### 2. 绂荤嚎瑙嗛鍒嗘瀽

鐘舵€侊細`鏍稿績鑳藉姏宸插榻恅

宸茬‘璁ゅ畬鎴愶細

- 涓婁紶瑙嗛
- 鍒涘缓鍒嗘瀽浠诲姟
- 閫氳繃 blob URL 鑾峰彇鍙椾繚鎶よ棰?- 娴忚鍣ㄧ MediaPipe 鎻愬彇鍏抽敭鐐?- 鏍囧噯妯℃澘姣斿鎴栭€氱敤鍒嗘瀽
- 鎴愬姛 / 澶辫触鍥炲啓
- 鎶ュ憡灞曠ず
- JSON / PDF 瀵煎嚭

璇佹嵁锛?
- 鍓嶇涓茶仈閫昏緫浣嶄簬 [`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L358)
- pose API 灏佽浣嶄簬 [`frontend/src/lib/poseApi.ts`](/d:/trae/trae_projects/AI-FIT/frontend/src/lib/poseApi.ts#L1)
- 鍚庣浠诲姟鎺ュ彛浣嶄簬 [`backend/app/routes/pose.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/pose.py#L147)

缁撹锛?
- 杩欎竴閮ㄥ垎涔熷凡缁忔槸鐪熷疄杩佺Щ銆?
### 3. 鍚庣鎸佷箙鍖栦笌浠诲姟闂幆

鐘舵€侊細`涓庤縼绉绘柟妗堝榻恅

宸茬‘璁ゅ畬鎴愶細

- `video_assets`
- `analysis_tasks`
- `analysis_results`
- `training_sessions`
- `training_sets`
- 涓婁紶闄愬埗鎻愬崌鍒?80MB
- 閴存潈淇濇姢鐨勮棰戞枃浠惰闂?
璇佹嵁锛?
- 鏁版嵁妯″瀷瑙?[`backend/app/models.py`](/d:/trae/trae_projects/AI-FIT/backend/app/models.py#L250)
- 搴旂敤閰嶇疆涓庤摑鍥炬敞鍐岃 [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L35)

缁撹锛?
- 鍚庣鏈€灏忛棴鐜凡缁忕湡瀹炶惤鍦般€?
### 4. 璁粌鍘嗗彶

鐘舵€侊細`鏈畬鍏ㄨ縼绉籤

鐩墠宸叉湁锛?
- 鍙互鎶?session / report 瀛樺叆鏁版嵁搴?
鐩稿 `train` 浠嶇己澶憋細

- 鍘嗗彶鍒楄〃 API
- 鍘嗗彶璇︽儏 / 鏌ョ湅璺緞
- 椤甸潰鍐呪€滄煡鐪嬪凡淇濆瓨鎶ュ憡鈥濆欢缁摼璺?- 鍘嗗彶瀵艰埅鍏ュ彛

缁撹锛?
- 杩欐槸褰撳墠鏈€澶х殑浜у搧绾х己鍙ｃ€?
### 5. 缁熶竴鎶ュ憡灞?
鐘舵€侊細`閮ㄥ垎杩佺Щ`

鐩墠宸叉湁锛?
- 鎶ュ憡鐢熸垚
- JSON / PDF 瀵煎嚭
- 鎶ュ憡瀛楁鍏ュ簱淇濆瓨

灏氭湭瀹屽叏瀵归綈锛?
- 缁熶竴褰掓。 contract
- 鏇寸ǔ鍋ョ殑鎶ュ憡娓呮礂涓庢爣鍑嗗寲
- 涓?`train` 绛夌骇涓€鑷寸殑缁撴瀯鍖?PDF 杈撳嚭

缁撹锛?
- 褰撳墠鏄€滆兘鐢ㄢ€濓紝浣嗚繕涓嶆槸鈥滅湡姝ｅ畬鏁磋縼瀹屸€濄€?
## 鍥涖€佷笉鏄棶棰樼殑闂

浠ヤ笅鍐呭涓嶅簲绠椾綔鏈杩佺Щ澶辫触锛屽洜涓哄畠浠師鏈氨涓嶅湪褰撳墠杩佺Щ鐩爣鑼冨洿鍐咃細

- 鍚庣 worker 鐪熸鎵ц濮挎€佹帹鐞?- 鏁翠釜 `train` Next.js 搴旂敤鏁翠綋杩佸叆
- Prisma / SQLite 淇濈暀杩愯
- 闅愮銆乀TL銆佸師濮嬭棰戜繚瀛樼瓥鐣ユ暣濂楄縼鍏?
## 浜斻€佹渶缁堣瘎浼?
褰撳墠杩佺Щ瀹屾垚搴﹀彲鍒嗕负锛?
- `濮挎€佹牳蹇冭兘鍔涘畬鎴愬害`锛氶珮
- `涓庤縼绉绘柟妗堢殑涓€鑷存€锛氶珮
- `涓?train 浜у搧绾у榻愮▼搴锛氫腑

寤鸿鐨勫悗缁姩浣滈『搴忥細

1. 鍦?AI-FIT 涓ˉ榻愬Э鎬佽缁冨巻鍙茬殑鏌ヨ銆佽鎯呭拰鏌ョ湅鍏ュ彛銆?2. 灏?[`frontend/src/lib/report/unified.ts`](/d:/trae/trae_projects/AI-FIT/frontend/src/lib/report/unified.ts#L1) 浠庡綋鍓嶅崰浣嶅疄鐜版浛鎹负 `train` 涓湡姝ｇ殑缁熶竴褰掓。瀹炵幇銆?3. 娓呯悊 [`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L1) 鍜?[`frontend/src/styles.css`](/d:/trae/trae_projects/AI-FIT/frontend/src/styles.css#L1)锛岃椤甸潰鏂囨鐢辨簮鐮佺洿鎺ユ嫢鏈夛紝鑰屼笉鏄緷璧?CSS 闅愯棌 / 瑕嗙洊銆?4. 鑷冲皯琛ヤ竴鏉℃祻瑙堝櫒绾ф墜宸ユ垨鑷姩 smoke 璺緞锛岄獙璇佺绾垮垎鏋愰摼璺殑鐪熷疄鑱旇皟绋冲畾鎬с€?
搴曠嚎缁撹锛?
- 杩欐杩佺Щ鏄湡瀹炵殑銆?- pose 鏈€閲嶈鐨勮兘鍔涘凡缁忚繘鍏?AI-FIT銆?- 浣嗙幇鍦ㄨ繕涓嶈兘鍑嗙‘琛ㄨ堪涓衡€滃凡涓?train 瀹屾暣瀵归綈鈥濓紱璁粌鍘嗗彶閾捐矾鍜岀粺涓€鎶ュ憡褰掓。灞傛槸褰撳墠鏈€涓昏鐨勫墿浣欏樊璺濄€?


