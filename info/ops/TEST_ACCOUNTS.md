# 鎵归噺鐢熸垚娴嬭瘯璐﹀彿锛堥儴缃茬幆澧冨彲鐢級

鏈」鐩病鏈夊唴缃浐瀹氣€滄祴璇曡处鍙封€濓紝鎺ㄨ崘閫氳繃鍚庣鍏紑鐨勬敞鍐屾帴鍙ｆ壒閲忓垱寤恒€?
## 瀹屾暣寮曞锛氬厛娓呯悊鏃ц处鍙凤紝鍐嶇敓鎴愭柊璐﹀彿锛堟帹鑽愭棩甯告搷浣滐級

濡傛灉浣犳兂鈥滄帹鍊掗噸鏉モ€濓紝鑾峰彇涓€鎵瑰共鍑€鐨勬祴璇曡处鍙凤紝鍙互鎸変互涓嬩袱姝ユ搷浣滐細

### 绗竴姝ワ細娓呯悊鎵€鏈夊凡鐢熸垚鐨勬祴璇曡处鍙?
鎸夌壒瀹氳鍒欙紙濡?`qa` 鍓嶇紑 + `example.com` 閭鍩熷悕锛夊己鍒跺垹闄ゆ暟鎹簱涓殑鏃ф祴璇曟暟鎹€?
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\cleanup_test_users.ps1 -Prefix qa -EmailDomain example.com -Commit
```

> **璇存槑**锛氳繖浼氬垹闄ゆ墍鏈夊舰濡?`qa+...@example.com` 鐨勮处鍙凤紝骞?*绾ц仈鍒犻櫎**瀹冧滑浜х敓鐨勮缁冭褰曘€佽瘎璁恒€侀ギ椋熺瓑娴嬭瘯鏁版嵁銆?
### 绗簩姝ワ細鐢熸垚涓€鎵规柊璐﹀彿

鍦ㄦ竻鐞嗗畬姣曞悗锛岀珛鍒荤敓鎴?10 涓柊鐨勬祴璇曡处鍙凤紝骞跺鍑哄瘑鐮侊細

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create_test_users.ps1 -BaseUrl "http://127.0.0.1:5000" -Count 10 -Prefix "qa" -EmailDomain "example.com" -Password "666666" -FailOnError
```

> **璇存槑**锛?> - `BaseUrl` 璇锋浛鎹负浣犵殑鐪熷疄鍚庣鍦板潃锛堝 `https://your-domain.com`锛夛紝涓嶈鍔犲弽寮曞彿銆?> - 鐢熸垚缁撴潫鍚庯紝浼氳緭鍑轰竴涓?`test-accounts-<timestamp>.csv`锛岀洿鎺ョ敤閲岄潰鐨?`email` 鍜?`password` 鐧诲綍鍗冲彲銆?
---

## 鏇村鐢ㄦ硶涓庡父瑙侀棶棰?
### 1. 鍔ㄦ€侀殢鏈哄瘑鐮佺敓鎴?
鍦ㄤ粨搴撴牴鐩綍鎵ц锛圥owerShell锛夛細

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create_test_users.ps1 -BaseUrl "https://your-domain.com" -Count 10 -Prefix "qa" -EmailDomain "example.com"
```

璇存槑锛?- 浼氳嚜鍔ㄧ敓鎴愰殢鏈哄瘑鐮侊紙姣忎釜璐﹀彿涓嶅悓锛夛紝骞舵墦鍗拌〃鏍硷紝鍚屾椂鍐欏叆 CSV 鏂囦欢銆?- `Prefix` 浼氱敤浜庢瀯閫犺处鍙凤細`<prefix>+<timestamp><index>@<domain>`銆?
### 2. 鎸囧畾缁熶竴瀵嗙爜锛堝彲閫夛級

濡傛灉浣犲笇鏈涒€滄墍鏈夋祴璇曡处鍙峰悓涓€涓瘑鐮佲€濓紝鎵ц锛?
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create_test_users.ps1 -BaseUrl "https://your-domain.com" -Count 10 -Prefix "qa" -EmailDomain "example.com" -Password "666666"
```

娉ㄦ剰锛?- `BaseUrl` 涓嶈甯?Markdown 鍙嶅紩鍙凤紙涓嶈鍐欐垚 `` `https://...` ``锛夛紝鐩存帴鐢ㄧ函 URL銆?- 鐧诲綍鏃朵娇鐢?`email + password`锛堜笉鏄?username锛夈€?
### 3. 鐢熸垚鍚庣珛鍒婚獙璇侊紙鍙€夛級

鑴氭湰浼氬姣忎釜鏂拌处鍙峰仛涓€娆＄櫥褰曟牎楠岋紝骞跺湪 CSV 閲屽啓 `register_ok` 涓?`login_ok`銆傚鏋滀綘甯屾湜鈥滃彧瑕佹湁涓€涓け璐ュ氨閫€鍑衡€濓紝鍔犱笂 `-FailOnError`锛?
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create_test_users.ps1 -BaseUrl "https://your-domain.com" -Count 10 -Prefix "qa" -EmailDomain "example.com" -Password "666666" -FailOnError
```

### 4. 杈撳嚭鏂囦欢鍦ㄥ摢閲?
鑴氭湰浼氳緭鍑虹被浼硷細

- `Saved to: D:\...\test-accounts-1712345678.csv`

鎶婅繖涓?CSV 鍙戠粰娴嬭瘯鍚屽鍗冲彲鐩存帴鐧诲綍銆?
### 5. 鍏朵粬鎶ラ敊鎺掓煡

- 濡傛灉鎶?`409 email already exists`锛氳鏄庡悓鍚嶈处鍙峰凡瀛樺湪锛涙敼涓€涓?`Prefix` 鎴栫瓑涓嬩竴绉掑啀杩愯鍗冲彲銆?- 濡傛灉浣犱笉鎯冲湪鎺у埗鍙版樉绀哄瘑鐮侊細鎶婅剼鏈緭鍑烘敼鎴愬彧鍐?CSV锛堝彲浠ヨ鎴戝府浣犲姞涓€涓?`-Quiet` 鍙傛暟锛夈€?
### 6. 娓呯悊鐨勫叾浠栨柟寮?
鎺ㄨ崘鐢ㄢ€淐SV 绮剧‘鍒犻櫎鈥濓紙鏈€瀹夊叏锛夛細

1) 鎵惧埌浣犵敓鎴愭椂杈撳嚭鐨?CSV锛堜緥濡?`test-accounts-1712345678.csv`锛?2) 鍏?dry-run 鐪嬩細鍒犲摢浜涳細

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\cleanup_test_users.ps1 -Csv .\test-accounts-1712345678.csv
```

3) 纭鏃犺鍚庢墽琛屽垹闄わ細

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\cleanup_test_users.ps1 -Csv .\test-accounts-1712345678.csv -Commit
```

涔熷彲浠ユ寜瑙勫垯鍒犻櫎锛堜緥濡傚垹鎺?`qa+...@example.com`锛夛細

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\cleanup_test_users.ps1 -Prefix qa -EmailDomain example.com -Commit
```

