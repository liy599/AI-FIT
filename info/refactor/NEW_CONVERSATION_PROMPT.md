# 鏂板璇濇彁绀鸿瘝锛氬皢 Pull-Up 鏇挎崲涓?Bent-Over Row

---

## 瀵硅瘽寮€澶存彁绀鸿瘝锛堢洿鎺ュ鍒朵娇鐢級

```
璇烽槄璇讳互涓嬩换鍔¤鏄庯紝瀹屾垚 Pull-Up 鍒?Bent-Over Row 鐨勬浛鎹細

## 浠诲姟鐩爣
灏?AI-FIT 椤圭洰涓殑 Pull-Up锛堝紩浣撳悜涓婏級鏇挎崲涓?Bent-Over Row锛堜刊韬搼閾冨垝鑸癸級銆?

## 鍏蜂綋瑕佹眰

### 1. 鍓嶇椤甸潰 - Pose 閫夋嫨鍗＄墖
- 鏂囦欢锛歚frontend/src/pages/PoseSelectPage.tsx`
- 灏?Pull-Up 鍗＄墖鏀逛负锛?
  - 鍚嶇О锛歚Bent-Over Row`
  - 灏忔爣棰橈細`Bodyweight` 鈫?`Dumbbell`
  - 鍥剧墖锛歚/assets/images/pose/Bent-Over Row.jpg`

### 2. 鍓嶇宸ュ叿椤甸潰
- 鏂囦欢锛歚frontend/src/pages/PoseToolPage.tsx`
- 璺敱/宸ュ叿鍏ュ彛鍙傜収鍒殑鍔ㄤ綔锛堝 Push-Up銆丩ateral Raise锛変慨鏀?
- 纭繚瀹炴椂鍜岀绾挎ā寮忛兘鑳芥甯歌烦杞?

### 3. 淇濈暀 Pull-Up 浠ｇ爜锛堟敞閲婁笉鍒犻櫎锛?
- 鏂囦欢锛歚frontend/src/lib/pose/realtimePullup.ts`
- **淇濈暀鍏ㄩ儴浠ｇ爜锛屼粎娉ㄩ噴鎺?*锛屾坊鍔犳敞閲婅鏄?

### 4. 瀹炵幇 Bent-Over Row

#### 4.1 鏂板缓 analyzer
- 鏂囦欢锛歚frontend/src/lib/pose/realtimeBentOverRow.ts`
- 鍙傜収锛歚realtimeLateralRaise.ts` 鎴?`realtimePushup.ts`
- 鍔ㄤ綔瑕佺偣锛?
  - 璧峰锛氫刊韬紝鍝戦搩涓嬪瀭锛岄珛瑙掔害 45-90掳
  - 鍙戝姏锛氬搼閾冨悜涓婃媺锛岃倶閮ㄨ创杩戣韩浣?
  - 椤跺嘲锛氬搼閾冨埌鑳搁儴楂樺害锛岃偐鑳涢鏀剁缉
  - 涓嬫斁锛氱紦鎱㈡帶鍒朵笅鏀撅紝淇濇寔寮犲姏
- 鍏抽敭妫€娴嬬偣锛?7鐐癸級锛歭eft/right shoulder, elbow, wrist, hip
- 棰勬湡 issues锛歜ack_not_flat, elbow_flaring, incomplete_pull, using_momentum

#### 4.2 鏂板缓鎶ュ憡
- 鏂囦欢锛歚frontend/src/pages/poseTool/helpers/bentOverRowReport.ts`
- 鍙傜収锛歚lateralRaiseReport.ts` 鎴?`pushupReport.ts`

#### 4.3 淇敼 Suggestion 鏄犲皠
- 鏂囦欢锛歚frontend/src/pages/poseTool/helpers/suggestionMap.ts`
- 娣诲姞 Bent-Over Row 鐨?suggestion 鏄犲皠

#### 4.4 淇敼 createAnalyzer 宸ュ巶
- 鏂囦欢锛歚frontend/src/pages/poseTool/helpers/analyzers.ts`
- 娉ㄩ噴鎺?`createAnalyzer('pullup')`
- 娣诲姞 `createAnalyzer('bent-over-row')`

## 鍙傝€冩枃妗?
- 澶囦唤娓呭崟锛歚G:\瀛︽牎\澶у洓涓媆姣曡\AI-FIT\info\refactor\BENT_OVER_ROW_MIGRATION_BACKUP_2026-04-25.md`
- 17鐐硅鑼冿細`G:\瀛︽牎\澶у洓涓媆姣曡\AI-FIT\info\refactor\POSE_17POINT_ANALYZER_MIGRATION_CHECKLIST.md`

## 鍛藉悕瑙勮寖
- Slug锛歚bent-over-row`锛坘ebab-case锛?
- 绫诲悕锛歚RealtimeBentOverRowAnalyzer`
- 灞曠ず鍚嶏細`Bent-Over Row`

## 娉ㄦ剰浜嬮」
- Bent-Over Row 鏄弻渚у姩浣滐紙鍙屾墜鍚屾椂鎸佸搼閾冿級
- 寤鸿渚ц瑙嗚
- 瑙掑害闃堝€奸渶瑕佹牴鎹疄闄呮祴璇曡皟鏁?
- 娴嬭瘯鏃堕獙璇侊細瀹炴椂鎺ㄧ悊 + 绂荤嚎瑙嗛鍥炴斁
```

---

## 浣跨敤璇存槑

1. 澶嶅埗涓婃柟鎻愮ず璇?
2. 寮€鍚柊鐨?AI 瀵硅瘽
3. 绮樿创鎻愮ず璇嶅紑濮嬩换鍔?
4. 濡傛湁闂锛屽彲鍙傝€?`BENT_OVER_ROW_MIGRATION_BACKUP_2026-04-25.md` 鑾峰彇鏇村缁嗚妭

