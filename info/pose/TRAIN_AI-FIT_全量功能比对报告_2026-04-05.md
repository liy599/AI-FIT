# Train 涓?AI-FIT 鍏ㄩ噺鍔熻兘姣斿鎶ュ憡

鏃ユ湡锛?026-04-05

## 涓€銆佺洰鐨?
鏈姤鍛婄敤浜庡洖绛斾袱涓棶棰橈細

1. `train` 褰撳墠鍒板簳鍖呭惈鍝簺鍔熻兘銆?2. 杩欎簺鍔熻兘涓紝鍝簺宸茬粡杩佺Щ鍒板綋鍓?`AI-FIT`锛屽摢浜涘彧鏄儴鍒嗚縼绉伙紝鍝簺杩樻病鏈夎縼绉汇€?
娉ㄦ剰锛?- 鏈姤鍛婂叧娉ㄧ殑鏄€渀train` 鐨勫姛鑳戒笌 `AI-FIT` 褰撳墠鐘舵€佺殑瀵圭収鈥濄€?- `AI-FIT` 鏈韩杩樺寘鍚崥瀹€佽绋嬨€佽惀鍏诲垎鏋愩€佺敤鎴蜂腑蹇冪瓑鍘熺敓鍔熻兘锛岃繖浜涗笉灞炰簬浠?`train` 杩佺Щ鑰屾潵锛屼絾浼氬湪鏂囨湯鍗曠嫭璇存槑锛岄伩鍏嶆贩娣嗐€?
## 浜屻€佹€讳綋缁撹

褰撳墠鍙互涓嬬粨璁猴細

- `train` 鐨勬牳蹇冧环鍊煎姛鑳戒富瑕侀泦涓湪鈥滆缁冭褰?+ 瀹炴椂濮挎€佺籂閿?+ 绂荤嚎瑙嗛鍒嗘瀽 + 鍘嗗彶涓庨殣绉佺鐞嗏€濄€?- 鍏朵腑鐪熸宸茬粡杩佸叆 `AI-FIT` 鐨勶紝涓昏鏄?`pose` 鐩稿叧鏍稿績鑳藉姏锛?  - 瀹炴椂濮挎€佺籂閿?  - 绂荤嚎瑙嗛鍒嗘瀽
  - 鏈€灏忚棰?浠诲姟/鎶ュ憡/璁粌璁板綍鍚庣闂幆
- 浣嗗鏋滀粠 `train` 鐨勫叏閲忎骇鍝佸姛鑳界湅锛屽綋鍓?`AI-FIT` 杩樻病鏈夊畬鏁磋縼瀹岋紝灏ゅ叾缂哄皯锛?  - 璁粌鍘嗗彶瀹屾暣閾捐矾
  - 鍒嗘瀽鍘嗗彶 / 浠诲姟绠＄悊閾捐矾
  - 璁粌浼氳瘽绠＄悊閾捐矾
  - 闅愮涓庢暟鎹鍑鸿兘鍔?  - 浠〃鐩樸€佹寫鎴樸€佽缃瓑浜у搧澶栧洿鑳藉姏

涓€鍙ヨ瘽鍒ゆ柇锛?- `AI-FIT` 宸茶縼鍏?`train` 鐨勨€滃Э鎬佹牳蹇冭兘鍔涒€?- `AI-FIT` 灏氭湭杩佸叆 `train` 鐨勨€滃畬鏁磋缁冧骇鍝佷綋绯烩€?
## 涓夈€乼rain 鍔熻兘鍏ㄦ櫙

缁撳悎 `train/src/app` 椤甸潰缁撴瀯銆佸鑸€丄PI 涓庨〉闈㈠疄鐜帮紝`train` 褰撳墠鍔熻兘鍙互鎷嗘垚浠ヤ笅妯″潡锛?
### 1. 璐﹀彿涓庝細璇?
`train` 鍖呭惈锛?- 娉ㄥ唽
- 鐧诲綍
- 鐧诲嚭
- 浼氳瘽鑾峰彇

璇佹嵁锛?- 椤甸潰鐩綍锛歚/login`銆乣/register`
- API锛歚/api/v1/auth/login`銆乣/api/v1/auth/register`銆乣/api/v1/auth/logout`銆乣/api/v1/auth/session`

### 2. 璁粌涓婚摼璺?
`train` 鍖呭惈锛?- 寮€濮嬭缁冧細璇?- 璇诲彇褰撳墠娲诲姩璁粌
- 缂栬緫璁粌 sets
- 瀹屾垚璁粌浼氳瘽
- 淇濆瓨璁粌鎶ュ憡
- 浠庤缁冧細璇濊烦鍒板疄鏃剁籂閿欐垨鍒嗘瀽

璇佹嵁锛?- 椤甸潰锛歚/train`
- API锛歚/api/v1/private/trainings`銆乣/api/v1/private/trainings/active`銆乣/api/v1/private/trainings/[id]`銆乣/api/v1/private/trainings/[id]/complete`

