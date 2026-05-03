# Pull-Up 鈫?Bent-Over Row 鏇挎崲浠诲姟澶囦唤

> 鍒涘缓鏃堕棿锛?026-04-25
> 鐩殑锛氬皢鍔ㄤ綔 Pull-Up 鏇挎崲涓?Bent-Over Row锛堜刊韬搼閾冨垝鑸癸級

---

## 1. 浠诲姟鐩爣

灏?AI-FIT 椤圭洰涓殑 **Pull-Up锛堝紩浣撳悜涓婏級** 鍔ㄤ綔鏇挎崲涓?**Bent-Over Row锛堜刊韬搼閾冨垝鑸癸級**銆?

---

## 2. 鍏蜂綋鏀瑰姩娓呭崟

### 2.1 鍓嶇椤甸潰 - Pose 閫夋嫨鍗＄墖

**鏂囦欢**锛歚frontend/src/pages/PoseSelectPage.tsx`

**鏀瑰姩**锛?
- 鎵惧埌 Pull-Up 鍗＄墖閰嶇疆
- 淇敼 `name`锛歚Pull-Up` 鈫?`Bent-Over Row`
- 淇敼 `subtitle`锛歚Bodyweight` 鈫?`Dumbbell`
- 鍥剧墖璺緞锛歚/assets/images/pose/Bent-Over Row.jpg`锛堝凡瀛樺湪锛?

---

### 2.2 鍓嶇璺敱/宸ュ叿椤甸潰

**鏂囦欢**锛歚frontend/src/pages/PoseToolPage.tsx`

**鏀瑰姩**锛?
- 璺敱/宸ュ叿鍏ュ彛锛氬皢 `/tools/pose/pullup/tool` 鐩稿叧閰嶇疆鏀逛负 Bent-Over Row
- 鍙傜収鍒殑鍔ㄤ綔锛堝 Push-Up銆丩ateral Raise锛夌殑瀹炵幇鏂瑰紡
- 纭繚瀹炴椂鍜岀绾挎ā寮忛兘鑳芥甯歌烦杞?

---

### 2.3 鍔ㄤ綔璇嗗埆浠ｇ爜

**鏂囦欢**锛歚frontend/src/lib/pose/realtimePullup.ts`

**鏀瑰姩**锛?
- **淇濈暀** Pull-Up 鐨?`RealtimePullupAnalyzer` 瀹炵幇浠ｇ爜
- **娉ㄩ噴鎺?*锛堜笉鍒犻櫎锛夊師鏈夊疄鐜?
- 娣诲姞 `// LEGACY: Pull-Up - commented out for Bent-Over Row` 绛夋敞閲?

---

### 2.4 鏂板姩浣滃疄鐜?

**鏂板鏂囦欢**锛歚frontend/src/lib/pose/realtimeBentOverRow.ts`

**鍙傜収**锛?
- `realtimePushup.ts` - 瀹屾暣鐨?analyzer 缁撴瀯
- `realtimeLateralRaise.ts` - 17鐐瑰疄鐜板弬鑰?

**Bent-Over Row 鍔ㄤ綔瑕佺偣**锛?

| 闃舵 | 鍏抽敭鐐?| 瑙掑害/瑙勫垯 |
|------|--------|-----------|
| 璧峰 | 淇韩锛屽搼閾冧笅鍨?| 楂嬭绾?45-90掳 |
| 鍙戝姏 | 鍝戦搩鍚戜笂鎷?| 鑲橀儴璐磋繎韬綋 |
| 椤跺嘲 | 鍝戦搩鍒拌兏閮ㄩ珮搴?| 鑲╄儧楠ㄦ敹缂?|
| 涓嬫斁 | 缂撴參鎺у埗涓嬫斁 | 淇濇寔寮犲姏 |

**鍏抽敭妫€娴嬬偣锛?7鐐癸級**锛?
- `left_shoulder` / `right_shoulder`
- `left_elbow` / `right_elbow`
- `left_wrist` / `right_wrist`
- `left_hip` / `right_hip`

**棰勬湡 issues 绫诲瀷**锛?
- `back_not_flat` - 鑳岄儴涓嶇洿
- `elbow_flaring` - 鑲橀儴澶栨拠
- `incomplete_pull` - 琛岀▼涓嶅畬鏁?
- `using_momentum` - 鍊熷姪鎯€?

---

### 2.5 鎶ュ憡鐢熸垚

**鏂囦欢**锛歚frontend/src/pages/poseTool/helpers/pullupReport.ts`

**澶勭悊鏂瑰紡**锛?
- 閲嶅懡鍚嶄负 `bentOverRowReport.ts`
- 鍙傜収鍒殑鍔ㄤ綔鎶ュ憡锛堝 `lateralRaiseReport.ts`锛夐噸鍐?
- 鍘?`pullupReport.ts` 娉ㄩ噴鎺夛紙淇濈暀浠ｇ爜锛?

