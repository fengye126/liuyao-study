# -*- coding: utf-8 -*-
"""从 src/index.html 生成产品页并写入 app/renderer/index.html（含桌面桥注入）。

用法：python tools/build/run.py
依赖：Python 3.8+，无需第三方包。
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

repo = Path(__file__).resolve().parents[2]
here = Path(__file__).resolve().parent
src_index = repo / "src" / "index.html"
if not src_index.exists():
    sys.exit("缺少 src/index.html")

work = Path(tempfile.mkdtemp(prefix="liuyao-build-"))
mods = work / "方案预览"
mods.mkdir(parents=True)
shutil.copy2(src_index, work / "index.html")
for name in ["build.py", "refine_c.py", "refine_product.py"]:
    shutil.copy2(here / name, mods / name)

print("building in", work)
subprocess.run([sys.executable, str(mods / "build.py")], check=True)

candidates = sorted(work.glob("方案C_*.html"))
if not candidates:
    sys.exit("构建失败：没有生成方案C页")
text = candidates[0].read_text(encoding="utf-8")

tag = '<script src="方案预览/desktop-bridge.js"></script>'
if tag not in text:
    text = text.replace("</body>", tag + "\n</body>", 1)

out = repo / "app" / "renderer" / "index.html"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(text, encoding="utf-8")
print("wrote", out, len(text), "chars")

shutil.rmtree(work, ignore_errors=True)