### 3. 瀹炴椂濮挎€佺籂閿?
`train` 鍖呭惈锛?- 鎽勫儚澶村疄鏃跺Э鎬佹娴?- 娆℃暟缁熻
- Range Check
- Coaching Tip
- JSON/PDF 瀵煎嚭
- 淇濆瓨鍒板巻鍙?- 鏌ョ湅宸蹭繚瀛樻姤鍛?
璇佹嵁锛?- 椤甸潰锛歚/live`
- 瀹炵幇锛歚train/src/app/live/LiveClient.tsx`

### 4. 绂荤嚎瑙嗛鍒嗘瀽

`train` 鍖呭惈锛?- 涓婁紶鎴栭€夋嫨瑙嗛
- 鍒涘缓鍒嗘瀽浠诲姟
- 浠诲姟璇︽儏鏌ョ湅
- 娴忚鍣ㄧ鍒嗘瀽
- complete / retry / delete
- 鎶ュ憡鏌ョ湅
- 鍒嗘瀽鍘嗗彶

璇佹嵁锛?- 椤甸潰锛歚/analysis`銆乣/analysis/[id]`銆乣/analysis/history`
- API锛歚/api/v1/private/analysis/jobs`銆乣/api/v1/private/analysis/jobs/[id]`銆乣/api/v1/private/analysis/jobs/[id]/complete`銆乣/api/v1/private/analysis/jobs/[id]/retry`

### 5. 瑙嗛璧勪骇绠＄悊

`train` 鍖呭惈锛?- 瑙嗛涓婁紶
- 瑙嗛鍒楄〃
- 瑙嗛鏂囦欢璇诲彇

璇佹嵁锛?- API锛歚/api/v1/private/videos`銆乣/api/v1/private/videos/[id]/file`

### 6. 璁粌鍘嗗彶

`train` 鍖呭惈锛?- 鍘嗗彶鏃ュ巻椤?- 鎸夋棩鏈熸煡鐪嬭缁冭褰?- 鏌ョ湅璁粌璇︽儏 / 鎶ュ憡
- 鍒犻櫎璁粌璁板綍
- 鍘嗗彶缁熻鍗犱綅

璇佹嵁锛?- 椤甸潰锛歚/history`
- API锛歚/api/v1/private/trainings`銆乣/api/v1/private/trainings/[id]`

### 7. 鍔ㄤ綔涓庡垎绫?
`train` 鍖呭惈锛?- 鍔ㄤ綔鍒楄〃
- 鍔ㄤ綔鍒嗙被
- 鑷畾涔夊姩浣?/ 鍒嗙被绠＄悊鐩稿叧 API

璇佹嵁锛?- 椤甸潰锛歚/exercises`
- API锛歚/api/v1/private/exercises`銆乣/api/v1/private/exercise-categories`銆乣/api/v1/private/exercise-categories/[id]`

### 8. 浠〃鐩?
`train` 鍖呭惈锛?- 璁粌姹囨€?- 鍒嗘瀽姹囨€?- 褰撳墠鐘舵€?- 蹇嵎鍏ュ彛

