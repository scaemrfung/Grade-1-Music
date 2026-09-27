/* ==========================================================================
   SCHOOL-YEAR SETTINGS — Grade 1 Music (the one file to review each August)
   Places Weeks 1–36 on the real EIPS calendar (breaks skipped, three catch-up
   weeks, short weeks labelled) and works out each Grade 1 class's music days.
   Short-week rule: 2 classes that week -> teach Class 1 and Class 2 (drop
   Class 3). 1 class -> teach Class 1 only.
   Class days come from Patrick_Fung_Timetable_2026-2027.docx — edit
   MUSIC_CLASSES below if the timetable changes.
   ========================================================================== */
(function (root) {
  "use strict";
  /* ---- School calendar (EIPS Division Calendar 2026-27) ------------------
     Source: https://www.eips.ca/download/480909  (verified Sept 27, 2026)
     To roll over to a new year: change the dates in CAL below. Everything
     else (school weeks, lesson numbers, short-week notes) is worked out
     from these dates.
     Test any date with ?today=YYYY-MM-DD in the page URL.            */
  var CAL = {
    label: "2026–2027",
    timeZone: "America/Edmonton",
    firstDay: "2026-08-31",        // Classes begin (Mon)
    lastDay: "2027-06-28",         // Last instructional day (Mon)
    semester2: "2027-02-01",
    lessons: 36,
    // Catch-up weeks (Monday of the week). No new lesson; finish or review.
    catchUp: ["2026-12-14", "2027-02-01", "2027-06-21"],
    catchUpWhy: {
      "2026-12-14": "Catch-up week before Christmas (concerts, finish Week 14 or review)",
      "2027-02-01": "Catch-up week (Teachers' Convention Thu–Fri; semester 2 starts)",
      "2027-06-21": "Catch-up week (year-end: finish Week 36 or review)"
    },
    // Weekday non-school days: [first, last, reason]
    closed: [
      ["2026-09-07", "2026-09-07", "Labour Day"],
      ["2026-09-30", "2026-09-30", "Truth and Reconciliation Day"],
      ["2026-10-02", "2026-10-02", "PL day"],
      ["2026-10-12", "2026-10-12", "Thanksgiving"],
      ["2026-11-09", "2026-11-13", "November Break"],
      ["2026-12-21", "2027-01-01", "Christmas Break"],
      ["2027-01-29", "2027-01-29", "PL day"],
      ["2027-02-04", "2027-02-05", "Teachers' Convention"],
      ["2027-02-15", "2027-02-15", "Family Day"],
      ["2027-03-05", "2027-03-05", "PL day"],
      ["2027-03-19", "2027-03-19", "School closure"],
      ["2027-03-22", "2027-03-26", "Spring Break"],
      ["2027-03-29", "2027-03-29", "Easter Monday"],
      ["2027-05-07", "2027-05-07", "PL day"],
      ["2027-05-20", "2027-05-21", "School closure"],
      ["2027-05-24", "2027-05-24", "Victoria Day"],
      ["2027-06-29", "2027-06-29", "Operational day (no students)"]
    ],
    earlyDismissal: 3 // Wednesday: one hour early every week
  };

  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var DAY = 864e5;

  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function iso(t) { return new Date(t).toISOString().slice(0, 10); }
  function dow(t) { return new Date(t).getUTCDay(); }
  function mondayOf(t) { var d = dow(t); return t - ((d + 6) % 7) * DAY; }
  function short(t) { var d = new Date(t); return MON[d.getUTCMonth()] + " " + d.getUTCDate(); }
  function dayLabel(t) { return DOW[dow(t)] + " " + short(t); }
  function range(a, b) {
    if (a === b) return dayLabel(a);
    var da = new Date(a), db = new Date(b);
    return short(a) + "–" + (da.getUTCMonth() === db.getUTCMonth() ? db.getUTCDate() : short(b));
  }

  var CLOSED = {};
  CAL.closed.forEach(function (c) {
    for (var t = parse(c[0]); t <= parse(c[1]); t += DAY) CLOSED[iso(t)] = c[2];
  });
  var FIRST = parse(CAL.firstDay), LAST = parse(CAL.lastDay);

  /* Build every week from the first Monday to the last day. */
  var WEEKS = [], BREAKS = [];
  (function build() {
    var lesson = 0, n = 0;
    for (var mon = mondayOf(FIRST); mon <= LAST; mon += 7 * DAY) {
      var days = [], off = [];
      for (var i = 0; i < 5; i++) {
        var t = mon + i * DAY, k = iso(t);
        if (t < FIRST || t > LAST) continue;
        if (CLOSED[k]) off.push({ date: k, why: CLOSED[k], label: dayLabel(t) });
        else days.push(k);
      }
      if (!days.length) {
        var why = off.length ? off[0].why : "No school";
        var prev = BREAKS[BREAKS.length - 1];
        if (prev && prev.name === why && parse(prev.end) + 3 * DAY >= mon) prev.end = iso(mon + 4 * DAY), prev.range = range(parse(prev.start), mon + 4 * DAY);
        else BREAKS.push({ name: why, start: iso(mon), end: iso(mon + 4 * DAY), range: range(mon, mon + 4 * DAY) });
        continue;
      }
      n++;
      var w = { n: n, monday: iso(mon), start: days[0], end: days[days.length - 1], days: days, off: off,
        range: range(parse(days[0]), parse(days[days.length - 1])) };
      if (CAL.catchUp.indexOf(iso(mon)) >= 0) { w.kind = "catchup"; w.lesson = null; w.why = CAL.catchUpWhy[iso(mon)] || "Catch-up week"; }
      else if (lesson >= CAL.lessons) { w.kind = "yearend"; w.lesson = null; w.why = "Last day of school"; }
      else { lesson++; w.kind = "lesson"; w.lesson = lesson; }
      var partialStart = mon < FIRST, partialEnd = mon + 4 * DAY > LAST;
      if (days.length < 5) {
        var bits = off.map(function (o) { return o.label + " off (" + o.why + ")"; });
        if (partialEnd && !off.length) w.note = days.length + "-day week: last day of school " + dayLabel(parse(days[days.length - 1]));
        else if (partialStart && !off.length) w.note = days.length + "-day week: first day of school " + dayLabel(parse(days[0]));
        else w.note = days.length + "-day week: " + bits.join(", ");
      } else w.note = "";
      WEEKS.push(w);
    }
  })();

  function weekOfLesson(n) { for (var i = 0; i < WEEKS.length; i++) if (WEEKS[i].lesson === n) return WEEKS[i]; return null; }
  function weekOfDate(k) {
    var mon = iso(mondayOf(parse(k)));
    for (var i = 0; i < WEEKS.length; i++) if (WEEKS[i].monday === mon) return WEEKS[i];
    return null;
  }
  function nextWeekAfter(k) { for (var i = 0; i < WEEKS.length; i++) if (WEEKS[i].start > k) return WEEKS[i]; return null; }
  function nextLessonWeekFrom(w) {
    for (var i = WEEKS.indexOf(w); i >= 0 && i < WEEKS.length; i++) if (WEEKS[i].lesson) return WEEKS[i];
    return null;
  }
  function breakOf(k) {
    for (var i = 0; i < BREAKS.length; i++) if (BREAKS[i].start <= k && k <= BREAKS[i].end) return BREAKS[i];
    return null;
  }

  /** Today's date (school time zone) as "YYYY-MM-DD". ?today=YYYY-MM-DD wins. */
  function todayISO() {
    try {
      var o = root && root.SCHOOL_TODAY;
      if (!o && root && root.location) o = new URLSearchParams(root.location.search).get("today");
      if (o && parse(o) != null) return o;
    } catch (e) { /* ignore */ }
    try {
      var p = new Intl.DateTimeFormat("en-CA", { timeZone: CAL.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
      var g = function (t) { return p.find(function (x) { return x.type === t; }).value; };
      return g("year") + "-" + g("month") + "-" + g("day");
    } catch (e) { var d = new Date(); return iso(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); }
  }

  /** What to show for a date (default: today).
      kind: lesson | catchup | break | closed | before | summer | yearend
      lesson: the lesson number to feature; week: the school week it belongs to. */
  function status(k) {
    k = k || todayISO();
    var t = parse(k), d = dow(t), out = { date: k };
    if (t < FIRST) {
      var w1 = WEEKS[0];
      return { date: k, kind: "before", label: "First lesson", lesson: 1, week: w1,
        message: "School starts " + DOW_LONG[dow(parse(w1.start))] + " " + short(parse(w1.start)) + ". Week 1 is ready." };
    }
    if (t > LAST) {
      return { date: k, kind: "summer", label: "Start here", lesson: 1, week: null,
        message: "The " + CAL.label + " school year is over. Week 1 is here so you can plan for next year." };
    }
    // Weekend: look at the week that starts next Monday.
    var probe = k;
    if (d === 6 || d === 0) probe = iso(t + (d === 6 ? 2 : 1) * DAY);
    var w = weekOfDate(probe);
    if (!w) {
      var br = breakOf(probe) || { name: "No school", range: "" };
      var nx = nextWeekAfter(probe), nl = nx && nextLessonWeekFrom(nx);
      return { date: k, kind: "break", label: "Next lesson", lesson: nl ? nl.lesson : 36, week: nl,
        message: br.name + (br.range ? " (" + br.range + ")" : "") + " — no school." +
          (nx ? " Back " + DOW_LONG[dow(parse(nx.start))] + " " + short(parse(nx.start)) + (nl ? " with Week " + nl.lesson + "." : ".") : "") };
    }
    out.week = w;
    if (w.kind === "catchup") {
      var prevL = 0; for (var i = 0; i < WEEKS.length && WEEKS[i] !== w; i++) if (WEEKS[i].lesson) prevL = WEEKS[i].lesson;
      var nl2 = nextLessonWeekFrom(w);
      out.kind = "catchup"; out.label = "Catch-up week"; out.lesson = prevL || 1;
      out.message = "Catch-up week (" + w.range + "): no new lesson. Finish Week " + prevL + " or review." +
        (nl2 ? " Week " + nl2.lesson + " starts " + short(parse(nl2.start)) + "." : "") + (w.note ? " " + w.note + "." : "");
      return out;
    }
    if (w.kind === "yearend") {
      out.kind = "yearend"; out.label = "Last day"; out.lesson = CAL.lessons;
      out.message = "Last day of school: " + dayLabel(parse(w.start)) + ". Week " + CAL.lessons + " was the last lesson.";
      return out;
    }
    out.kind = "lesson"; out.label = "This week’s lesson"; out.lesson = w.lesson;
    if (CLOSED[k]) out.message = "No school today (" + CLOSED[k] + "). " + (w.note || "");
    else out.message = w.note || "";
    return out;
  }

  function weekInfo(n) {
    var w = weekOfLesson(n);
    if (!w) return null;
    return { lesson: n, week: w.n, range: w.range, note: w.note, start: w.start, end: w.end, days: w.days, off: w.off };
  }
  /** "Sept 28–Oct 1 · 3-day week: Wed Sept 30 off (...)" */
  function lessonLine(n) {
    var w = weekOfLesson(n);
    return w ? w.range + (w.note ? " · " + w.note : "") : "";
  }
  /** Is a date a school day? Returns null if yes, else the reason. */
  function closedReason(k) {
    var t = parse(k); if (t == null) return "Not a date";
    var d = dow(t);
    if (d === 0 || d === 6) return "Weekend";
    if (t < FIRST) return "Before the first day of school";
    if (t > LAST) return CLOSED[k] || "Summer (after the last day of school)";
    return CLOSED[k] || null;
  }

  // Weekday numbers: 1 = Mon … 5 = Fri
  var MUSIC_CLASSES = { "1A": [1, 4, 5], "1B": [1, 3, 4], "1C": [3, 4, 5], "1D": [2, 3, 5] };

  /** Per-class plan for lesson week n (or a school-week object). */
  function musicPlan(n) {
    var w = typeof n === "object" ? n : weekOfLesson(n);
    if (!w) return null;
    var classes = Object.keys(MUSIC_CLASSES).map(function (c) {
      var dates = w.days.filter(function (k) { return MUSIC_CLASSES[c].indexOf(dow(parse(k))) >= 0; });
      var missed = w.off.filter(function (o) { return MUSIC_CLASSES[c].indexOf(dow(parse(o.date))) >= 0; });
      var count = dates.length;
      var rule = count >= 3 ? "All 3 classes" : count === 2 ? "Teach Class 1 and Class 2 (drop Class 3)" : count === 1 ? "Teach Class 1 only" : "No music this week";
      return { cls: c, count: count, rule: rule,
        dates: dates.map(function (k, i) { return { date: k, label: dayLabel(parse(k)), classNo: i + 1 }; }),
        missed: missed.map(function (o) { return o.label + " (" + o.why + ")"; }) };
    });
    return { week: w, range: w.range, note: w.note, classes: classes, short: classes.some(function (c) { return c.count < 3; }) };
  }
  /** Which of the week's classes (1, 2 or 3) a class has on a date, or 0. */
  function musicClassNo(cls, k) {
    var w = weekOfDate(k); if (!w || !MUSIC_CLASSES[cls]) return 0;
    var p = musicPlan(w), c = p.classes.filter(function (x) { return x.cls === cls; })[0];
    for (var i = 0; i < c.dates.length; i++) if (c.dates[i].date === k) return c.dates[i].classNo;
    return 0;
  }

  var API = { config: CAL, weeks: WEEKS, breaks: BREAKS, todayISO: todayISO, status: status,
    weekOfLesson: weekOfLesson, weekInfo: weekInfo, lessonLine: lessonLine, closedReason: closedReason,
    musicClasses: MUSIC_CLASSES, musicPlan: musicPlan, musicClassNo: musicClassNo,
    rangeOf: function (n) { var w = weekOfLesson(n); return w ? w.range : ""; } };
  if (root) root.SCHOOL_YEAR = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;

  if (root && root.document) {
    var css = ".sy-msg { margin: .35rem 0 .5rem; padding: .45rem .7rem; border-radius: 10px; background: var(--color-highlight-soft,#d7efe6); color: #1f5a4c; font-size: .9rem; line-height: 1.4; } .sy-msg.sy-lesson { background: var(--color-accent-soft,#f6e9c0); color: #6b5410; } .sy-next { margin-top: .5rem; font-size: .88rem; opacity: .85; } .sy-week { margin: .9rem 0 .4rem; padding: .7rem .9rem; border: 1px solid var(--color-highlight-soft,#d7efe6); border-left: 4px solid var(--color-highlight,#2f7d6b); border-radius: 12px; background: #fbfaf6; font-size: .92rem; } .sy-week-short { border-left-color: var(--color-accent,#c4a035); } .sy-week-head { display: flex; flex-wrap: wrap; align-items: center; gap: .45rem; margin: 0; } .sy-pill { display: inline-block; border-radius: 999px; padding: .08rem .55rem; font-size: .74rem; font-weight: 600; background: var(--color-highlight-soft,#d7efe6); color: #1f5a4c; } .sy-note { display: inline-block; border-radius: 8px; padding: .1rem .5rem; font-size: .8rem; font-weight: 600; background: var(--color-accent-soft,#f6e9c0); color: #6b5410; line-height: 1.35; } .sy-rule { margin: .45rem 0 0; } .sy-classes { margin: .35rem 0 0; padding-left: 1.1rem; } .sy-classes li { margin: .15rem 0; } .sy-classes li.short em { color: #8a5a00; font-style: normal; font-weight: 600; } @media print { .sy-msg, .sy-next { display: none; } .sy-week { break-inside: avoid; } }";
    var addCss = function () {
      if (document.getElementById("sy-style")) return;
      var s = document.createElement("style"); s.id = "sy-style"; s.textContent = css;
      (document.head || document.documentElement).appendChild(s);
    };
    if (document.head) addCss(); else document.addEventListener("DOMContentLoaded", addCss);
  }

})(typeof window !== "undefined" ? window : null);