---

### 2.6 Suggestion 鏄犲皠

**鏂囦欢**锛歚frontend/src/pages/poseTool/helpers/suggestionMap.ts`

**鏀瑰姩**锛?
- 娣诲姞 Bent-Over Row 鐨?suggestion 鏄犲皠
- Pull-Up 鐨?suggestion 娉ㄩ噴鎺?

---

### 2.7 createAnalyzer 宸ュ巶

**鏂囦欢**锛歚frontend/src/pages/poseTool/helpers/analyzers.ts`

**鏀瑰姩**锛?
- `createAnalyzer('pullup')` 娉ㄩ噴鎺?
- 娣诲姞 `createAnalyzer('bent-over-row')` 鎸囧悜鏂扮殑 Bent-Over Row analyzer

---

## 3. 鏀瑰姩浼樺厛绾?

1. **Phase 1**锛氶〉闈㈠崱鐗囦慨鏀癸紙瑙嗚鍙锛?
2. **Phase 2**锛氳矾鐢?宸ュ叿椤甸潰閫傞厤
3. **Phase 3**锛氫繚鐣?Pull-Up 浠ｇ爜 + 鍒涘缓 Bent-Over Row analyzer
4. **Phase 4**锛氭姤鍛婂拰 suggestion 鏄犲皠
5. **Phase 5**锛氭祴璇曢獙璇侊紙瀹炴椂 + 绂荤嚎锛?

---

## 4. 鍙傝€冨姩浣滃疄鐜?

寤鸿鍙傜収 `Lateral Raise` 鐨勫疄鐜版柟寮忥紝鍥犱负瀹冿細
- 宸茬粡鏄?17-only 瀹炵幇
- 缁撴瀯瀹屾暣锛堟湁 `analyzeNative`锛?
- issues 浣跨敤 `MoveNetName[]`
- 鏂囦欢锛歚frontend/src/lib/pose/realtimeLateralRaise.ts`

---

## 5. 娉ㄦ剰浜嬮」

- Bent-Over Row 鏄?*鍗曚晶**鎴?*鍙屼晶**鍔ㄤ綔锛熷缓璁厛鍋?*鍙屼晶**绠€鍖栫増鏈?
- 瑙嗚锛?*渚ц/鑳岄潰**鍧囧彲锛屽缓璁晶瑙?
- 瑙掑害闃堝€奸渶瑕佹牴鎹疄闄呮祴璇曡皟鏁?
- 绂荤嚎瑙嗛鍒嗘瀽锛氱‘淇?nativeFrames 鑳芥纭鐞?

---

## 6. 17鐐?MoveNet Keypoint 鍚嶇О鍙傝€?

```
nose, left_eye, right_eye, left_ear, right_ear,
left_shoulder, right_shoulder,
left_elbow, right_elbow,
left_wrist, right_wrist,
left_hip, right_hip,
left_knee, right_knee,
left_ankle, right_ankle
```

---

## 7. 鐩稿叧鏂囦欢璺緞姹囨€?

| 鎿嶄綔 | 鏂囦欢璺緞 |
|------|----------|
| 椤甸潰鍗＄墖 | `frontend/src/pages/PoseSelectPage.tsx` |
| 宸ュ叿椤甸潰 | `frontend/src/pages/PoseToolPage.tsx` |
| Pull-Up analyzer锛堟敞閲婏級 | `frontend/src/lib/pose/realtimePullup.ts` |
| 鏂?analyzer | `frontend/src/lib/pose/realtimeBentOverRow.ts` |
| Pull-Up 鎶ュ憡锛堟敞閲婏級 | `frontend/src/pages/poseTool/helpers/pullupReport.ts` |
| 鏂版姤鍛?| `frontend/src/pages/poseTool/helpers/bentOverRowReport.ts` |
| Suggestion 鏄犲皠 | `frontend/src/pages/poseTool/helpers/suggestionMap.ts` |
| Analyzer 宸ュ巶 | `frontend/src/pages/poseTool/helpers/analyzers.ts` |
| 鍔ㄤ綔鍏冩暟鎹?| `frontend/src/lib/pose/exercises.ts` |

---

## 8. 鍛藉悕瑙勮寖

鍙傜収 `info/refactor/POSE_17POINT_ANALYZER_MIGRATION_CHECKLIST.md`锛?

- 鏂囦欢锛歚realtimeBentOverRow.ts`
- 绫诲悕锛歚RealtimeBentOverRowAnalyzer`
- Slug锛歚bent-over-row`锛坘ebab-case锛?
- 灞曠ず鍚嶏細`Bent-Over Row`