璇佹嵁锛?- 椤甸潰锛歚/dashboard`

### 9. 鎸戞垬

`train` 鍖呭惈锛?- Challenge 椤甸潰
- Active / Past 鏍囩椤?- 鏂板缓鎸戞垬鍗犱綅鍏ュ彛

璇存槑锛?- 璇ユā鍧楀綋鍓嶆洿鍋忊€滃崰浣嶉〉 / 瑙勫垝涓姛鑳解€濓紝涓嶅睘浜庢垚鐔熶富鍔熻兘銆?
### 10. 璁剧疆涓庣浉鏈哄亸濂?
`train` 鍖呭惈锛?- 璐︽埛璁剧疆椤?- camera mirror / zoom / viewport width 鍋忓ソ
- 鐧诲嚭

璇佹嵁锛?- 椤甸潰锛歚/settings`
- API锛歚/api/v1/private/camera/settings`

### 11. 闅愮涓庢暟鎹?
`train` 鍖呭惈锛?- 鏄惁淇濆瓨鍘熷瑙嗛
- 瑙嗛 TTL
- 鏁版嵁瀵煎嚭 JSON / CSV
- 娓呯┖璁粌鏁版嵁
- 娓呯┖鍒嗘瀽鏁版嵁

璇佹嵁锛?- 椤甸潰锛歚/privacy`
- API锛歚/api/v1/private/privacy/settings`銆乣/api/v1/private/privacy/export`

## 鍥涖€丄I-FIT 褰撳墠宸插叿澶囩殑瀵瑰簲鑳藉姏

褰撳墠 `AI-FIT` 涓紝涓?`train` 瀵瑰簲鐨勮兘鍔涗富瑕佹潵鑷袱閮ㄥ垎锛?
### A. 宸蹭粠 train 杩佸叆鎴栧榻愮殑鑳藉姏

- `/tools/pose` 缁熶竴濮挎€佸叆鍙?- 瀹炴椂濮挎€佺籂閿?- 绂荤嚎瑙嗛鍒嗘瀽
- 瑙嗛涓婁紶 / 鍒楄〃 / 鏂囦欢璇诲彇
- 鍒嗘瀽浠诲姟鍒涘缓 / 鏌ヨ / complete / fail
- 璁粌璁板綍鍐欏叆 `training_sessions` / `training_sets`

