// Subzip: save your Moodle submissions and feedback in one click
// Saves your submitted files, feedback files and feedback comments from Moodle 4
// assignments as one zip, organised into folders by module and assignment.
// Run it on any Moodle page while logged in, then choose what to save: the
// assignment you are on, the module you are in, or every module you have taken.
// Turnitin keeps its submissions on its own servers, so those are not included:
// the panel tells you how many to download directly from Turnitin.
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
      .panel { width: 320px; padding: 20px; border-radius: 18px; background: #fff; box-shadow: 0 0 0 1px rgba(0,0,0,0.06), 0 12px 40px rgba(0,0,0,0.16); color: #1d1d1f;
        font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
      .title { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px; }
      .dot { width: 18px; height: 18px; border-radius: 50%; background: linear-gradient(135deg, #b197ff, #6d3cf0); }
      .x { background: none; border: 0; color: #86868b; font-size: 22px; line-height: 1; cursor: pointer; padding: 0 2px; }
      .x:hover { color: #1d1d1f; }
      .module { color: #6e6e73; font-size: 13px; margin-bottom: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .status { font-weight: 500; margin-bottom: 10px; }
      .bar { height: 6px; border-radius: 3px; background: #ececf0; overflow: hidden; }
      .fill { height: 100%; width: 0; background: #7c4dff; border-radius: 3px; transition: width 0.3s ease; }
      .meta { display: flex; justify-content: space-between; gap: 12px; margin-top: 10px; font-size: 12px; color: #6e6e73; min-height: 17px; }
      .file { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right; }
      .action { margin-top: 16px; width: 100%; padding: 10px; border: 0; border-radius: 999px; background: #f2f2f5; color: #1d1d1f; font: inherit; font-weight: 500; cursor: pointer; }
      .action:hover { background: #e8e8ed; }
      .panel.done .action { background: #f2f2f5; color: #1d1d1f; }
      .panel.error .fill { background: #e5484d; }
      .ask { font-weight: 500; margin-bottom: 14px; }
      .opt { display: block; width: 100%; margin-top: 8px; padding: 10px; border: 0; border-radius: 999px; background: #f2f2f5; color: #1d1d1f; font: inherit; font-weight: 500; cursor: pointer; }
      .opt:hover { background: #e8e8ed; }
      .opt:focus-visible { outline: 2px solid #7c4dff; outline-offset: 2px; }
      .opt.first { background: #7c4dff; color: #fff; }
      .opt.first:hover { background: #6a3aed; }
      .note { margin-top: 10px; font-size: 12px; color: #6e6e73; }
      [hidden] { display: none !important; }
    </style>
    <div class="panel" role="status" aria-live="polite">
      <div class="head"><div class="title"><span class="dot"></span>Subzip</div><button class="x" aria-label="Close">&times;</button></div>
      <div class="module"></div>
      <div class="choose" hidden><div class="ask">What would you like to save?</div><div class="opts"></div></div>
      <div class="work">
        <div class="status">Getting ready...</div>
        <div class="bar"><div class="fill"></div></div>
        <div class="meta"><span class="count"></span><span class="file"></span></div>
        <p class="note keep" hidden>Keep this tab open until the zip downloads. A whole degree, or video submissions, can take a while.</p>
      </div>
      <p class="note tii-note" hidden></p>
      <button class="action main">Cancel</button>
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
  let turnitinNote = '';
  const finish = (message, state) => {
    finished = true;
    if (turnitinNote) { $('.tii-note').hidden = false; $('.tii-note').textContent = turnitinNote; }
    $('.keep').hidden = true;
    ui.status(message);
    ui.file('');
    if (state) $('.panel').classList.add(state);
    $('.main').textContent = 'Close';
  };
  $('.x').onclick = () => { cancelled = true; close(); };
  $('.main').onclick = () => {
    if (finished || !$('.choose').hidden) return close();
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

  // Ask what to save, offering only the choices that make sense on this page
  const choose = options => new Promise(ok => {
    $('.work').hidden = true;
    $('.choose').hidden = false;
    $('.main').hidden = true;
    $('.opts').innerHTML = '';
    options.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'opt' + (i === 0 ? ' first' : '');
      b.textContent = o.label;
      b.onclick = () => { $('.choose').hidden = true; $('.work').hidden = false; $('.main').hidden = false; $('.keep').hidden = false; ok(o.value); };
      $('.opts').appendChild(b);
    });
  });

  try {
    if (!window.M || !M.cfg || !M.cfg.wwwroot) {
      ui.progress(100);
      return finish('Open any page on your Moodle site while logged in, then click the bookmark again.', 'error');
    }

    // Where are we? Moodle tells every page which module it belongs to
    const bodyCourse = (document.body.className.match(/\bcourse-(\d+)\b/) || [])[1];
    const courseId = Number(M.cfg.courseId || bodyCourse || 0);
    const inModule = courseId > 1; // 1 is the site's front page
    const pageId = new URLSearchParams(location.search).get('id');
    const onAssign = /\/mod\/assign\/view\.php/.test(location.pathname) && pageId;
    const pageTitle = clean(document.querySelector('#region-main h1, .page-header-headings h1, h1')?.innerText || document.title);

    ui.status('Finding your modules');
    let enrolled = [];
    const seenCourse = new Set();
    for (const classification of ['all', 'hidden']) {
      try {
        const data = await ajax('core_course_get_enrolled_courses_by_timeline_classification', { classification, limit: 0, offset: 0, sort: 'fullname' });
        (data.courses || []).forEach(c => { if (!seenCourse.has(c.id)) { seenCourse.add(c.id); enrolled.push(c); } });
      } catch (e) { if (classification === 'all' && !inModule) throw e; }
    }
    let thisModule = null;
    if (inModule) {
      thisModule = enrolled.find(c => Number(c.id) === courseId);
      if (!thisModule) {
        const cdoc = await getDoc(`${M.cfg.wwwroot}/course/view.php?id=${courseId}`).catch(() => null);
        thisModule = { id: courseId, fullname: (cdoc && (cdoc.querySelector('.page-header-headings h1, h1')?.innerText || cdoc.title)) || 'This module' };
      }
      thisModule = { id: thisModule.id, fullname: clean(thisModule.fullname) };
    }

    const options = [];
    if (onAssign && thisModule) options.push({ value: 'assignment', label: 'This assignment' });
    if (thisModule) options.push({ value: 'module', label: 'This module' });
    if (enrolled.length) options.push({ value: 'all', label: 'All modules' });
    if (!options.length) {
      ui.progress(100);
      return finish('No modules were found on your account.', 'error');
    }
    const scope = await choose(options);
    check();

    let courses;
    let only = null; // a single assignment, when that is what you chose
    if (scope === 'all') {
      courses = enrolled.map(c => ({ id: c.id, fullname: clean(c.fullname) }));
      ui.scope(`All modules (${courses.length})`);
    } else {
      courses = [thisModule];
      if (scope === 'assignment') {
        only = { type: 'assign', url: `${M.cfg.wwwroot}${location.pathname}?id=${pageId}`, title: pageTitle, course: thisModule.fullname };
        ui.scope(pageTitle);
      } else {
        ui.scope(thisModule.fullname);
      }
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
    const assignments = only ? [only] : [];
    let turnitin = 0;
    for (let i = 0; i < (only ? 0 : courses.length); i++) {
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
          assignments.push({ type: 'assign', url, title: clean(a.innerText), course: clean(c.fullname) });
        });
        const tdoc = await getDoc(`${M.cfg.wwwroot}/mod/turnitintooltwo/index.php?id=${c.id}`).catch(() => null);
        if (tdoc) main(tdoc).querySelectorAll('a[href*="/mod/turnitintooltwo/view.php?id="]').forEach(a => {
          const url = a.href.split('#')[0].split('&')[0];
          if (seen.has(url)) return;
          seen.add(url);
          turnitin++;
        });
      } catch (e) {
        console.warn('Subzip could not read assignments for', c.fullname, e);
      }
    }
    if (turnitin) {
      turnitinNote = `${turnitin} Turnitin assignment${turnitin === 1 ? ' is' : 's are'} not included, as Turnitin keeps ${turnitin === 1 ? 'its' : 'their'} submissions itself. To save ${turnitin === 1 ? 'it' : 'them'}, open the assignment on Moodle and use the download icon next to your submission.`;
    }
    if (!assignments.length) {
      ui.progress(100);
      if (turnitin) return finish(single ? 'Nothing to save here, as this module only uses Turnitin.' : 'Nothing to save here, as your modules only use Turnitin.', 'error');
      return finish(single ? 'No assignments were found in this module.' : 'No assignments were found.', 'error');
    }

    // Visit each assignment and collect your files and feedback
    const added = new Set();
    let saved = 0;
    const place = (folder, name) => {
      folder = folder.replace(/^\/+/, '');
      let full = folder ? `${folder}/${name}` : name;
      let n = 1;
      const dot = name.lastIndexOf('.');
      const pre = folder ? `${folder}/` : '';
      while (added.has(full)) full = dot > 0 ? `${pre}${name.slice(0, dot)} (${n++})${name.slice(dot)}` : `${pre}${name} (${n++})`;
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
      ui.count(`${saved} item${saved === 1 ? '' : 's'}`);
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
      const base = only ? '' : single ? a.title : `${a.course}/${a.title}`;
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
          ui.count(`${saved} item${saved === 1 ? '' : 's'}`);
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
          ui.count(`${saved} item${saved === 1 ? '' : 's'}`);
        }
      } catch (e) {
        if (cancelled) throw e;
        console.warn('Subzip skipped', a.url, e);
      }
      ui.progress(20 + ((i + 1) / assignments.length) * 70);
    }

    if (!saved) {
      ui.progress(100);
      return finish(`Checked ${assignments.length} assignment${assignments.length === 1 ? '' : 's'}, but none had your files or feedback to save.`, 'error');
    }

    // Build and save the zip
    check();
    ui.status('Creating zip');
    ui.file('');
    const blob = await zip.generateAsync({ type: 'blob' }, meta => ui.progress(90 + meta.percent / 10));
    check();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${only ? `${only.course} - ${only.title}` : single ? courses[0].fullname : 'My submissions'} (Subzip).zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    ui.progress(100);
    finish(`Done. ${saved} item${saved === 1 ? '' : 's'} saved from ${assignments.length} assignment${assignments.length === 1 ? '' : 's'}.`, 'done');

  } catch (e) {
    if (cancelled) {
      finish('Cancelled. Nothing was downloaded.');
    } else {
      console.error(e);
      finish(`Something went wrong: ${e.message}`, 'error');
    }
  }
})();
