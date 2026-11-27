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
      '<div id="deskLanPair" style="margin-top:6px"></div>' +
      '<button id="deskLanRegen" class="btn btn-sm" type="button" style="margin-top:10px">重生成配对码</button>' +
      '<button id="deskLanCopy" class="btn btn-sm" type="button" style="margin-top:10px;margin-left:6px">复制地址</button></div></div>' +
      '<p id="deskLanAudit" style="font-size:12px;color:var(--ink-3,#8a8a8a);margin:8px 0 0"></p>' +
      '<p id="deskMobileState" style="font-size:13px;color:var(--ink-2,#5b5b5b);margin:8px 0 0"></p>' +
      '<button id="deskMobileMerge" class="btn btn-sm" type="button" style="margin-top:8px">合并手机提交</button>' +
      '<p style="font-size:12px;color:var(--ink-3,#8a8a8a);margin:10px 0 0">手机与电脑连同一个 WiFi，扫码打开即可看书、听课；手机端只读。链接含长 token，配对码 5 分钟内一次性有效。</p>');
    lan.id = 'deskLanCard';
    host.appendChild(lan);

    var upd = card('<h2 style="font-size:16px;letter-spacing:.1em;margin:0 0 10px">更新</h2>' +
      '<p id="deskVerState" style="font-size:13px;color:var(--ink-2,#5b5b5b);margin:0 0 12px">当前版本读取中…</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<button id="deskCheckUpdate" class="btn btn-primary btn-sm" type="button">检查更新</button>' +
      '<button id="deskOpenRelease" class="btn btn-sm" type="button">打开发布页</button></div>' +
      '<p style="font-size:12px;color:var(--ink-3,#8a8a8a);margin:10px 0 0">检查更新会读取 GitHub Releases；没有新版会提示已是最新。</p>');
    upd.id = 'deskUpdateCard';
    host.appendChild(upd);
    var mediaCard = card('<h2 style="font-size:16px;letter-spacing:.1em;margin:0 0 10px">媒体库</h2>' +
      '<p id="deskMediaState" style="font-size:13px;color:var(--ink-2,#5b5b5b);margin:0 0 8px">正在读取媒体库…</p>' +
      '<p id="deskMediaPath" style="font-size:12px;color:var(--ink-3,#8a8a8a);margin:0 0 10px;word-break:break-all"></p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><button id="deskMediaChoose" class="btn btn-primary btn-sm" type="button">选择媒体文件夹</button>' +
      '<button id="deskMediaScan" class="btn btn-sm" type="button">重新扫描</button>' +
      '<button id="deskMediaReveal" class="btn btn-sm" type="button">打开文件夹</button></div>' +
      '<p style="font-size:12px;color:var(--ink-3,#8a8a8a);margin:10px 0 0">媒体文件不随安装包分发。换机后把 221录音课 / 含删除课程 等文件夹放到新位置，在这里选一次根目录即可；缺失文件会在课时里标出。</p>');
    mediaCard.id = 'deskMediaCard';
    host.appendChild(mediaCard);


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
        var pair = document.getElementById('deskLanPair');
        if (pair && info.pairCode) {
          var mins = Math.max(1, Math.round(((info.pairExpires || 0) - Date.now()) / 60000));
          pair.textContent = '手动配对码：' + info.pairCode + '（' + mins + ' 分钟内有效，只用一次）';
        }
        var auditEl = document.getElementById('deskLanAudit');
        if (auditEl) {
          var f = info.auditFailures || [];
          auditEl.textContent = f.length ? '最近被拒 ' + f.length + ' 次：' + f.slice(-3).map(function (a) { return a.status + ' ' + (a.reason || ''); }).join('；') : '最近没有被拒记录。';
        }
      }).catch(function () {});
    }
    document.getElementById('deskImport').addEventListener('click', function () {
      desktop.importData().then(function (r) {
        if (r && r.ok) { setStatus('资料已导入 · 正在重新载入'); setTimeout(function () { location.reload(); }, 400); }
      });
    });
    document.getElementById('deskReload').addEventListener('click', function () { location.reload(); });
    document.getElementById('deskLanRegen') && document.getElementById('deskLanRegen').addEventListener('click', function () {
      if (typeof desktop.lanRegenPair !== 'function') return;
      desktop.lanRegenPair().then(function () { refreshLan(); }).catch(function () {});
    });
    document.getElementById('deskLanCopy').addEventListener('click', function () {
      var t = document.getElementById('deskLanUrl');
      if (t && navigator.clipboard) navigator.clipboard.writeText(t.textContent || '').catch(function () {});
    });
    refreshData(); refreshLan();
    function refreshMedia() {
      if (typeof desktop.mediaInfo !== 'function') return;
      desktop.mediaInfo().then(function (m) {
        var st = document.getElementById('deskMediaState');
        var pathEl = document.getElementById('deskMediaPath');
        if (st) {
          if (!m || !m.ok) st.textContent = '媒体索引缺失，无法扫描。';
          else if (m.missingCount === 0) st.textContent = '媒体库完整：' + m.present + ' / ' + m.total + ' 个文件，约 ' + Math.round(m.bytes / 1024 / 1024 / 1024 * 10) / 10 + ' GB。';
          else st.textContent = '缺失 ' + m.missingCount + ' / ' + m.total + ' 个文件' + (m.missingByKind ? '（' + Object.keys(m.missingByKind).map(function (k) { return k + ' ' + m.missingByKind[k]; }).join('、') + '）' : '') + '，请选择媒体文件夹或补齐文件。';
        }
        if (pathEl) pathEl.textContent = m ? '当前根目录：' + (m.root || '未设置') : '';
      }).catch(function () {});
    }
    function bindMedia() {
      var choose = document.getElementById('deskMediaChoose');
      var scan = document.getElementById('deskMediaScan');
      var reveal = document.getElementById('deskMediaReveal');
      if (choose) choose.addEventListener('click', function () {
        if (typeof desktop.chooseMediaRoot !== 'function') return;
        desktop.chooseMediaRoot().then(function () { refreshMedia(); }).catch(function () {});
      });
      if (scan) scan.addEventListener('click', function () {
        if (typeof desktop.rescanMedia !== 'function') return;
        var st = document.getElementById('deskMediaState');
        if (st) st.textContent = '正在扫描…';
        desktop.rescanMedia().then(function () { refreshMedia(); }).catch(function () {});
      });
      if (reveal) reveal.addEventListener('click', function () {
        if (typeof desktop.revealMediaRoot === 'function') desktop.revealMediaRoot().catch(function () {});
      });
    }
    refreshMedia(); bindMedia();
    (function mobileWrite() {
      if (typeof desktop.lanPushCases !== 'function') return;
      var push = function () {
        try { if (window.CCaseSummaries) desktop.lanPushCases(window.CCaseSummaries()); } catch (e) {}
      };
      push();
      setInterval(push, 10000);
    })();
    function refreshMobile() {
      if (typeof desktop.mobileList !== 'function') return;
      desktop.mobileList().then(function (items) {
        var el = document.getElementById('deskMobileState');
        if (!el) return;
        el.textContent = items && items.length ? '手机提交 ' + items.length + ' 条待合并' : '手机提交：暂无';
      }).catch(function () {});
    }
    function bindMobile() {
      var b = document.getElementById('deskMobileMerge');
      if (!b) return;
      b.addEventListener('click', function () {
        if (typeof desktop.mobileList !== 'function') return;
        desktop.mobileList().then(function (items) {
          if (!items || !items.length) return;
          var n = typeof window.CMobileMerge === 'function' ? window.CMobileMerge(items) : 0;
          items.forEach(function (it) { desktop.mobileAck(it.id).catch(function () {}); });
          refreshMobile();
          var el = document.getElementById('deskMobileState');
          if (el) el.textContent = '已合并 ' + n + ' 条手机提交';
        }).catch(function () {});
      });
      refreshMobile();
    }
    bindMobile();
    /* 学习资产状态：缺失媒体徽标 + PDF 只读徽标 */
    function assetBadge(text, title) {
      var span = document.createElement('span');
      span.className = 'asset-badge';
      span.textContent = text;
      if (title) span.title = title;
      return span;
    }
    function markAssetStatus() {
      if (!window.desktop || typeof desktop.mediaInfo !== 'function') return;
      desktop.mediaInfo().then(function (m) {
        if (!m || !m.ok) return;
        var miss = {};
        (m.missing || []).forEach(function (rel) { var p = String(rel).split('/'); miss[p[p.length - 1]] = 1; });
        var base = function (src) {
          try { var u = decodeURIComponent(String(src || '')); return u.split('/').pop().split('?')[0]; } catch (e) { return ''; }
        };
        document.querySelectorAll('#audioList .audio-item[data-audio-src]').forEach(function (item) {
          var name = base(item.getAttribute('data-audio-src'));
          var hit = name && miss[name];
          item.classList.toggle('is-missing-media', !!hit);
          if (hit && !item.querySelector('.asset-badge')) item.appendChild(assetBadge('缺', '本地找不到这个录音文件；去设置→媒体库选根目录或补齐文件'));
        });
        document.querySelectorAll('#imageGrid .lesson-card').forEach(function (card) {
          var lessonId = card.querySelector('[data-lesson]') ? card.querySelector('[data-lesson]').dataset.lesson : '';
          var lesson = (window.LESSONS || []).filter(function (x) { return String(x.n) === String(lessonId); })[0];
          var srcs = lesson ? [lesson.audio, lesson.img] : [];
          var hit = srcs.some(function (u) { var n = base(u); return n && miss[n]; });
          if (hit) {
            card.classList.add('is-missing-media');
            if (!card.querySelector('.asset-badge')) card.appendChild(assetBadge('缺', '这节课的录音或讲解图在本地缺失'));
          }
        });
        document.querySelectorAll('[data-book-open]').forEach(function (card) {
          var id = card.dataset.bookOpen;
          var lib = (window.LIUYAO_LIBRARY && window.LIUYAO_LIBRARY.books) || [];
          var book = lib.filter(function (x) { return x.id === id; })[0];
          if (book && String(book.ext || '').toLowerCase() === 'pdf' && !card.querySelector('.asset-badge')) {
            var badge = assetBadge('PDF 只读', '点击在应用内只读打开（不引入 pdf.js，使用系统 PDF 查看器）');
            badge.style.cursor = 'pointer';
            badge.addEventListener('click', function (ev) {
              ev.preventDefault(); ev.stopPropagation();
              if (typeof desktop.openPdfInApp !== 'function') return;
              var base = (window.LIUYAO_LIBRARY && window.LIUYAO_LIBRARY.base) || '../05_书房/';
              var href;
              try { href = new URL(base + book.file, location.href).href; } catch (e) { href = base + book.file; }
              desktop.openPdfInApp(href).then(function (r) {
                if (r && r.ok === false) setStatus('PDF 打开失败：' + (r.error || '文件缺失'));
              }).catch(function () { setStatus('PDF 打开失败'); });
            });
            card.appendChild(badge);
          }
        });
      }).catch(function () {});
    }
    setInterval(markAssetStatus, 4000);
    setTimeout(markAssetStatus, 1200);


    function mountMediaWarn() {
      if (!window.desktop || typeof window.desktop.mediaInfo !== 'function') return;
      desktop.mediaInfo().then(function (m) {
        if (!m || !m.ok || !m.missingCount) return;
        if (document.getElementById('deskMediaWarn')) return;
        var bar = document.createElement('button');
        bar.id = 'deskMediaWarn';
        bar.type = 'button';
        bar.textContent = '媒体缺失 ' + m.missingCount + ' / ' + m.total + '：' + (m.missingByKind ? Object.keys(m.missingByKind).map(function (k) { return k + ' ' + m.missingByKind[k]; }).join('、') : '') + ' · 点这里去设置媒体文件夹';
        bar.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:150;padding:8px 14px;border-radius:999px;border:1px solid #c9a06a;background:#fdf6e8;color:#7a5a2e;font-size:12px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.12)';
        bar.addEventListener('click', function () {
          var nav = document.querySelector('[data-nav="settings"]');
          if (nav) nav.click();
        });
        document.body.appendChild(bar);
      }).catch(function () {});
    }
    mountMediaWarn();


    if (document.getElementById('deskCheckUpdate')) {
      desktop.info().then(function (info) {
        var el = document.getElementById('deskVerState');
        if (el && info && info.version) el.textContent = '当前版本 v' + info.version;
      }).catch(function () {});
      document.getElementById('deskCheckUpdate').addEventListener('click', function () {
        var el = document.getElementById('deskVerState');
        if (el) el.textContent = '正在检查更新…';
        if (typeof desktop.checkUpdate !== 'function') { if (el) el.textContent = '当前版本不支持检查更新'; return; }
        desktop.checkUpdate().then(function (r) {
          if (!el) return;
          if (r && r.hasUpdate) el.textContent = '发现新版本 v' + r.version + '（弹窗里可直接下载）';
          else el.textContent = '已是最新版本 v' + ((r && r.version) || (window.__deskVersion || '')) + ' · ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        }).catch(function () { if (el) el.textContent = '检查失败，可点「打开发布页」查看'; });
      });
      document.getElementById('deskOpenRelease').addEventListener('click', openReleases);
    }
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
