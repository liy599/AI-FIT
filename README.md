# AI-FIT

鍓嶅悗绔垎绂荤殑鍋ヨ韩/钀ュ吇 Web 搴旂敤锛氬墠绔?React + Vite锛屽悗绔?Flask + PostgreSQL銆?
## 鍏堣杩欎簺锛堜笉浼氳嚜鍔ㄥ畨瑁咃級

`dev.ps1`锛堢幇宸茬Щ鑷?`scripts/`锛変細鑷姩瀹夎鈥滈」鐩緷璧栤€濓紙Python 鍖呫€佸墠绔?npm 鍖咃級骞跺惎鍔ㄦ湇鍔★紝浣嗕笉浼氳嚜鍔ㄥ畨瑁呬互涓嬪熀纭€杞欢锛?- Python锛堝缓璁?3.10+锛?- Node.js锛堝缓璁?18+锛?- Docker Desktop锛堝繀闇€锛岀敤浜庣粺涓€鍚姩 PostgreSQL锛?
### Windows锛堟帹鑽愮敤 winget锛?
浠ョ鐞嗗憳 PowerShell 鎵ц锛?
```powershell
winget install -e --id Python.Python.3.12
winget install -e --id OpenJS.NodeJS.LTS
winget install -e --id Docker.DockerDesktop
```

瀹夎瀹屾垚鍚庯細
- 閲嶅惎缁堢/IDE锛堢‘淇?PATH 鐢熸晥锛?- 鍚姩 Docker Desktop锛堝繀椤诲浜?Running 鐘舵€侊級

楠岃瘉锛?
```powershell
python --version
npm.cmd --version
docker --version
docker info
```

### 鎵嬪姩涓嬭浇瀹夎锛堜换鎰忕郴缁燂級

- Python锛氬埌瀹樼綉涓嬭浇瀹夎骞跺嬀閫?鈥淎dd Python to PATH鈥濓紙Windows锛?- Node.js锛氬畨瑁?LTS 鐗堟湰
- Docker Desktop锛氬畨瑁呭悗鍚姩搴旂敤骞跺畬鎴愰娆″垵濮嬪寲

## 鏃犺剳鍚姩锛堟帹鑽愶級

鍓嶆彁锛氬畨瑁?Python锛堝缓璁?3.10+锛夈€丯ode.js锛堝缓璁?18+锛変互鍙?Docker Desktop锛堝繀闇€锛夈€傝剼鏈細鑷姩鍒涘缓 Python 铏氭嫙鐜銆佸畨瑁呭悗绔緷璧栥€佸畨瑁呭墠绔緷璧栵紝骞堕€氳繃 Docker 鍚姩 PostgreSQL锛屼繚璇佷笉鍚岀數鑴戠幆澧冧竴鑷淬€?
鍦ㄤ粨搴撴牴鐩綍鎵ц锛圥owerShell锛夛細

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

璇存槑锛?- 棣栨杩愯锛氫細鍒涘缓 `backend/.venv`銆佸畨瑁呭悗绔緷璧栥€佸畨瑁呭墠绔緷璧栥€佹媺璧?PostgreSQL锛圖ocker锛夊苟鍚姩鍓嶅悗绔€?- 涔嬪悗姣忔鍚姩锛氫篃鍙互缁х画杩愯鍚屼竴鏉″懡浠わ紱鑴氭湰浼氬鐢ㄥ凡瀛樺湪鐨勮櫄鎷熺幆澧冧笌 `node_modules`锛岄€氬父鍙細蹇€熷惎鍔ㄦ湇鍔°€?- 濡傞渶鈥滅函鍚姩鈥濓紙涓嶅仛渚濊禆妫€鏌?瀹夎锛夛細鍙互鍒嗗埆寮€涓や釜缁堢鎵嬪姩杩愯鍚庣涓庡墠绔紙瑙佷笅鏂光€滄墜鍔ㄥ惎鍔ㄢ€濓級銆?
鍚姩鍚庯細
- 鍓嶇锛歚http://localhost:5173`
- 鍚庣鍋ュ悍妫€鏌ワ細`http://127.0.0.1:5000/api/health`

