# Grade 1 Music

Weekly Alberta Grade 1 music lessons you can teach from the page, each split into three 30-minute classes (5-minute devotional song + about 20 minutes of music).

**Live site:** https://scaemrfung.github.io/Grade-1-Music/

- 36 weeks in nine monthly units (GAMEPLAN order), 3 classes per week; three catch-up weeks in the school calendar
- Teacher / student toggle
- Public-domain folk-song scores (so–mi–la) you can play in the browser
- Companion to GAMEPLAN Grade 1 (Kriske & DeLelles) — we follow the public year, not a scan of the book

No login. Progress stays on this device.

## "Updated" stamp

`updated-stamp.js` adds the "Updated … MT" stamp to every page. The date is baked into the file (`SITE_UPDATED`), so pages make no GitHub API calls. Before committing a change, run:

    sh tools/bake-updated.sh && git add updated-stamp.js

**Standing rule (Oct 3, 2026): no other-sites footer.** Do not add a "Mr. Fung's sites" footer or any list of links to Mr. Fung's other sites at the bottom of any page (removed at the request of Mr. Fung; the footer code and `.mf-sites` styles are gone). Navigation links inside this site are fine.

## Chalkie lesson links

`chalkie-links.json` maps lesson number → Chalkie lesson URL (`{"1": "https://…"}`; 3 lessons per week, so Week 1 = 1–3, Weeks 1–8 = 1–24). Each class in "This week in 3 classes" shows an **Open this lesson in Chalkie** button when its lesson has an https URL; no entry means nothing is shown. Update it with:

    python3 tools/set-chalkie-links.py mapping.json    # mapping.json = {"1": "https://…", …}
