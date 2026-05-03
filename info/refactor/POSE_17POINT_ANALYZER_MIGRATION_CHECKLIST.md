# 缁熶竴鏀?Analyzer 鍏ㄩ儴鍚?MoveNet 17 鐐癸細杩佺Щ娓呭崟锛圓I-FIT锛?

鐩殑锛氬皢鍔ㄤ綔鍒嗘瀽锛堣娆?绾犻敊锛夌粺涓€鍒囨崲涓?**MoveNet 17 鐐癸紙MoveNetKeypoint[]锛屾寜 name 鍙栫偣锛?* 浣滀负鍞竴杈撳叆璇箟锛岄€愭鍘绘帀瀵?**MediaPipe 33 landmarks锛堝惈 MoveNet鈫掍吉 33锛?* 鐨勪緷璧栵紝鏂逛究绋冲畾鍖栥€侀檷浣庘€?3/17 娣风敤鍙ｅ緞鈥濋闄╋紝骞朵负鍚庣画鈥滃彧浼?nativeKeypoints鈥濆仛閾哄灚銆?

鏈枃浠跺彧璁板綍鈥滆縼绉婚『搴?+ 姣忎釜鍔ㄤ綔鐨?33 绱㈠紩鐐逛綅鏇挎崲娓呭崟 + 澶嶇幇鎵€闇€淇℃伅鈥濓紝涓嶅寘鍚疄鐜扮粏鑺傘€?

棰濆绾︽潫锛堝懡鍚嶈鑼冿級锛?
- 闄ゆ湰 md 鏂囨。澶栵紝浠ｇ爜涓庢枃浠跺懡鍚嶄腑涓嶅嚭鐜?鈥滃姩浣滃悕+鏁板瓧鈥濓紙渚嬪 Pullup17銆丼quat17锛夈€?
- 杩佺Щ瀹屾垚鍚庯紝闈㈠悜涓氬姟鐨?analyzer 鍛藉悕缁熶竴浣跨敤涓嶅甫鏁板瓧鐨勫悕绉帮紙渚嬪 `RealtimePullupAnalyzer`锛夈€?

---

## 0. 褰撳墠閾捐矾鍏抽敭浜嬪疄锛堢敤浜庡鐜帮級

- 瀹炴椂鎺ㄧ悊鏉ヨ嚜 MoveNet锛宲rovider 鍙繑鍥烇細
  - `nativeKeypoints`锛歁oveNet 鍘熺敓 17 鐐癸紙x/y/score/name锛?