## 鎵嬪姩鍚姩

### 1) 鍚姩鏁版嵁搴擄紙PostgreSQL锛?
鎺ㄨ崘鐢?Docker锛?
```powershell
docker compose up -d db
```

濡備笉浣跨敤 Docker锛屼篃鍙互鎵嬪姩鍒涘缓鏁版嵁搴擄紝鍙傝€?[backend/db_init.sql](backend/db_init.sql)銆備絾杩欐牱浼氬紩鍏モ€滄瘡鍙扮數鑴戠幆澧冧笉涓€鑷粹€濈殑闂锛屼笉鎺ㄨ崘銆?
### 2) 鍚姩鍚庣

```powershell
cd .\backend
Copy-Item .\.env.example .\.env -ErrorAction SilentlyContinue

python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe run.py
```

### 3) 鍚姩鍓嶇

```powershell
cd .\frontend
Copy-Item .\.env.example .\.env -ErrorAction SilentlyContinue

npm.cmd install
npm.cmd run dev
```

## 閰嶇疆璇存槑

鍚庣鐜鍙橀噺绀轰緥鍦?[backend/.env.example](backend/.env.example)锛?- `DATABASE_URL`锛氶粯璁?`postgresql+psycopg://aifitguard:aifitguard@localhost:5432/aifitguard`
- `SECRET_KEY` / `JWT_SECRET_KEY`锛氭湰鍦板彲鐢ㄧず渚嬪€硷紝閮ㄧ讲鏃跺姟蹇呮敼鎴愰殢鏈哄己瀵嗙爜
- `CORS_ORIGINS`锛氬彲閫夛紝閫楀彿鍒嗛殧锛涗笉濉椂榛樿鍏佽 `http://localhost:5173` 涓?`http://127.0.0.1:5173`

鍓嶇鐜鍙橀噺绀轰緥鍦?[frontend/.env.example](frontend/.env.example)锛?- `VITE_API_BASE`锛氬悗绔熀鍦板潃锛堥粯璁?`http://127.0.0.1:5000`锛?
## 蹇€熷啋鐑熼獙璇?
鍚庣鍚姩鍚庯紝鍙互杩愯锛?
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\demo.ps1
```

浼氫緷娆¤皟鐢?health銆佹敞鍐屻€佽幏鍙栧綋鍓嶇敤鎴枫€佹彁浜ゅ弽棣堢瓑鎺ュ彛銆?
## 鎵归噺鐢熸垚娴嬭瘯璐﹀彿
瑙?[info/ops/TEST_ACCOUNTS.md](info/ops/TEST_ACCOUNTS.md)銆?
## 甯歌闂

- Docker 鐩稿叧鎶ラ敊锛坄failed to connect to the docker API ... dockerDesktopLinuxEngine`锛夛細琛ㄧず Docker Desktop 鏈惎鍔ㄦ垨 Docker daemon 涓嶅彲鐢ㄣ€傚惎鍔?Docker Desktop 鍚庨噸璇曪紱鏈」鐩殑涓€閿剼鏈姹?Docker 浠ヤ繚璇佺幆澧冧竴鑷淬€?- PowerShell 鎶?`npm.ps1` 鎵ц绛栫暐闄愬埗锛氬缓璁洿鎺ヤ娇鐢?`npm.cmd`锛堟湰浠撳簱鏂囨。涓庤剼鏈凡榛樿浣跨敤锛夛紝鎴栬嚜琛岃皟鏁村綋鍓嶇敤鎴锋墽琛岀瓥鐣ャ€?## Dependency Note

When frontend dependencies change, run `npm.cmd install` inside [frontend/package.json](/d:/trae/trae_projects/AI-FIT/frontend/package.json) or rerun `powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1`.

This matters for the Pose migration because the realtime page adds browser-side MoveNet / TensorFlow packages, and an existing `node_modules` directory does not guarantee those new packages are present.

