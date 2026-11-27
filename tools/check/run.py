# -*- coding: utf-8 -*-
"""仓库自检：语法、构建可复现。用法：python tools/check/run.py"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

repo = Path(__file__).resolve().parents[2]
app = repo / "app"
fails = []

def run(cmd, cwd=None):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace", shell=False)
    return r.returncode, (r.stdout or "") + (r.stderr or "")

# 1) JS 语法
targets = [app / "main.js", app / "preload.js", app / "lan.js"]
targets += sorted((app / "renderer" / "方案预览").glob("*.js"))
node = shutil.which("node")
if node:
    for f in targets:
        code, out = run([node, "--check", str(f)])
        if code != 0:
            fails.append("语法错误 %s: %s" % (f.name, out.strip()[:200]))
    print("语法检查：%d 个文件" % len(targets))
else:
    print("跳过语法检查（未找到 node）")

# 1.5) 历法金样例
code, out = run([node, str(repo / "tools" / "check" / "astro_golden.cjs")]) if node else (0, "skip")
if code != 0:
    fails.append("历法金样例失败：" + out.strip()[-300:])
else:
    print(out.strip()[:120])

# 2) 构建可复现：重建后与 app/renderer/index.html 比对（忽略 bridge 注入行）
before = (app / "renderer" / "index.html").read_text(encoding="utf-8")
code, out = run([sys.executable, str(repo / "tools" / "build" / "run.py")])
if code != 0:
    fails.append("构建失败：" + out.strip()[-300:])
else:
    after = (app / "renderer" / "index.html").read_text(encoding="utf-8")
    tag = '<script src="方案预览/desktop-bridge.js"></script>\n'
    if before.replace(tag, "") != after.replace(tag, ""):
        fails.append("构建产物与仓库内产品页不一致（说明 index.html 被手改过或未提交）")
    else:
        print("构建可复现：一致")

# 3) 关键文件存在
for rel in ["src/index.html", "tools/build/run.py", "LICENSE", "app/renderer/方案预览/desktop-bridge.js"]:
    if not (repo / rel).exists():
        fails.append("缺少文件：" + rel)

# 4) 安装包冒烟（有 dist 才跑）
if node:
    code, out = run([node, str(repo / "tools" / "check" / "package_smoke.cjs")])
    print(out.strip()[:200])
    if code != 0:
        fails.append("安装包冒烟失败：" + out.strip()[-400:])

print()
if fails:
    print("FAIL")
    for f in fails:
        print(" -", f)
    sys.exit(1)
print("PASS")