璇佹嵁锛?- 鍓嶇锛歔`frontend/src/pages/PoseToolPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/PoseToolPage.tsx#L1)
- 鍚庣锛歔`backend/app/routes/pose.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/pose.py#L79)
- 妯″瀷锛歔`backend/app/models.py`](/d:/trae/trae_projects/AI-FIT/backend/app/models.py#L250)

### B. AI-FIT 鍘熺敓宸叉湁锛屼絾涓嶅睘浜?train 杩佺Щ鐨勮兘鍔?
- 鐢ㄦ埛绯荤粺
- 涓汉璧勬枡椤?- 鍗氬涓庤瘎璁?- 璇剧▼涓庢姤鍚?- 楗 / 璁粌璁板綍
- 钀ュ吇鍒嗘瀽
- 鍙嶉

璇佹嵁锛?- 鍓嶇璺敱锛歔`frontend/src/App.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/App.tsx#L24)
- 鍚庣璺敱锛歚auth.py`銆乣user.py`銆乣blogs.py`銆乣comments.py`銆乣courses.py`銆乣course_comments.py`銆乣workouts.py`銆乣diets.py`銆乣nutrition.py`銆乣feedback.py`

## 浜斻€佸叏閲忔瘮瀵圭煩闃?
### 1. 璐﹀彿涓庤璇?
`train`锛?- 鐧诲綍 / 娉ㄥ唽 / 鐧诲嚭 / session

`AI-FIT` 褰撳墠鐘舵€侊細
- 宸插叿澶囩瓑浠疯兘鍔?- 浣嗗疄鐜版満鍒朵笉鍚岋細`train` 鍋?session/cookie 浣撶郴锛宍AI-FIT` 浣跨敤 JWT

缁撹锛?- `鍔熻兘绛変环`
- `涓嶅睘浜庢娆?pose 杩佺Щ閲嶇偣`

### 2. 璁粌涓婚摼璺紙Training Session锛?
`train`锛?- 鍒涘缓璁粌浼氳瘽
- 娲诲姩璁粌妫€娴?- 缂栬緫璁粌 sets
- 瀹屾垚璁粌
- 璁粌浼氳瘽璇︽儏

`AI-FIT` 褰撳墠鐘舵€侊細
- 鍙湁 `POST /api/pose/trainings` 杩欑鈥滃畬鎴愬悗涓€娆℃€у啓鍏ヨ缁冭褰曗€濈殑鑳藉姏
- 娌℃湁璁粌涓殑 session 鐢熷懡鍛ㄦ湡绠＄悊
- 娌℃湁 active session
- 娌℃湁 `/train` 绛変环椤甸潰

缁撹锛?- `鏈縼绉籤
- `鍙縼浜嗘渶缁堣惤搴擄紝涓嶆槸 train 鐨勫畬鏁磋缁冮摼璺痐

### 3. 瀹炴椂濮挎€佺籂閿?
`train`锛?- 瀹炴椂妫€娴嬨€佽鏁般€佹彁绀恒€佸鍑恒€佷繚瀛樺埌鍘嗗彶

`AI-FIT` 褰撳墠鐘舵€侊細
- 宸茶縼绉绘牳蹇冭兘鍔?- 椤甸潰鍏ュ彛缁熶竴鍒?`/tools/pose`
- 鍙互淇濆瓨璁粌璁板綍

缂哄彛锛?- 娌℃湁鈥滀繚瀛樺悗鏌ョ湅鍘嗗彶/鎶ュ憡鈥濆悗缁摼璺?- 娌℃湁 camera settings 鎸佷箙鍖?
缁撹锛?- `鏍稿績鑳藉姏宸茶縼绉籤
- `浜у搧绾ф敹鍙ｆ湭瀹屾垚`

### 4. 绂荤嚎瑙嗛鍒嗘瀽

`train`锛?- 鍒涘缓鍒嗘瀽浠诲姟
- 鏌ョ湅浠诲姟璇︽儏
- complete / retry / delete
- 鍒嗘瀽鍘嗗彶

`AI-FIT` 褰撳墠鐘舵€侊細
- 宸插疄鐜颁笂浼犺棰戙€佸垱寤轰换鍔°€佸墠绔垎鏋愩€乧omplete / fail 鍥炲啓
- 鍙睍绀烘姤鍛婂苟瀵煎嚭 JSON/PDF

缂哄彛锛?- 娌℃湁浠诲姟鍒楄〃椤?/ 鍒嗘瀽鍘嗗彶椤?- 娌℃湁 retry
- 娌℃湁 delete
- 娌℃湁鐙珛鐨勪换鍔¤鎯呰矾鐢?
缁撹锛?- `鏍稿績鑳藉姏宸茶縼绉籤
- `浠诲姟绠＄悊鑳藉姏鏈縼绉籤

### 5. 瑙嗛璧勪骇绠＄悊

`train`锛?- 瑙嗛涓婁紶
- 瑙嗛鍒楄〃
- 瑙嗛鏂囦欢璇诲彇

`AI-FIT` 褰撳墠鐘舵€侊細
- 宸插疄鐜?`POST /api/pose/videos`
- 宸插疄鐜?`GET /api/pose/videos`
- 宸插疄鐜?`GET /api/pose/videos/<id>/file`

缁撹锛?- `宸茶縼绉籤

### 6. 璁粌鍘嗗彶

`train`锛?- 鍘嗗彶椤?- 鏃ユ湡缁村害鏌ョ湅
- 浼氳瘽璇︽儏
- 鍒犻櫎璁板綍

`AI-FIT` 褰撳墠鐘舵€侊細
- 鍙湁鍐欏叆 `training_sessions` / `training_sets`
- 娌℃湁鍘嗗彶鍒楄〃 API
- 娌℃湁璇︽儏 API
- 娌℃湁鍘嗗彶椤?
缁撹锛?- `鏈縼绉籤

### 7. 鍒嗘瀽鍘嗗彶 / 浠诲姟绠＄悊

`train`锛?- 鍒嗘瀽浠诲姟鍒楄〃
- 鍗曚换鍔¤鎯?- retry / delete

`AI-FIT` 褰撳墠鐘舵€侊細
- 鍙湁鍒涘缓鍗曚换鍔°€佽幏鍙栧崟浠诲姟銆乧omplete / fail
- 娌℃湁浠诲姟鍒楄〃
- 娌℃湁浠诲姟鍘嗗彶
- 娌℃湁 retry / delete

缁撹锛?- `閮ㄥ垎杩佺Щ`

### 8. 鍔ㄤ綔涓庡垎绫荤鐞?
`train`锛?- exercises
- exercise categories
- custom exercise API

`AI-FIT` 褰撳墠鐘舵€侊細
- 褰撳墠 pose 娴佺▼鍩烘湰鍐欐鍥寸粫 `squat`
- 娌℃湁 train 閭ｅ鍔ㄤ綔 / 鍒嗙被浣撶郴

缁撹锛?- `鏈縼绉籤

### 9. 浠〃鐩?
`train`锛?- dashboard 姹囨€昏缁?/ 鍒嗘瀽鐘舵€?
`AI-FIT` 褰撳墠鐘舵€侊細
- 鏃犲搴?dashboard

缁撹锛?- `鏈縼绉籤

### 10. Challenge

`train`锛?- 鏈夊崰浣嶉〉涓庡鑸叆鍙?
`AI-FIT` 褰撳墠鐘舵€侊細
- 鏃犲搴旀ā鍧?
缁撹锛?- `鏈縼绉籤
- `浣嗚妯″潡鏈韩鍦?train 涓篃涓嶆槸鎴愮啛鏍稿績鍔熻兘`

### 11. 璁剧疆涓庣浉鏈哄亸濂?
`train`锛?- 鐙珛 settings 椤?- camera mirror / zoom / viewport width 鎸佷箙鍖?
`AI-FIT` 褰撳墠鐘舵€侊細
- 瀹炴椂椤甸噷鏈?Mirror / Size / Zoom 绫绘帶鍒?- 浣嗘病鏈夌嫭绔?settings 椤甸潰
- 娌℃湁鐩告満鍋忓ソ鎸佷箙鍖栨帴鍙?- 褰撳墠鎺у埗涓昏鍋滅暀鍦ㄩ〉闈㈠唴鐘舵€?
缁撹锛?- `閮ㄥ垎杩佺Щ`
- `鍙縼浜嗙晫闈㈣兘鍔涳紝鏈縼鎸佷箙鍖栦笌璁剧疆椤礰

### 12. 闅愮涓庢暟鎹鍑?
`train`锛?- 闅愮璁剧疆
- 淇濆瓨鍘熻棰戝紑鍏?- TTL
- JSON/CSV 瀵煎嚭
- 鍒犻櫎鍏ㄩ儴璁粌 / 鍒嗘瀽鏁版嵁

`AI-FIT` 褰撳墠鐘舵€侊細
- 娌℃湁瀵瑰簲椤甸潰
- 娌℃湁瀵瑰簲鎺ュ彛
- 褰撳墠鍚庣瑙嗛鏄洿鎺ュ瓨鏈湴纾佺洏

缁撹锛?- `鏈縼绉籤

### 13. 缁熶竴鎶ュ憡褰掓。灞?
`train`锛?- 缁熶竴鎶ュ憡瑙勮寖鍖?- 閿欒缁熻
- 鏃堕棿绾块噰鏍?- 缁撴瀯鍖?PDF

`AI-FIT` 褰撳墠鐘舵€侊細
- 宸茶兘鐢熸垚鎶ュ憡骞跺鍑?- 浣?`frontend/src/lib/report/unified.ts` 浠嶆槸鏈€灏忓崰浣嶅疄鐜?
缁撹锛?- `閮ㄥ垎杩佺Щ`

## 鍏€佽縼绉荤姸鎬佹€昏〃

### 宸茶縼绉?
- pose 瀹炴椂绾犻敊鏍稿績鑳藉姏
- pose 绂荤嚎瑙嗛鍒嗘瀽鏍稿績鑳藉姏
- pose 瑙嗛涓婁紶 / 瑙嗛鍒楄〃 / 瑙嗛鏂囦欢璁块棶
- pose 鍒嗘瀽浠诲姟鏈€灏忛棴鐜?- pose 璁粌璁板綍鏈€缁堣惤搴?
### 閮ㄥ垎杩佺Щ

- 瀹炴椂椤典骇鍝佹敹鍙?- 绂荤嚎鍒嗘瀽浠诲姟绠＄悊
- 鎶ュ憡缁熶竴褰掓。灞?- 璁剧疆涓殑鐩告満鑳藉姏

### 鏈縼绉?
- 璁粌涓婚摼璺紙active session / update / complete锛?- 璁粌鍘嗗彶椤?- 鍒嗘瀽鍘嗗彶椤?- 浠诲姟 retry / delete / 鍒楄〃
- exercises / categories 浣撶郴
- dashboard
- privacy / export / TTL
- challenge

## 涓冦€丄I-FIT 鍘熺敓宸叉湁浣嗕笉灞炰簬 train 杩佺Щ鐨勮兘鍔?
杩欓儴鍒嗛渶瑕佸崟鐙己璋冿紝鍚﹀垯浼氳鍒も€淎I-FIT 鍔熻兘鏇村锛屾墍浠?train 宸茶縼瀹屸€濄€?
AI-FIT 褰撳墠鍘熺敓宸叉湁锛?- 鍗氬
- 鍗氬璇勮涓庣偣璧?- 璇剧▼鍒楄〃 / 璇︽儏 / 鎶ュ悕 / 璇剧▼璇勮
- 鐢ㄦ埛璧勬枡涓庡ご鍍忎笂浼?- workout 璁板綍
- diet 璁板綍
- 钀ュ吇鍒嗘瀽
- 鍙嶉绯荤粺

杩欎簺鍔熻兘璇存槑锛?- `AI-FIT` 涓嶆槸 `train` 鐨勫瓙闆?- `AI-FIT` 鏄竴涓洿骞夸箟鐨勭綉绔欏瀷浜у搧
- 褰撳墠杩佺Щ宸ヤ綔鍙槸鍦ㄨ繖涓富绔欓噷鎺ュ叆 `train` 鐨勫Э鎬佽缁冭兘鍔涳紝鑰屼笉鏄妸 `train` 鏁翠綋鎼繃鏉?
## 鍏€佹渶缁堝垽鏂?
濡傛灉姣旇緝瀵硅薄鏄?`train` 鐨勨€滄墍鏈夊姛鑳解€濅笌 `AI-FIT` 褰撳墠鐘舵€侊紝閭ｄ箞鐜板湪鐨勭湡瀹炵姸鎬佹槸锛?
- `train` 鐨勬牳蹇冨Э鎬佽兘鍔涘凡缁忚縼鍏?AI-FIT
- `train` 鐨勫畬鏁磋缁冧骇鍝佷綋绯昏繕娌℃湁杩佸畬

鏇寸簿纭湴璇达細
- 宸插畬鎴愮殑鏄?`pose capability migration`
- 鏈畬鎴愮殑鏄?`training product migration`

## 涔濄€佸缓璁殑鍚庣画浼樺厛绾?
寤鸿鎸変笅闈㈤『搴忕户缁帹杩涳紝鎬т环姣旀渶楂橈細

1. 鍏堣ˉ鈥滃Э鎬佽缁冨巻鍙测€濇煡璇笌鏌ョ湅閾捐矾銆?2. 鍐嶈ˉ鈥滃垎鏋愪换鍔″垪琛?/ 鍘嗗彶 / retry鈥濄€?3. 鍐嶆妸 `frontend/src/lib/report/unified.ts` 鏇挎崲涓?`train` 鐨勭湡瀹炵粺涓€褰掓。瀹炵幇銆?4. 鏈€鍚庡啀鍐冲畾鏄惁缁х画杩佺Щ璁剧疆銆侀殣绉併€乨ashboard銆乪xercise 鍒嗙被浣撶郴銆?
## 鍗併€佺粨璁轰竴鍙ヨ瘽鐗?
褰撳墠 `AI-FIT` 涓嶆槸鈥滃凡缁忚縼瀹?train鈥濓紝鑰屾槸鈥滃凡缁忔妸 train 涓渶閲嶈鐨?pose 鏍稿績鑳藉姏杩佽繘鏉ヤ簡锛屼絾璁粌鍘嗗彶銆佷换鍔＄鐞嗐€侀殣绉佽缃€佷华琛ㄧ洏绛夊鍥翠骇鍝佽兘鍔涜繕娌℃湁瀹屾暣杩佸叆鈥濄€?