- 椤甸潰瀹炴椂鍒嗘瀽鍙蛋 `analyzeNative(nativeKeypoints)`锛堜笉鍐嶅瓨鍦?`analyze(landmarks)` 鍥為€€鍒嗘敮锛夛細
  - 浣嶇疆锛歔PoseToolPage.tsx](file:///g:/瀛︽牎/澶у洓涓?姣曡/AI-FIT/frontend/src/pages/PoseToolPage.tsx)
- analyzer 鍒涘缓鍏ュ彛锛堥〉闈?helpers锛夛細
  - 浣嶇疆锛歔analyzers.ts](file:///g:/瀛︽牎/澶у洓涓?姣曡/AI-FIT/frontend/src/pages/poseTool/helpers/analyzers.ts)

缁撹锛?*鍙鏌愪釜鍔ㄤ綔 analyzer 澧炲姞/瀹屽杽 analyzeNative(17鐐? 骞跺湪鍐呴儴涓嶅啀渚濊禆 33 绱㈠紩锛屽疄鏃堕摼璺氨浼氳嚜鐒跺紑濮嬩娇鐢?17 鐐广€?*

---

## 1. 缁熶竴绱㈠紩鏄犲皠锛?3 鈫?17锛?

浠ヤ笅鏄€淢ediaPipe Pose 33 landmarks 鐨勫父鐢ㄧ储寮曗€濅笌 MoveNet 17 鍏抽敭鐐?name 鐨勫搴斿叧绯伙紙椤圭洰閲屽涓?analyzer 宸插啓姝讳娇鐢ㄨ繖濂楃储寮曪級銆?

| MediaPipe idx | MoveNet name |
|---:|---|
| 0 | nose |
| 2 | left_eye |
| 5 | right_eye |
| 7 | left_ear |
| 8 | right_ear |
| 11 | left_shoulder |
| 12 | right_shoulder |
| 13 | left_elbow |
| 14 | right_elbow |
| 15 | left_wrist |
| 16 | right_wrist |
| 23 | left_hip |
| 24 | right_hip |
| 25 | left_knee |
| 26 | right_knee |
| 27 | left_ankle |
| 28 | right_ankle |

娉ㄦ剰锛?
- MediaPipe 33 閲?29..32锛坔eel/foot_index锛夊湪 MoveNet 17 涓笉瀛樺湪锛涘鏋滄煇澶勭敤鍒颁簡杩欎簺绱㈠紩锛岄渶瑕佹敼璁捐锛堟敼鐢?ankle/knee 鐨勪唬鐞嗙壒寰侊紝鎴栧紩鍏ョ湡姝ｇ殑 33 鐐规ā鍨嬶級銆?
- 澶氫釜 analyzer 鐨?`issues[].joints: number[]` 鐩墠浠嶅湪鐢?**MediaPipe 绱㈠紩** 鎴栤€滀緷璧?side 鍔ㄦ€侀€夋嫨鐨勭储寮曗€濄€傚鏋滄渶缁堣鈥滃叏閾捐矾涓嶅惈 33 璇箟鈥濓紝杩欓噷寤鸿鏀规垚 `MoveNetName[]` 鎴栬€呮敼涓衡€?7鐐归『搴忕储寮曗€濆苟缁熶竴涓€濂?17-index 瀹氫箟銆?

---

## 2. 鎸夊姩浣滆縼绉婚『搴忥紙鎺ㄨ崘锛?

鎺掑簭鍘熷垯锛氫紭鍏堣縼绉烩€滃綋鍓嶅畬鍏ㄤ緷璧?33 鐐圭储寮曗€濈殑鍔ㄤ綔锛堟敹鐩婃渶澶э級锛屽叾娆℃竻鐞嗏€滃凡鍏峰 17 鐐归€昏緫浣嗕粛娈嬬暀 33 绱㈠紩閫傞厤灞?issue.joints鈥濈殑鍔ㄤ綔锛堟敹灏惧幓鑰﹀悎锛夈€?

1) Push-Up锛堝綋鍓?33-only锛屼紭鍏堝畬鎴愶級
2) Pull-Up锛堝綋鍓嶅疄鐜版枃浠跺悕/绫诲悕甯?17锛岄渶瑕佲€滃幓 17 鍛藉悕鈥濆苟纭繚鍙悆 17 鐐癸級
3) Lateral Raise锛堝悓涓婏級
4) Deep Squat锛堝悓涓婏級

Bench Press锛?
- 褰撳墠鍓嶇宸查殣钘忚鍔ㄤ綔锛屾湰杞笉瀹炵幇銆?
- 鏈疆鐩爣鏄€滄敞閲婃帀/鍋滅敤 Bench Press 鐨勫疄鐜颁笌鎺ュ叆鐐光€濓紝閬垮厤鍚庣画璇敤涓庣淮鎶ゆ垚鏈€?

---

## 3. 姣忎釜鍔ㄤ綔鐨勨€?3 绱㈠紩鏇挎崲娓呭崟鈥?

### 3.1 Bench Press锛堟湰杞仠鐢紝涓嶅仛 17 鐐硅縼绉伙級

- 鍏ュ彛鏂囦欢/绫伙細
  - [realtimeBenchPress.ts](file:///g:/瀛︽牎/澶у洓涓?姣曡/AI-FIT/frontend/src/lib/pose/realtimeBenchPress.ts)
  - `RealtimeBenchPressAnalyzer`
- 鏈疆澶勭悊缁撴灉锛堝凡瀹屾垚锛夛細
  - [x] 鍓嶇涓嶅啀鏆撮湶 Bench Press 鐨?slug/鍏ュ彛锛堥€夋嫨椤点€乪xercise 瀹氫箟銆乭elpers types/鏄犲皠鍧囩Щ闄わ級
  - [x] report builder 鍏ュ彛宸插仠鐢紙瀵瑰簲 helper 淇濈暀浣嗙洿鎺ユ姏閿欙級
  - [x] 涓氬姟閾捐矾涓嶅啀鍒涘缓/璋冪敤 Bench Press analyzer锛堥伩鍏嶈鐢?33 绱㈠紩璇箟锛?

### 3.2 Push-Up锛堜紭鍏堝畬鎴愶級

- 鍏ュ彛鏂囦欢/绫伙細
  - [realtimePushup.ts](file:///g:/瀛︽牎/澶у洓涓?姣曡/AI-FIT/frontend/src/lib/pose/realtimePushup.ts)
  - `RealtimePushupAnalyzer`
- 鐜扮姸锛?
  - `analyze(landmarks)` 浣跨敤 33 绱㈠紩鍙?shoulder/elbow/wrist/hip/knee/ankle 绛?
  - `chooseSide(landmarks)` 浣跨敤 33 绱㈠紩闆嗗悎绱姞 visibility
  - `trackingQuality` 浣跨敤 `avgVisibility(landmarks,[...])`
- 闇€瑕佹浛鎹㈢殑绱㈠紩锛?
  - 鑲╋細11/12
  - 鑲橈細13/14
  - 鑵曪細15/16
  - 楂嬶細23/24
  - 鑶濓細25/26
  - 韪濓細27/28
- side 閫夋嫨锛堝師閫昏緫浣跨敤鐨勭储寮曢泦鍚堬級锛?
  - leftVis 绱姞锛歔11,13,15,23,25,27]
  - rightVis 绱姞锛歔12,14,16,24,26,28]
