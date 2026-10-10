<p align="center"><img src="docs/logo.svg" width="72" height="72" alt=""></p>
<h3 align="center">Subzip</h3>
<p align="center">Save every Moodle assignment you submitted, with the brief, your grade and your feedback, as one zip.</p>

<p align="center">
  <a href="LICENSE"><img alt="MIT licence" src="https://img.shields.io/github/license/ashgar99/subzip?color=brightgreen" /></a>
  <img alt="Moodle 4.x" src="https://img.shields.io/badge/Moodle-4.x-orange" />
  <img alt="No installation required" src="https://img.shields.io/badge/install-not%20required-blue" />
</p>

<p align="center"><a href="https://ashgar99.github.io/subzip/"><b>Get Subzip</b></a></p>


## Features ✨

- Asks what to save: the assignment you are on, the module you are in, or every module you have taken.
- Saves your submitted files, any online text submission, the assignment brief and attachments.
- Saves feedback files, annotated PDFs, your grade and written feedback comments.
- Packages everything into one zip, with a folder for each module and assignment.
- Shows a small progress panel on the page, with the option to cancel at any time.
- Runs in your browser using your existing login. There is nothing to install.


## Usage 🛠

1. Go to the [install page](https://ashgar99.github.io/subzip/) and drag the **Subzip** button onto your bookmarks bar (**Cmd + Shift + B** on macOS, **Ctrl + Shift + B** on Windows shows the bar).
2. Log in to Moodle.
3. Click the bookmark and choose what to save:
   - **This assignment** appears when you are on a Moodle assignment page.
   - **This module** appears anywhere inside a module, including section and assignment pages.
   - **All modules** saves every module you have taken, with a folder for each.
4. Keep the tab open until the zip downloads. Saving a whole degree, or assignments with video submissions, can take several minutes.
5. If any of your assignments were submitted through Turnitin, the panel tells you how many. Download those directly from Turnitin (see below).

If you cannot drag the button, copy the contents of [`bookmarklet.txt`](bookmarklet.txt), add a new bookmark called Subzip, and paste it in as the address. The bookmark shows a plain globe icon, which is normal for bookmarklets.


## Output 📁

```
My submissions (Subzip).zip
└── ABC123 Example Module/
    └── Essay 1/
        ├── Brief/
        │   └── Essay brief.pdf
        ├── Submission/
        │   └── Essay 1.docx
        └── Feedback/
            ├── Marked essay.pdf
            └── Grade and comments.txt
```

Saving one module leaves out the module folder, and saving one assignment leaves out both, since the zip is already named after them.

### Turnitin submissions

Subzip saves everything Moodle stores itself. Turnitin keeps its submissions and feedback on its own servers, so Turnitin assignments are not included, and Subzip tells you how many it left out. To keep those, open each Turnitin assignment on Moodle:

- Click the download icon next to your submission to save your original file.
- Click the pencil icon to open Feedback Studio, then use its download button to save a copy with your marker's comments.


## Browser support 🌐

| Browser | Supported | Notes |
| --- | --- | --- |
| Chrome, Edge, Brave, Arc, Opera, Vivaldi | Yes | Fully tested. |
| Firefox | Yes | Drag the button to the bookmarks toolbar. |
| Safari | Yes | Show the Favourites bar first, and allow downloads if Safari asks. |
| Mobile browsers | Not recommended | Bookmarklets are difficult to add and run on phones and tablets. |


## Limitations ⚠️

- Quizzes and workshops are not included.
- Turnitin submissions and feedback are not included. Download them directly from Turnitin, as described above.
- Feedback that your lecturer has not yet released will not appear.
- Some universities show feedback in a different plugin. If yours is missing, please [open an issue](https://github.com/ashgar99/subzip/issues).


## Troubleshooting 🔧

| Problem | Solution |
| --- | --- |
| `Open any page on your Moodle site` | Make sure you are logged in to Moodle before clicking the bookmark. |
| `No assignments were found` | Your modules may use a coursework plugin other than Moodle assignments. |
| `Nothing to save here` | Your coursework was submitted through Turnitin. Download it directly from Turnitin, as described above. |
| `Could not load the zip library` | Your Moodle site is blocking the zip library. Please [open an issue](https://github.com/ashgar99/subzip/issues) with your institution's name. |


## Privacy and security 🔒

The script is short and fully readable in [`subzip.js`](subzip.js). It only talks to your own Moodle site, using the login you already have, and loads one open-source library, [JSZip](https://stuk.github.io/jszip/), to build the archive. No data is collected or sent anywhere else.


## Development 🧩

Edit [`subzip.js`](subzip.js), then run `node build.js` to regenerate `bookmarklet.txt` and the install page in `docs/`.


## Unikit 🎒

Subzip is part of Unikit, a set of free tools for students: [Modzip](https://ashgar99.github.io/moodle-module-downloader/), [Duecal](https://ashgar99.github.io/duecal/), [Termcal](https://ashgar99.github.io/termcal/), [Gradewise](https://ashgar99.github.io/gradewise/), [Wordfair](https://ashgar99.github.io/wordfair/) and [Readable](https://ashgar99.github.io/readable/).

Subzip is not affiliated with or endorsed by Moodle or any university.


## Licence 📑

[MIT](LICENSE)
