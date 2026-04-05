# FOOD Migration Audit

鏃ユ湡锛?026-04-05

瀹℃煡鑼冨洿锛?- 瀵圭収 [`FOODIDENTITY_姝ｅ紡杩佺Щ瀹炴柦鏂规_2026-04-05.md`](/d:/trae/trae_projects/AI-FIT/info/food/FOODIDENTITY_姝ｅ紡杩佺Щ瀹炴柦鏂规_2026-04-05.md) 瀹℃煡 food 姝ｅ紡杩佺Щ鐩爣鏄惁宸茬粡鐪熷疄钀藉湴
- 浜ゅ弶鏍稿 `info/FOOD_MIGRATION_LOG.md` 涓褰曠殑杩佺Щ杩囩▼
- 妫€鏌ュ綋鍓?AI-FIT 鍓嶅悗绔疄鐜版槸鍚︿笌鏃ュ織缁撹涓€鑷?- 鍒ゆ柇褰撳墠鐘舵€佹槸鍚﹀凡缁忚揪鍒扳€滄寮?food 杩愯鏃舵敹鏁涒€濓紝浠ュ強杩樺墿鍝簺鎻愪氦鍓嶉闄?
鏈鍩轰簬浠ｇ爜涓庢祴璇曡褰曠‘璁ょ殑楠岃瘉椤癸細
- `frontend`锛歚npm.cmd run typecheck` 宸插湪杩佺Щ鏃ュ織涓褰曢€氳繃
- `backend`锛歚.\.venv\Scripts\python.exe -m pytest tests/test_food.py tests/test_food_recognize.py -q` 宸插湪杩佺Щ鏃ュ織涓褰曢€氳繃
- legacy API 鎺㈤拡锛歚/api/food/meta -> 200`銆乣/api/foods -> 200`銆乣/api/diets -> 404`銆乣/api/nutrition/analyze -> 404`

## 涓€銆佹墽琛岀粨璁?
褰撳墠缁撹姣旇緝鏄庣‘锛?
- 杩欐 food 杩佺Щ宸茬粡瀹屾垚浜嗏€滄寮忚繍琛屾椂鏀舵暃鈥濓紝涓嶆槸鍋滅暀鍦ㄨ縼绉昏璁℃垨鍙岄摼璺苟瀛橀樁娈点€?- 鍓嶇姝ｅ紡鍏ュ彛宸茬粡鏀舵暃鍒?`/food` 涓?`/food/meal/:mealType`锛屾棫 `/tools/food` 鍙繚鐣欏吋瀹归噸瀹氬悜銆?- 鍚庣姝ｅ紡鍏ュ彛宸茬粡鏀舵暃鍒?`/api/food`銆乣/api/foods`銆乣/api/meals`銆乣/api/recognize`锛屾棫 `/api/diets` 涓?`/api/nutrition` 宸查€€鍑鸿繍琛屾椂銆?- 姝ｅ紡鏁版嵁妯″瀷宸茬粡鍒囧埌 `foods / meal_records / meal_items`锛屾棫 `DietRecord` 宸蹭粠浠ｇ爜涓诲共绉婚櫎銆?
鏇村噯纭殑鐘舵€佽〃杩板簲涓猴細

- `姝ｅ紡 food 杩愯閾捐矾宸插畬鎴恅
- `legacy food 杩愯鍏ュ彛宸蹭笅绾縛
- `foodidentity 宸蹭笉鍐嶆槸褰撳墠姝ｅ紡杩愯鏃朵緷璧朻
- `浠撳簱浠嶆湁灏戦噺鎻愪氦杈圭晫涓庡畨鍏ㄦ€ч棶棰橀渶瑕佸湪鏈€缁堟彁浜ゅ墠鍗曠嫭澶勭悊`

涓€鍙ヨ瘽鎬荤粨锛?
- 濡傛灉鏍囧噯鏄€淎I-FIT 鏄惁宸茬粡鍏峰鐙珛杩愯鐨勬寮?food 妯″潡鈥?-> 鏄?- 濡傛灉鏍囧噯鏄€滆繖涓€鎵规敼鍔ㄦ槸鍚﹀彲浠ヤ笉鍔犵瓫閫夌洿鎺ユ暣浣撴彁浜も€?-> 杩樹笉寤鸿

## 浜屻€佷富瑕佸彂鐜?
### 楂樹紭鍏堢骇闂