- trackingQuality 璁＄畻锛堝師閫昏緫浣跨敤鐨勭储寮曢泦鍚堬級锛?
  - `[11,12,13,14,15,16,23,24,25,26,27,28]`
- issue.joints锛堝綋鍓嶄负 33 绱㈠紩锛夛細
  - hips sagging joints: `[11,12,23,24,27,28]`
- 杩佺Щ鐩爣锛堝姩浣滅骇鍒級锛?
  - [x] 鏀逛负鍙毚闇?`analyzeNative(keypoints17)`锛屽唴閮ㄦ寜 name 鍙栫偣
  - [x] 缃俊搴﹂棬鎺х粺涓€浣跨敤 `score`
  - [x] `issues[].joints` 缁熶竴涓?`MoveNetName[]`

### 3.3 Pull-Up锛堝幓 鈥?7鈥?鍛藉悕 + 鍙悆 17 鐐癸級

- 鍏ュ彛鏂囦欢/绫伙細
  - 褰撳墠锛?[realtimePullup.ts](file:///g:/瀛︽牎/澶у洓涓?姣曡/AI-FIT/frontend/src/lib/pose/realtimePullup.ts) / `RealtimePullupAnalyzer`
- 鐜扮姸锛?
  - [x] 鏂扮増 analyzer 浠?`analyzeNative(keypoints17)`锛堜笉鍐嶆彁渚?`analyze(landmarks)` 鍥為€€鍏ュ彛锛?
  - [x] legacy 瀹炵幇淇濈暀浣嗘敼鍚嶄负 `RealtimePullupLegacyAnalyzer`锛屼笖 `issues[].joints` 宸叉敼涓?`MoveNetName[]`
- 杩佺Щ鐩爣锛堝姩浣滅骇鍒級锛?
  - [x] 瀹屾垚鈥滃幓 17 鍛藉悕鈥濆苟纭繚 createAnalyzer 鍙寚鍚戞柊鐗?analyzer

### 3.4 Lateral Raise锛堝幓 鈥?7鈥?鍛藉悕 + 鍙悆 17 鐐癸級

- 鍏ュ彛鏂囦欢/绫伙細
  - 褰撳墠锛?[realtimeLateralRaise.ts](file:///g:/瀛︽牎/澶у洓涓?姣曡/AI-FIT/frontend/src/lib/pose/realtimeLateralRaise.ts) / `RealtimeLateralRaiseAnalyzer`
- 鐜扮姸锛?
  - [x] 鏂扮増 analyzer 浠?`analyzeNative(keypoints17)`锛堜笉鍐嶆彁渚?`analyze(landmarks)` 鍥為€€鍏ュ彛锛?
  - [x] legacy 瀹炵幇淇濈暀浣嗘敼鍚嶄负 `RealtimeLateralRaiseLegacyAnalyzer`锛屼笖 `issues[].joints` 宸叉敼涓?`MoveNetName[]`
- 杩佺Щ鐩爣锛堝姩浣滅骇鍒級锛?
  - [x] 瀹屾垚鈥滃幓 17 鍛藉悕鈥濆苟纭繚 createAnalyzer 鍙寚鍚戞柊鐗?analyzer

### 3.5 Deep Squat锛堝幓 鈥?7鈥?鍛藉悕 + 鍙悆 17 鐐癸級

- 鍏ュ彛鏂囦欢/绫伙細
  - 褰撳墠锛?[realtimeSquatAnalyzer.ts](file:///g:/瀛︽牎/澶у洓涓?姣曡/AI-FIT/frontend/src/lib/pose/realtimeSquatAnalyzer.ts) / `RealtimeSquatAnalyzer`
- 鐜扮姸锛?
  - [x] 鏂扮増 analyzer 浠?`analyzeNative(keypoints17)`锛堜笉鍐嶆彁渚?`analyze(landmarks)` 鍥為€€鍏ュ彛锛?
  - [x] `issues[].joints` 缁熶竴涓?`MoveNetName[]`
- 杩佺Щ鐩爣锛堝姩浣滅骇鍒級锛?
  - [x] 瀹屾垚鈥滃幓 17 鍛藉悕鈥濆苟纭繚 createAnalyzer 鍙寚鍚戞柊鐗?analyzer

---

## 4. 杩佺Щ瀹屾垚鐨勫垽瀹氭竻鍗曪紙鍙洿鎺ュ嬀閫夛級

- 鍔ㄤ綔 analyzer 灞傦細
  - [x] 鎵€鏈夊姩浣?analyzer 閮芥彁渚涘苟浣跨敤 `analyzeNative(MoveNetKeypoint[])`
  - [x] 涓氬姟閾捐矾涓嶅啀璋冪敤 `analyze(landmarks)`锛屼笉鍐嶄緷璧?33 绱㈠紩璇箟
  - [x] analyzer 鍐呴儴鎵€鏈夌疆淇″害闂ㄦ帶缁熶竴浣跨敤 `score`
- 椤甸潰/鏁版嵁娴佸眰锛?
  - [x] 瀹炴椂鍙緷璧?`nativeKeypoints`
  - [x] 绂荤嚎鍥炴斁鍙緷璧?17 鐐瑰簭鍒楋紙nativeFrames锛?
- 杈呭姪缁撴瀯锛?
  - [x] `issues[].joints` 缁熶竴涓?`MoveNetName[]`
  - [x] 涓氬姟閾捐矾宸茬Щ闄?鈥淢oveNet 鈫?浼?33鈥?鐨勫吋瀹瑰眰鍏ュ彛锛岄伩鍏嶈璇敤

---

## 5. 鍛藉悕涓庨噸鍛藉悕绛栫暐锛堥伩鍏?鈥滃姩浣滃悕+鏁板瓧鈥濓級

鐢变簬浠撳簱鍐呭悓鏃跺瓨鍦ㄢ€滄棫鐗堬紙33绱㈠紩锛夆€濅笌鈥滄柊鐗堬紙17鐐癸級鈥濈殑瀹炵幇鏂囦欢锛岀洿鎺ラ噸鍛藉悕鍙兘鍙戠敓鍚屽悕鍐茬獊銆傚缓璁噰鐢ㄥ涓嬬瓥鐣ヤ箣涓€锛屽苟鍦ㄨ縼绉绘椂鍏ㄤ粨缁熶竴鎵ц锛?

鏂规 A锛堟帹鑽愶紝鏄庣‘ legacy锛夛細
- 灏嗘棫鐗堬紙33绱㈠紩锛夋枃浠舵敼鍚嶄负 `realtime<Exercise>Legacy.ts`锛岀被鍚嶆敼涓?`Realtime<Exercise>LegacyAnalyzer`
- 灏嗘柊鐗堬紙17鐐癸級鏂囦欢鏀瑰悕涓?`realtime<Exercise>.ts`锛岀被鍚嶆敼涓?`Realtime<Exercise>Analyzer`

鏂规 B锛堟槑纭?v1/v2锛屼絾涓嶄娇鐢ㄦ暟瀛楀悗缂€锛夛細
- 鏃х増锛歚realtime<Exercise>Classic.ts` / `Realtime<Exercise>ClassicAnalyzer`
- 鏂扮増锛歚realtime<Exercise>.ts` / `Realtime<Exercise>Analyzer`

鎵ц瑕佹眰锛?
- 浠ｇ爜涓庢枃浠跺懡鍚嶄笉鍑虹幇 17/33 绛夋暟瀛楀悗缂€
- `createAnalyzer` 鏄犲皠鍙寚鍚戔€滀笉鍚暟瀛椻€濈殑 analyzer
- 瀵瑰 slug/灞曠ず鍚嶄繚鎸佷笉鍙橈紙渚嬪 `pushup`銆乣pullup`銆乣lateral-raise`銆乣squat`锛夛紝浠呭唴閮ㄥ疄鐜扮被/鏂囦欢鏇村悕

