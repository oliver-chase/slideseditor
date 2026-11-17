# Accepted audit items

Items the owner decided to keep, each with the reason.

- Git history keeps the owner's personal commit address on every commit made from the owner's machine, which is most of the history, and new commits made there use it too. The owner decided on 2026-11-17 to leave the history as it is, with no history rewrite and no force-push (issue #23). The exposure is recorded here.
- The HTML import path, about 2,700 lines across engine/html-import*.ts and the shell's import code, has no automated test. It needs a real browser (DOMParser, an iframe and computed styles), and this repo has no headless browser. Each change to it was checked by hand in a browser against a set of slides, and ARCHITECTURE.md says so.