1. `backend/.env.example` 褰撳墠鍖呭惈鍏蜂綋鐨?`STEPFUN_API_KEY`锛岃繖灞炰簬鎻愪氦瀹夊叏椋庨櫓锛屼笉搴旀贩鍏ユ湰娆?food 杩佺Щ鎻愪氦銆?
璇佹嵁锛?- [`backend/.env.example`](/d:/trae/trae_projects/AI-FIT/backend/.env.example#L7)
- [`backend/.env.example`](/d:/trae/trae_projects/AI-FIT/backend/.env.example#L8)
- [`backend/.env.example`](/d:/trae/trae_projects/AI-FIT/backend/.env.example#L9)

褰卞搷锛?- 鍗充娇 food 杩佺Щ鏈韩宸茬粡瀹屾垚锛屽甫鐪熷疄鏍峰紡鐨勫瘑閽ヤ粛浼氭薄鏌撴彁浜よ竟鐣屻€?- 杩欑被鍙樻洿涓嶅睘浜?food 杩佺Щ鏍稿績鍔熻兘锛屼笖浼氱粰鍚庣画浠撳簱瀹夊叏瀹¤甯︽潵棰濆椋庨櫓銆?
鍒ゆ柇锛?- `涓嶅奖鍝嶈縼绉诲畬鎴愬害`
- `褰卞搷鏈€缁堟彁浜ゅ畨鍏ㄦ€

### 涓紭鍏堢骇闂

1. 浠撳簱閲屼粛鏈変笌 food 涓荤嚎鏃犵洿鎺ュ叧绯荤殑骞惰鏀瑰姩锛屽綋鍓嶄笉閫傚悎鏁翠綋鎵撳寘鎻愪氦銆?
璇佹嵁锛?- `git status` 涓粛鏈夎繖浜涢潪 food 鏍稿績鏀瑰姩锛?  - `backend/app/config.py`
  - `backend/.env.example`
  - `frontend/src/components/Footer.tsx`
  - `frontend/src/components/Navbar.tsx`
  - `frontend/src/pages/HomePage.tsx`
  - `foodidentity/`
  - `info/FOOD_MIGRATION_STAGE1_DESIGN_2026-04-05.md`

褰卞搷锛?- 浼氭ā绯婃湰娆?food 杩佺Щ鐨勬彁浜よ竟鐣屻€?- 浼氳浠ｇ爜瀹℃煡鑰呴毦浠ュ尯鍒嗏€渇ood 姝ｅ紡杩佺Щ浜嬪疄鈥濅笌鈥滀粨搴撻噷鍘熸湰瀛樺湪鐨勫叾浠栨敼鍔ㄢ€濄€?
鍒ゆ柇锛?- `涓嶅奖鍝嶅綋鍓嶈繍琛屾椂缁撹`
- `褰卞搷鎻愪氦娓呮櫚搴

2. 浠撳簱鏂囨。涓粛鏈夐檲鏃ф弿杩帮紝璇存槑杩愯鏃跺凡缁忓畬鎴愭敹鏁涳紝浣嗘枃妗ｄ綋绯诲皻鏈畬鍏ㄥ悓姝ャ€?
璇佹嵁锛?- [`info/PROJECT_STATUS.md`](/d:/trae/trae_projects/AI-FIT/info/project/PROJECT_STATUS.md#L68)
- [`info/PROJECT_STATUS.md`](/d:/trae/trae_projects/AI-FIT/info/project/PROJECT_STATUS.md#L72)

褰卞搷锛?- 浠ｇ爜浜嬪疄宸茬粡鏄剧ず legacy API 涓嬬嚎锛屼絾閮ㄥ垎椤圭洰鐘舵€佹枃妗ｄ粛鎻愬埌 `/api/diets` 涓?`/api/nutrition`銆?- 浼氶€犳垚鈥滄棩蹇椼€佷唬鐮併€佺姸鎬佹枃妗ｂ€濅笁鑰呰〃杩颁笉瀹屽叏涓€鑷淬€?
鍒ゆ柇锛?- `涓嶆槸杩佺Щ闃诲椤筦
- `灞炰簬鍚庣画鏂囨。鏀跺彛椤筦

### 浣庝紭鍏堢骇闂

1. `ProfilePage` 宸茬粡鍒囧埌姝ｅ紡 meals 鍘嗗彶鎺ュ彛锛屼絾璇ユ枃浠舵湰韬粛瀛樺湪鍘嗗彶缂栫爜闂锛屼笉瀹滀綔涓烘湰娆?food 杩佺Щ璐ㄩ噺缁撹鐨勫弽鍚戣瘉鎹€?
璇佹嵁锛?- [`frontend/src/pages/ProfilePage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/ProfilePage.tsx#L193)
- [`frontend/src/pages/ProfilePage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/ProfilePage.tsx#L194)
- [`frontend/src/pages/ProfilePage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/ProfilePage.tsx#L412)

褰卞搷锛?- 璇ラ〉宸茬粡涓嶅啀渚濊禆 `/api/diets`锛岃繖涓€鐐规槸姝ｅ悜瀹屾垚椤广€?- 浣嗛〉闈腑娈嬬暀鐨勫巻鍙茬紪鐮侀棶棰樿鏄庤繖閮ㄥ垎灞炰簬浠撳簱宸叉湁璐ㄩ噺鍊猴紝涓嶅缓璁妸瀹冧笌鏈 food 杩佺Щ涓荤嚎娣蜂负涓€璋堛€?
鍒ゆ柇锛?- `涓嶆瀯鎴?food 杩佺Щ澶辫触`
- `灞炰簬鐙珛鍓嶇璐ㄩ噺鍊篳

## 涓夈€佸榻愮煩闃?
### 1. 姝ｅ紡鍓嶇鍏ュ彛

鐘舵€侊細`宸插榻恅

宸茬‘璁ゅ畬鎴愶細

- 姝ｅ紡鍏ュ彛涓?`/food`
- 姝ｅ紡椁愭椤典负 `/food/meal/:mealType`
- `/tools/food` 宸叉敼涓洪噸瀹氬悜鍒?`/food`

璇佹嵁锛?- [`frontend/src/App.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/App.tsx#L33)
- [`frontend/src/App.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/App.tsx#L34)
- [`frontend/src/App.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/App.tsx#L36)

缁撹锛?- 鍓嶇姝ｅ紡杩愯闈㈠凡缁忓畬鎴愬崟鍏ュ彛鏀舵暃銆?
### 2. 姝ｅ紡鍚庣鍏ュ彛

鐘舵€侊細`宸插榻恅

宸茬‘璁ゅ畬鎴愶細

- 娉ㄥ唽姝ｅ紡 `food / foods / meals / recognize` 钃濆浘
- 鏈户缁敞鍐?`diets` 涓?`nutrition`

璇佹嵁锛?- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L47)
- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L48)
- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L49)
- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L51)
- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L62)
- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L63)
- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L64)
- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L66)

缁撹锛?- legacy API 宸茬粡浠庤繍琛屾椂娉ㄥ唽灞傞潰閫€鍑恒€?
### 3. 姝ｅ紡鏁版嵁妯″瀷

鐘舵€侊細`宸插榻恅

宸茬‘璁ゅ畬鎴愶細

- 鏂版ā鍨嬭惤涓?`foods`
- 鏂版ā鍨嬭惤涓?`meal_records`
- 鏂版ā鍨嬭惤涓?`meal_items`
- `User` 鍏宠仈鍒囧埌 `food_meal_records`
- `DietRecord` 宸蹭粠涓诲共绉婚櫎

璇佹嵁锛?- [`backend/app/models.py`](/d:/trae/trae_projects/AI-FIT/backend/app/models.py#L48)
- [`backend/app/models.py`](/d:/trae/trae_projects/AI-FIT/backend/app/models.py#L70)
- [`backend/app/models.py`](/d:/trae/trae_projects/AI-FIT/backend/app/models.py#L87)
- [`backend/app/models.py`](/d:/trae/trae_projects/AI-FIT/backend/app/models.py#L100)

缁撹锛?- food 鏁版嵁妯″瀷宸茬粡杩佸叆 AI-FIT 姝ｅ紡涓诲共锛屼笉鍐嶄緷闄勬棫 diets 妯″瀷銆?
### 4. meals 姝ｅ紡闂幆

鐘舵€侊細`宸插榻恅

宸茬‘璁ゅ畬鎴愶細

- `GET /api/meals/today`
- `GET /api/meals/history`
- `GET /api/meals/<id>`
- `POST /api/meals`
- `DELETE /api/meals/<id>`
- meals 鎺ュ彛鍩轰簬 JWT 鐢ㄦ埛韬唤
- 绌?items銆侀潪娉?foodId銆侀潪娉曟棩鏈熶細琚槑纭嫆缁?
璇佹嵁锛?- [`backend/app/routes/meals.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/meals.py#L59)
- [`backend/app/routes/meals.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/meals.py#L95)
- [`backend/app/routes/meals.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/meals.py#L117)
- [`backend/app/routes/meals.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/meals.py#L127)
- [`backend/app/routes/meals.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/meals.py#L185)
- [`backend/tests/test_food.py`](/d:/trae/trae_projects/AI-FIT/backend/tests/test_food.py#L30)
- [`backend/tests/test_food.py`](/d:/trae/trae_projects/AI-FIT/backend/tests/test_food.py#L79)
- [`backend/tests/test_food.py`](/d:/trae/trae_projects/AI-FIT/backend/tests/test_food.py#L96)
- [`backend/tests/test_food.py`](/d:/trae/trae_projects/AI-FIT/backend/tests/test_food.py#L113)

缁撹锛?- meals 宸插叿澶囨寮忓彲鐢ㄧ殑淇濆瓨銆佹煡璇€佸垹闄や笌鍘嗗彶鏌ヨ鑳藉姏锛屼笉鍐嶆槸 legacy 鍏煎灞傘€?
### 5. recognize 姝ｅ紡閾捐矾

鐘舵€侊細`宸插榻恅

宸茬‘璁ゅ畬鎴愶細

- `POST /api/recognize` 鐩存帴鍦?AI-FIT 鍚庣鎻愪緵
- 缂哄皯 Stepfun 閰嶇疆鏃惰繑鍥?`503 stepfun not configured`
- 鎴愬姛鏃惰繑鍥?`names / foodIds / unmatchedNames`

璇佹嵁锛?- [`backend/app/routes/recognize.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/recognize.py#L12)
- [`backend/app/routes/recognize.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/recognize.py#L18)
- [`backend/app/routes/recognize.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/recognize.py#L31)
- [`backend/app/routes/recognize.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/recognize.py#L41)
- [`backend/tests/test_food_recognize.py`](/d:/trae/trae_projects/AI-FIT/backend/tests/test_food_recognize.py#L23)

缁撹锛?- recognize 姝ｅ紡鍏ュ彛宸茬粡杩佸叆涓婚」鐩紝涓斿け璐ヨ矾寰勬湁鏄庣‘琛屼负瀹氫箟銆?
### 6. 姝ｅ紡棣栭〉涓庨娆￠〉鎵挎帴

鐘舵€侊細`宸插榻恅

宸茬‘璁ゅ畬鎴愶細

- `/food` 宸叉壙鎺ヤ粖鏃ユ瑙堜笌鍥涢鍏ュ彛
- `/food/meal/:mealType` 宸叉壙鎺ユ悳绱€佽瘑鍒€佸姞椁愩€佸厠鏁拌皟鏁淬€佷繚瀛樸€佸垹闄?- 闈炴硶椁愭璺敱浼氭槑纭彁绀猴紝鑰屼笉鏄潤榛樺洖閫€

璇佹嵁锛?- [`frontend/src/pages/FoodModulePage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/FoodModulePage.tsx#L54)
- [`frontend/src/pages/FoodModulePage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/FoodModulePage.tsx#L173)
- [`frontend/src/pages/FoodModulePage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/FoodModulePage.tsx#L261)
- [`frontend/src/pages/FoodMealPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/FoodMealPage.tsx#L83)
- [`frontend/src/pages/FoodMealPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/FoodMealPage.tsx#L210)
- [`frontend/src/pages/FoodMealPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/FoodMealPage.tsx#L255)
- [`frontend/src/pages/FoodMealPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/FoodMealPage.tsx#L280)
- [`frontend/src/pages/FoodMealPage.tsx`](/d:/trae/trae_projects/AI-FIT/frontend/src/pages/FoodMealPage.tsx#L303)

缁撹锛?- 姝ｅ紡 food 鍓嶇椤甸潰宸茬粡涓嶆槸鍗犱綅椤碉紝鑰屾槸鍏峰涓氬姟闂幆鐨勬寮忔壙鎺ラ潰銆?
### 7. 瀵?`foodidentity` 鐨勮繍琛屾椂渚濊禆

鐘舵€侊細`宸插榻恅

宸茬‘璁ゅ畬鎴愶細

- 姝ｅ紡杩愯鏃朵唬鐮佹湭鍐嶇洿鎺?import `foodidentity`
- seed 涓?runtime catalog 宸茶惤鍒颁富椤圭洰鍚庣
- 瀹炴柦鏂规瑕佹眰鐨勨€滀富椤圭洰鐙珛鎵挎帴姝ｅ紡 food 鑳藉姏鈥濆凡鍩烘湰婊¤冻

璇佹嵁锛?- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L8)
- [`backend/app/__init__.py`](/d:/trae/trae_projects/AI-FIT/backend/app/__init__.py#L80)
- [`backend/app/routes/food.py`](/d:/trae/trae_projects/AI-FIT/backend/app/routes/food.py#L21)
- 浠ｇ爜妫€绱㈡湭鍙戠幇褰撳墠姝ｅ紡鍓嶅悗绔繍琛屾椂浠ｇ爜鐩存帴渚濊禆 `foodidentity` 鐩綍

缁撹锛?- `foodidentity` 褰撳墠鏇存帴杩戔€滆縼绉绘潵婧愬伐绋嬧€濓紝鑰屼笉鏄寮忚繍琛屾椂渚濊禆銆?
## 鍥涖€佷笉搴旇鍒や负杩佺Щ澶辫触鐨勯棶棰?
浠ヤ笅鍐呭涓嶅簲绠椾綔鏈 food 杩佺Щ澶辫触锛?
- `foodidentity/` 鐩綍浠嶅瓨鍦ㄥ伐浣滃尯
  - 杩佺Щ鏂规瑕佹眰鐨勫叧閿偣鏄€滄寮忚繍琛屾椂涓嶅啀渚濊禆瀹冣€濓紝涓嶆槸蹇呴』鍦ㄦ湰杞珛鍒荤墿鐞嗗垹闄ゆ暣涓洰褰曘€?- `ProfilePage`銆乣Navbar`銆乣Footer`銆乣HomePage` 绛夋枃浠朵粛鏈夊苟琛屾敼鍔?  - 杩欎細褰卞搷鎻愪氦杈圭晫锛屼絾涓嶆帹缈绘寮?food 閾捐矾宸茬粡鏀舵暃鐨勪簨瀹炪€?- 璇嗗埆鎺ュ彛鍦ㄦ湭閰嶇疆 Stepfun 鏃惰繑鍥?`503`
  - 杩欐槸鏄庣‘璁捐鐨勯厤缃墠缃潯浠讹紝涓嶆槸杩佺Щ鏈畬鎴愩€?
## 浜斻€佹渶缁堣瘎浼?
褰撳墠 food 杩佺Щ瀹屾垚搴﹀彲鍒嗕负锛?
- `姝ｅ紡杩愯鏃舵敹鏁涘害`锛氶珮
- `涓庡疄鏂芥柟妗堢殑涓€鑷存€锛氶珮
- `legacy 杩愯闈㈡竻鐞嗗畬鎴愬害`锛氶珮
- `鏈€缁堟彁浜よ竟鐣屾竻鏅板害`锛氫腑
- `鎻愪氦鍓嶅畨鍏ㄥ崼鐢熺姸鎬乣锛氫腑鍋忎綆

寤鸿鐨勬渶缁堝姩浣滈『搴忥細

1. 鍏堝皢 [`backend/.env.example`](/d:/trae/trae_projects/AI-FIT/backend/.env.example#L8) 涓殑 `STEPFUN_API_KEY` 鏀瑰洖鏄惧紡鍗犱綅绗︼紝鍐嶅喅瀹氭槸鍚︾撼鍏ユ湰娆℃彁浜ゃ€?2. 涓ユ牸鎸?food 涓荤嚎绛涢€夋彁浜ゆ枃浠讹紝涓嶈鎶?`backend/app/config.py`銆乣foodidentity/` 涓庡叾浠栧苟琛屾敼鍔ㄩ粯璁ゆ贩鍏ャ€?3. 濡傞渶琛ユ枃妗ｄ竴鑷存€э紝鍐嶅悓姝ユ洿鏂?[`info/PROJECT_STATUS.md`](/d:/trae/trae_projects/AI-FIT/info/project/PROJECT_STATUS.md#L68) 涓?[`info/PROJECT_STATUS.md`](/d:/trae/trae_projects/AI-FIT/info/project/PROJECT_STATUS.md#L72)銆?
搴曠嚎缁撹锛?
- 杩欐 food 杩佺Щ宸茬粡鏄湡瀹炲畬鎴愮殑姝ｅ紡杩佺Щ锛屼笉鏄€滀繚鐣?legacy 杩愯闈⑩€濈殑鍗婅縼绉荤姸鎬併€?- 褰撳墠鏈€涓昏鐨勫墿浣欓棶棰樹笉鏄姛鑳界己鍙ｏ紝鑰屾槸鏈€缁堟彁浜よ竟鐣屼笌绀轰緥閰嶇疆瀹夊叏鎬с€?


