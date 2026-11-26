/* 桌面版桥接：真实版本、检查更新、资料导入、局域网共享（手机扫码只读）。浏览器预览无 window.desktop，不生效。 */
(function () {
  var desktop = window.desktop;
  if (!desktop || typeof desktop.info !== 'function') return;
  var REPO = 'fengye126/liuyao-study';
  var RELEASES = 'https://github.com/' + REPO + '/releases/latest';

  function setStatus(text) {
    var el = document.getElementById('updateStatus');
    if (el) el.textContent = text;
  }
  function openReleases() {
    var w = window.open(RELEASES, '_blank');
    if (!w) location.href = RELEASES;
  }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('#checkUpdate, #ghReleases, #rv5FallbackOpen') : null;
    if (!t) return;
    if (t.id === 'rv5FallbackOpen') {
      e.preventDefault(); e.stopPropagation();
      var href = t.getAttribute('href') || '';
      if (typeof desktop.openPdf === 'function') desktop.openPdf(href);
      return;
    }
    e.preventDefault(); e.stopPropagation();
    if (t.id === 'ghReleases') { openReleases(); return; }
    if (typeof desktop.checkUpdate === 'function') {
      setStatus('正在检查更新…');
      desktop.checkUpdate().then(function () {
        setStatus('检查完成 · ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
      }).catch(function () { setStatus('检查失败，可打开发布页查看'); });
    }
  }, true);

  function card(html) {
    var el = document.createElement('section');
    el.className = 'panel set-block';
    el.style.cssText = 'margin-top:18px;padding:20px 22px;border-radius:14px;background:var(--surface,#fff);border:1px solid var(--line,#e5e0d4)';
    el.innerHTML = html;
    return el;
  }

  function mountCards() {
    if (document.getElementById('deskDataCard')) return;
    var anchor = document.getElementById('setSyncTitle');
    var panel = anchor ? anchor.closest('section, .panel') : null;
    var host = panel ? panel.parentElement : document.querySelector('#view-settings .main, #view-settings');
    if (!host) return;

    var data = card('<h2 style="font-size:16px;letter-spacing:.1em;margin:0 0 10px">资料</h2>' +
      '<p id="deskDataState" style="font-size:13px;color:var(--ink-2,#5b5b5b);margin:0 0 12px">正在读取…</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><button id="deskImport" class="btn btn-primary btn-sm" type="button">导入资料</button>' +
      '<button id="deskReload" class="btn btn-sm" type="button">重新载入</button></div>' +
      '<p style="font-size:12px;color:var(--ink-3,#8a8a8a);margin:10px 0 0">选择项目里的 09_原型\\data 文件夹：书文本进本机，录音与图片继续读原路径。</p>');
    data.id = 'deskDataCard';
    host.appendChild(data);

    var lan = card('<h2 style="font-size:16px;letter-spacing:.1em;margin:0 0 10px">局域网共享（手机 / 平板只读）</h2>' +
      '<p id="deskLanState" style="font-size:13px;color:var(--ink-2,#5b5b5b);margin:0 0 12px">正在启动…</p>' +
      '<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap"><img id="deskLanQr" alt="局域网二维码" style="width:200px;height:200px;border-radius:10px;border:1px solid var(--line,#e5e0d4)" />' +
      '<div style="font-size:13px;line-height:1.9"><div id="deskLanUrl" style="font-family:ui-monospace,Consolas,monospace"></div>' +
      '<button id="deskLanCopy" class="btn btn-sm" type="button" style="margin-top:10px">复制地址</button></div></div>' +
      '<p style="font-size:12px;color:var(--ink-3,#8a8a8a);margin:10px 0 0">手机与电脑连同一个 WiFi，扫码打开即可看书、听课、查卦例；手机上暂不可改数据。</p>');
    lan.id = 'deskLanCard';
    host.appendChild(lan);

    function refreshData() {
      if (typeof desktop.dataStatus !== 'function') return;
      desktop.dataStatus().then(function (s) {
        var el = document.getElementById('deskDataState');
        if (!el) return;
        el.textContent = s.imported
          ? '已导入书文本（' + Math.round((s.booksBytes || 0) / 1024 / 1024 * 10) / 10 + ' MB）'
          : '尚未导入资料：书架会显示空态';
      }).catch(function () {});
    }
    function refreshLan() {
      if (typeof desktop.lanInfo !== 'function') return;
      desktop.lanInfo().then(function (info) {
        var st = document.getElementById('deskLanState');
        var img = document.getElementById('deskLanQr');
        var url = document.getElementById('deskLanUrl');
        if (st) st.textContent = '已开启：手机扫码打开';
        if (url) url.textContent = info.url || '';
        if (img && info.qr) img.src = info.qr;
      }).catch(function () {});
    }
    document.getElementById('deskImport').addEventListener('click', function () {
      desktop.importData().then(function (r) {
        if (r && r.ok) { setStatus('资料已导入 · 正在重新载入'); setTimeout(function () { location.reload(); }, 400); }
      });
    });
    document.getElementById('deskReload').addEventListener('click', function () { location.reload(); });
    document.getElementById('deskLanCopy').addEventListener('click', function () {
      var t = document.getElementById('deskLanUrl');
      if (t && navigator.clipboard) navigator.clipboard.writeText(t.textContent || '').catch(function () {});
    });
    refreshData(); refreshLan();
  }

  function markMissingBooks() {
    var cards = document.querySelectorAll('.book-open');
    if (!cards.length) return;
    if (document.querySelector('#deskDataCard') && document.getElementById('deskDataState') && /尚未导入/.test(document.getElementById('deskDataState').textContent || '')) {
      cards.forEach(function (c) {
        if (c.querySelector('.desk-pending')) return;
        var b = document.createElement('span');
        b.className = 'desk-pending';
        b.textContent = '待导入';
        b.style.cssText = 'position:absolute;right:8px;top:8px;font-size:11px;padding:2px 6px;border-radius:6px;background:rgba(0,0,0,.06);color:#8a6d3b';
        c.appendChild(b);
      });
    }
  }

  /* 界面里的版本号占位（v0.1.0）统一改成真实版本：文本节点级替换，
     覆盖「App v0.1.0」「本机存储 · 版本 v0.1.0」「已是最新版本 v0.1.0」等写法。 */
  var APP_VER = '';
  function rewriteVersions() {
    if (!APP_VER) return;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var hits = [];
    while (walker.nextNode()) {
      var n = walker.currentNode;
      if (!n.nodeValue || n.nodeValue.indexOf('0.1.0') < 0) continue;
      var p = n.parentElement;
      if (!p || p.closest('script,style,textarea')) continue;
      if ((p.textContent || '').length > 160) continue;
      hits.push(n);
    }
    hits.forEach(function (n) {
      n.nodeValue = n.nodeValue.replace(/v?0\.1\.0/g, function (m) {
        return m.charAt(0) === 'v' ? 'v' + APP_VER : APP_VER;
      });
    });
  }
  var verTimer = 0;
  function scheduleVersionFix() { clearTimeout(verTimer); verTimer = setTimeout(rewriteVersions, 120); }

  desktop.info().then(function (info) {
    APP_VER = info && info.version ? info.version : '';
    if (APP_VER) {
      setStatus('当前版本 v' + APP_VER + ' · 点击「检查更新」查看是否有新版');
      rewriteVersions();
      try { new MutationObserver(scheduleVersionFix).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    }
    document.documentElement.setAttribute('data-desktop-version', APP_VER);
    setTimeout(mountCards, 900);
    setTimeout(markMissingBooks, 1600);
  }).catch(function () {});
})();
