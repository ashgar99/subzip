// Subzip: save your Moodle submissions and feedback in one click
// Finds every assignment in your Moodle 4 modules and downloads your submitted
// files, feedback files and feedback comments as one zip.
// Run it on any Moodle page while logged in. On a module page it saves that
// module only; anywhere else it saves every module you are enrolled on.
// https://github.com/ashgar99/subzip (MIT licence)

(async () => {
  if (document.getElementById('subzip-root')) return;

  // Panel UI, kept in a shadow root so Moodle's styles cannot affect it
  const host = document.createElement('div');
  host.id = 'subzip-root';
  host.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:2147483647;';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      .panel { width: 320px; padding: 20px; border-radius: 18px; background: #111; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08), 0 20px 50px rgba(0,0,0,0.45); color: #f5f5f7;
        font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
      .title { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px; }
      .dot { width: 18px; height: 18px; border-radius: 50%; background: linear-gradient(135deg, #79a6ff, #3350ff); }
      .x { background: none; border: 0; color: #8b8b94; font-size: 22px; line-height: 1; cursor: pointer; padding: 0 2px; }
      .x:hover { color: #f5f5f7; }
      .module { color: #a1a1aa; font-size: 13px; margin-bottom: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .status { font-weight: 500; margin-bottom: 10px; }
      .bar { height: 6px; border-radius: 3px; background: #262626; overflow: hidden; }
      .fill { height: 100%; width: 0; background: #5caeff; border-radius: 3px; transition: width 0.3s ease; }
      .meta { display: flex; justify-content: space-between; gap: 12px; margin-top: 10px; font-size: 12px; color: #8b8b94; min-height: 17px; }
      .file { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right; }
      .action { margin-top: 16px; width: 100%; padding: 10px; border: 0; border-radius: 999px; background: #1d1d1d; color: #f5f5f7; font: inherit; font-weight: 500; cursor: pointer; }
      .action:hover { background: #262626; }
      .panel.done .action { background: #5caeff; color: #000; }
      .panel.error .fill { background: #f87171; }
    </style>
    <div class="panel" role="status" aria-live="polite">
      <div class="head"><div class="title"><span class="dot"></span>Subzip</div><button class="x" aria-label="Close">&times;</button></div>
      <div class="module"></div>
      <div class="status">Getting ready...</div>
      <div class="bar"><div class="fill"></div></div>
      <div class="meta"><span class="count"></span><span class="file"></span></div>
      <button class="action">Cancel</button>
    </div>`;

  const $ = s => shadow.querySelector(s);
  const ui = {
    status: t => { $('.status').textContent = t; },
    progress: p => { $('.fill').style.width = Math.max(0, Math.min(100, p)) + '%'; },
    count: t => { $('.count').textContent = t; },
    file: t => { $('.file').textContent = t; },
    scope: t => { $('.module').textContent = t; }
  };
  let cancelled = false;
  let finished = false;
  const close = () => host.remove();
  const finish = (message, state) => {
    finished = true;
    ui.status(message);
    ui.file('');
    if (state) $('.panel').classList.add(state);
    $('.action').textContent = 'Close';
  };
  $('.x').onclick = () => { cancelled = true; close(); };
  $('.action').onclick = () => {
    if (finished) return close();
    cancelled = true;
    ui.status('Cancelling...');
  };
  const check = () => { if (cancelled) throw new Error('cancelled'); };

  // Helpers
  const clean = s => (s || '').replace(/\s+/g, ' ').trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 80) || 'Untitled';
  const getDoc = async url =>
    new DOMParser().parseFromString(await (await fetch(url, { credentials: 'include' })).text(), 'text/html');
  const main = doc => doc.querySelector('#region-main') || doc.body || doc;
  const text = el => {
    if (!el) return '';
    const c = el.cloneNode(true);
    c.querySelectorAll('br').forEach(b => b.replaceWith('\n'));
    c.querySelectorAll('p, div, li, tr, h1, h2, h3, h4').forEach(b => b.append('\n'));
    return c.textContent.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  // Moodle's own web service, called with the session you are already logged in with
  const ajax = async (methodname, args) => {
    const url = `${M.cfg.wwwroot}/lib/ajax/service.php?sesskey=${M.cfg.sesskey}&info=${methodname}`;
    const res = await fetch(url, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ index: 0, methodname, args }])
    });
    const out = await res.json();
    if (!Array.isArray(out) || out[0].error) throw new Error((out[0] && out[0].exception && out[0].exception.message) || 'Moodle did not respond');
    return out[0].data;
  };

  try {
    if (!window.M || !M.cfg || !M.cfg.wwwroot) {
      ui.progress(100);
      return finish('Open any page on your Moodle site while logged in, then click the bookmark again.', 'error');
    }

    // Work out which modules to save: this one, or all of them
    let courses = [];
    const here = new URLSearchParams(location.search).get('id');
    if (/\/course\/view\.php/.test(location.pathname) && here) {
      courses = [{ id: here, fullname: clean(document.querySelector('h1')?.innerText || document.title) }];
      ui.scope(courses[0].fullname);
    } else {
      ui.status('Finding your modules');
      const seen = new Set();
      for (const classification of ['all', 'hidden']) {
        try {
          const data = await ajax('core_course_get_enrolled_courses_by_timeline_classification', { classification, limit: 0, offset: 0, sort: 'fullname' });
          (data.courses || []).forEach(c => { if (!seen.has(c.id)) { seen.add(c.id); courses.push(c); } });
        } catch (e) { if (classification === 'all') throw e; }
      }
      ui.scope(`All modules (${courses.length})`);
    }
    if (!courses.length) {
      ui.progress(100);
      return finish('No modules were found on your account.', 'error');
    }

    // Load JSZip, hiding Moodle's RequireJS loader so the library registers globally
    if (!window.JSZip) {
      ui.status('Loading...');
      const savedDefine = window.define;
      window.define = undefined;
      await new Promise((ok, fail) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        s.onload = () => { window.define = savedDefine; ok(); };
        s.onerror = () => { window.define = savedDefine; fail(new Error('Could not load the zip library.')); };
        document.head.appendChild(s);
      });
    }
    const zip = new JSZip();
    const single = courses.length === 1;

    // Find every assignment in each module
    const assignments = [];
    let turnitin = 0;
    for (let i = 0; i < courses.length; i++) {
      check();
      const c = courses[i];
      ui.status('Finding assignments');
      ui.count(`Module ${i + 1} of ${courses.length}`);
      ui.file(c.fullname);
      ui.progress((i / courses.length) * 20);
      try {
        const doc = await getDoc(`${M.cfg.wwwroot}/mod/assign/index.php?id=${c.id}`);
        const seen = new Set();
        main(doc).querySelectorAll('a[href*="/mod/assign/view.php?id="]').forEach(a => {
          const url = a.href.split('#')[0];
          if (seen.has(url)) return;
          seen.add(url);
          assignments.push({ url, title: clean(a.innerText), course: clean(c.fullname) });
        });
        const tdoc = await getDoc(`${M.cfg.wwwroot}/mod/turnitintooltwo/index.php?id=${c.id}`).catch(() => null);
        if (tdoc) turnitin += main(tdoc).querySelectorAll('a[href*="/mod/turnitintooltwo/view.php?id="]').length;
      } catch (e) {
        console.warn('Subzip could not read assignments for', c.fullname, e);
      }
    }
    if (!assignments.length) {
      ui.progress(100);
      return finish('No Moodle assignments were found.', 'error');
    }

    // Visit each assignment and collect your files and feedback
    const added = new Set();
    let saved = 0;
    const place = (folder, name) => {
      let full = `${folder}/${name}`;
      let n = 1;
      const dot = name.lastIndexOf('.');
      while (added.has(full)) full = dot > 0 ? `${folder}/${name.slice(0, dot)} (${n++})${name.slice(dot)}` : `${folder}/${name} (${n++})`;
      added.add(full);
      return full;
    };
    const addFile = async (url, folder) => {
      check();
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok || (res.headers.get('content-type') || '').includes('text/html')) return;
      const name = clean(decodeURIComponent(new URL(res.url).pathname.split('/').pop()) || 'file');
      ui.file(name);
      zip.file(place(folder, name), await res.blob());
      saved++;
      ui.count(`${saved} file${saved === 1 ? '' : 's'}`);
    };
    const rowValue = (root, label) => {
      for (const th of root.querySelectorAll('th, td.cell.c0')) {
        if (th.innerText.trim().toLowerCase().replace(/\s+/g, ' ') === label) {
          const td = th.nextElementSibling || th.parentElement.querySelector('td:last-child');
          return td;
        }
      }
      return null;
    };

    ui.status('Saving your work');
    for (let i = 0; i < assignments.length; i++) {
      check();
      const a = assignments[i];
      const base = single ? a.title : `${a.course}/${a.title}`;
      ui.file(a.title);
      try {
        const doc = await getDoc(a.url);
        const root = main(doc);
        const links = [...new Set([...root.querySelectorAll('a[href*="/pluginfile.php/"]')].map(l => l.href.split('#')[0]))];
        for (const href of links) {
          const path = decodeURIComponent(new URL(href).pathname);
          if (/assignsubmission_/.test(path)) await addFile(href, `${base}/Submission`);
          else if (/assignfeedback_/.test(path)) await addFile(href, `${base}/Feedback`);
          else if (/\/mod_assign\/(intro|introattachment)\//.test(path)) await addFile(href, `${base}/Brief`);
        }

        // Online text submissions
        const online = rowValue(root, 'online text');
        if (online && text(online)) {
          zip.file(place(`${base}/Submission`, 'Online text.html'), `<!doctype html><meta charset="utf-8"><title>${a.title}</title>${online.innerHTML}`);
          saved++;
        }

        // Grade and written feedback
        const fb = root.querySelector('.feedback') || root;
        const grade = rowValue(fb, 'grade');
        const comments = rowValue(fb, 'feedback comments');
        const status = rowValue(root, 'submission status');
        const graded = rowValue(root, 'graded on');
        if (grade || comments) {
          const lines = [`${a.title}`, `${a.course}`, ''];
          if (status) lines.push(`Submission status: ${text(status)}`);
          if (grade) lines.push(`Grade: ${text(grade)}`);
          if (graded) lines.push(`Graded on: ${text(graded)}`);
          if (comments && text(comments)) lines.push('', 'Feedback comments:', text(comments));
          lines.push('', `Saved from ${a.url}`);
          zip.file(place(`${base}/Feedback`, 'Grade and comments.txt'), lines.join('\n'));
          saved++;
        }
      } catch (e) {
        if (cancelled) throw e;
        console.warn('Subzip skipped', a.url, e);
      }
      ui.progress(20 + ((i + 1) / assignments.length) * 70);
    }

    if (!saved) {
      ui.progress(100);
      return finish(`Checked ${assignments.length} assignments, but none had files or feedback to save.`, 'error');
    }

    // Build and save the zip
    check();
    ui.status('Creating zip');
    ui.file('');
    const blob = await zip.generateAsync({ type: 'blob' }, meta => ui.progress(90 + meta.percent / 10));
    check();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${single ? courses[0].fullname : 'My submissions'} (Subzip).zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    ui.progress(100);
    const extra = turnitin ? ` ${turnitin} Turnitin assignment${turnitin === 1 ? ' was' : 's were'} skipped.` : '';
    finish(`Done. ${saved} item${saved === 1 ? '' : 's'} saved from ${assignments.length} assignment${assignments.length === 1 ? '' : 's'}.${extra}`, 'done');
  } catch (e) {
    if (cancelled) {
      finish('Cancelled. Nothing was downloaded.');
    } else {
      console.error(e);
      finish(`Something went wrong: ${e.message}`, 'error');
    }
  }
})();
