---
name: information-dashboard-design
description: Visual design rules for information dashboards, from Stephen Few's "Information Dashboard Design" plus a Lean UX and dashboard-design deck's chart tips. Covers what a dashboard is, choosing measures and their context, picking charts (bullet graphs, sparklines, bar and line graphs over gauges, pies and traffic lights) with per-chart best practices, layout, highlighting and color for a single screen read at a glance, a Lean UX design-and-test loop, and the thirteen common dashboard mistakes. Use it whenever you design, build, mock up, critique or redesign a dashboard, KPI or scorecard screen, executive overview, monitoring or ops status page, or any chart-heavy single screen of key metrics, in any medium (HTML/React, Tableau, Power BI, Looker, Databricks, Streamlit, Grafana, a spreadsheet). That includes requests that never say "dashboard", like "make this metrics page clearer" or "which chart should this use". For choosing which KPIs to track, pair it with kpi-dashboard-design.
---

# Information Dashboard Design

This skill distils Stephen Few's *Information Dashboard Design* (O'Reilly, 2006). Its premise is that a dashboard is a medium of **communication**. Most dashboards fail because of poor visual design, not technology: they chase flash (gauges, meters, glossy 3‑D, photo-realism) that entertains for a day and then gets in the way. Effective dashboards come from design informed by how people see and think, closer to science than art. The guiding principle throughout is **simplicity**: show the data as clearly and directly as possible, and remove everything that doesn't help.

A second source, the *Lean UX and Dashboard Design* deck (2015), adds a Lean UX design process, Oracle's Glance → Scan → Commit model, a chart chooser, best practices for each chart type, data-design tips and color palettes. Where the deck is looser than Few, Few's rule wins on a dashboard.

How to use this skill:
- **Designing or building:** work through *Design workflow*, apply the rules in the sections after it, then run the *Review checklist* before you call it done. *What Few's own designs look like* gives concrete palette, type and layout conventions to start from.
- **Reviewing an existing dashboard:** go straight to the *Review checklist*. `references/worked-examples.md` catalogues real failures and Few's own exemplary layouts.
- **Choosing or specifying a chart:** use the *Display media chooser* below, then `references/display-media.md` for exact specifications (bullet graph anatomy, sparklines, box plots, treemaps, icons, small multiples) and `references/chart-practices.md` for the deck's chooser and its do's and don'ts for each chart type (bar, line, area, pie/donut, scatter), its tips and its color ramps.

## What a dashboard is

> "A dashboard is a visual display of the most important information needed to achieve one or more objectives; consolidated and arranged on a single screen so the information can be monitored at a glance." (Few)

Every design decision should serve this definition. Treat each part as a test:

- **Visual.** Mostly graphical, combined with text. Graphics aren't there to look cute: done well, they communicate faster and with richer meaning than text.
- **The most important information for specific objectives.** It's whatever someone needs to do a job, often from unrelated sources. It needn't be KPIs or even quantitative (lists, schedules and relationship diagrams all qualify), and it isn't only for executives.
- **One screen, no scrolling, no paging.** Everything must sit within eye span. If you have to scroll, it has stopped being a dashboard; if you have to switch screens, it's several dashboards. The reason is short-term memory: people hold only about 3–9 chunks at once, so anything off screen is effectively gone. Seeing everything together is what produces comparisons and "aha" moments. Viewers also assume anything below the fold matters less, and many won't scroll at all.
- **Monitored at a glance.** That means abbreviated content: summaries and exceptions, not detail. The dashboard has done its main job if one glance tells the viewer whether to act. It serves them superbly if it also opens the door to the detail they need to act (drill-down, links).
- **Small, concise, clear media.** Use whatever states the message in the least space. A gauge, traffic light or thermometer is fine *only* if it really is the best fit, which it rarely is.
- **Customized** to a specific person, group or function: their objectives, their vocabulary (a team that thinks in weeks shouldn't get months), and their precision (executives seldom need cents; the accounting manager might).
- **Not required:** a web browser, or real-time data. Real time only matters when the objectives demand it, as in air traffic or operations. Strategic decisions are fine on last night's or last month's snapshot.

A dashboard is a type of display, not a type of data or a technology. Sometimes the honest answer is that the need is a report, an analysis tool, or several separate dashboards. Say so instead of forcing it.

## Design workflow

0. **Frame the problem and the outcome (Lean UX).** Aim at outcomes, not outputs: the business goal the dashboard serves, not a list of widgets.
   - Start from the problem statement. Write down your assumptions (they usually go unstated) and turn them into testable hypotheses: *"We believe that [this dashboard or feature] for [these people] will achieve [this outcome]. We'll know we're right when [this measurable thing happens]."*
   - Sketch one-page proto-personas for the viewers. Check the personas against the hypotheses, and check the hypotheses cover the problem statement.
   - Design for the viewer's three moves (Oracle's model):
     - **Glance:** take in the state of things in seconds.
     - **Scan:** decide whether something needs a closer look and find it.
     - **Commit:** have enough information, or a one-click path to it, to decide and act.

     The dashboard's face serves Glance and Scan. Commit is usually the drill-down or launch target.

1. **Identify the audience, their objectives and the dashboard's role.** Role is the classification that changes the visual design most:

   | | Strategic (executives, managers) | Analytical (analysts) | Operational (supervisors, operators) |
   |---|---|---|---|
   | Job | Quick overview of health and opportunities; high-level measures and forecasts | See what deserves investigation, then explore causes | Watch fast-changing activity and respond at a moment's notice |
   | Data freshness | Snapshots (monthly, weekly or daily) | Snapshots | Real time or near real time |
   | Context | Targets, brief history, simple good/bad evaluators; too many subtle gradations distract | Richer comparisons, longer history, subtler evaluators | Thresholds; specific detail (order number, owner, location), not high-level statistics |
   | Display media | Extremely simple | Can be more sophisticated; analysts will learn them | Very simple, since stress causes mistakes |
   | Interaction | Usually none: a one-way display, and executives may well read it on paper | Drill-down and links into analysis tools | Drill or hover for detail; alerts that grab attention immediately |
   | Volume | Broad overview | Rich | Few measures: too many overwhelms someone who must react fast |

   Other things to settle up front: type of data (quantitative or not), span (enterprise, department or individual), update frequency, interactivity (static, or drill and filter), and whether it acts as a portal to further data.

2. **List the measures, then answer seven questions for each one** (involve the real users wherever you can):
   1. At what level of summarization should it be shown?
   2. In what unit of measure?
   3. What context (comparisons, evaluation) does it need to be meaningful?
   4. What display medium expresses it best?
   5. How important is it relative to the others?
   6. Where in the viewing sequence should it come?
   7. Which other measures will viewers want to compare it with?

3. **Choose the medium for each item:** text, graphic, or both (see *Display media chooser*).
4. **Organize the layout:** group items, rank their importance and place them (see *Layout and organization*).
5. **Apply the two visual design goals in order:** reduce the non-data pixels, then enhance the data pixels.
6. **Iterate.** Mock up, critique with fresh eyes, redesign. Hunting for unnecessary pixels pays off on every pass.
7. **Run the Review checklist,** then test with real users and real data (see *Design process and testing*).

## Choosing and enriching measures

**What's typically shown:** quantitative measures of what's going on now, usually summarized. Totals are most common, then averages; measures of distribution are rare and correlation rarer still. The timeframe (year, quarter, month or week to date, yesterday, today so far) follows from the objectives.

**Never show a number alone.** "$736,502 quarter-to-date" means nothing: compared with what, and is it good? Give each measure context, usually one or more of these comparisons:
- the same measure at the same point in the past (this day last year)
- the same measure at another point in the past (end of last year)
- the current target (this period's budget)
- progress toward a future target (% of annual budget so far)
- a prior forecast for today
- progress toward a future forecast (% of the quarter's forecast)
- a norm (average, normal range, benchmark)
- an extrapolation (projected year-end)
- someone else's figure (a competitor's)
- a separate but related measure (order count against order revenue)

Measures can appear as a single value, a value with comparisons, a categorical breakdown (by region, or a frequency distribution), or a time series. Time series give the richest context. Several contexts can be combined, but keep the primary value visually prominent and subdue the context so a quick scan isn't bogged down. More context isn't automatically better: include it when it adds real value.

**Declare whether it's good or bad.** Evaluative encoding lets people judge a lot of data quickly. Evaluators needn't be binary, but keep them to a few states, no more than about five (very bad, bad, acceptable, good, very good). Beyond that they get too complex to read quickly. Show them with simple indicators that don't disturb the overall design.

**Choose the measure that states the message directly.** If what matters is variance from budget, show the variance ("−9%", perhaps with "−$8,066") rather than actual and budget, which leaves the viewer to subtract. To show deviation over time, plot variance as a percentage around a 0% reference line.

**Match precision to the task.** $3.8M, not $3,848,305.93; no seconds or ten decimal places on an overview. Each unnecessary digit costs reading time.

**Summaries and exceptions.** Summarize (sums, averages) instead of listing detail, and surface exceptions, the few values that need attention, instead of making people scan hundreds. Don't take management by exception too far, though: one "all OK" traffic light leaves leaders blind. People need a basic picture of what's going on even when nothing is wrong.

**Multi-focus history.** Recent history matters more than distant history, so show it at finer grain: for example the current month daily, the past 12 months monthly and earlier years annually, in adjoining sections. Express every panel in one unit (Few's example uses average *daily* ridership for years, months and days) so the panels can share a y-scale, labeled once on the leftmost panel, and make each panel's width proportional to its number of points. The same logic applies to distance in space (fine detail close to home, coarser further away).

**Cut anything the task doesn't need.** Don't pre-empt "always more" requests by including everything. Each removed item sharpens focus on the rest, and transaction-level detail never belongs on a dashboard.

**Non-quantitative content is legitimate:** lists (top 10 customers, issues to investigate, tasks due, people to contact), schedules (tasks, due dates, owners), and entity relationships (process steps, org structures) drawn as boxes, circles and lines, optionally carrying numbers such as durations or sizes.

## Visual perception essentials

**Short-term memory** holds about 3–9 visual chunks. Each number is its own chunk, but a well-designed graphical pattern (the shape of a line) is one chunk carrying a lot of data. Design so information can be taken in big visual gulps.

**Preattentive attributes** are perceived instantly and in parallel, before conscious attention. Reading digits or complex shapes is serial and slow. Use preattentive attributes deliberately to group, highlight and encode:

| Category | Attribute | Encodes quantity? | Typical dashboard use |
|---|---|---|---|
| Color | Hue | No | Categories; contrast highlighting |
| Color | Intensity (saturation and lightness) | Yes, roughly | Severity levels; qualitative bands; emphasis |
| Position | 2‑D position | **Yes, most accurately** | Data points on scales |
| Form | Orientation | No | Italics (harder to read, so use sparingly) |
| Form | Line length | **Yes** | Bars |
| Form | Line width | Yes, roughly | Emphasis (thicker borders, underlines) |
| Form | Size | Yes, roughly | Ranking importance (bigger titles or graphs) |
| Form | Shape | No | Distinguishing series; alert icons (simple shapes only) |
| Form | Added marks | No | An icon beside items that need attention |
| Form | Enclosure | No | Grouping; highlighting (border or fill) |
| Motion | Flicker | Yes, roughly (speed) | Only urgent real-time alerts |

- Encode quantities with **2‑D position and line length**. People badly underestimate area: a circle with four times the diameter has sixteen times the area. So avoid area encodings and avoid 3‑D entirely.
- Keep to **about five distinct values per attribute** (except length and position): five gray levels, five shapes. Shapes must be simple (circle, square, triangle, dash, X); most icons are too complex to register preattentively. You can tell more hues apart, but memory holds roughly nine meanings, and many hues look cluttered.
- **Define standard sets** of hues, intensities and shapes up front and reuse them everywhere.
- **Color is perceived relative to its surroundings.** The same gray looks lighter or darker on different backgrounds, and text is less legible on some hues. Check things look alike when they should and different when they shouldn't.
- **Flicker** is the strongest attention-getter and the most annoying. Reserve it for real-time operational alerts that need an immediate response.

**Gestalt principles:** use these to tie data together or set it apart without adding ink.
- **Proximity:** nearby items read as a group. White space alone is usually enough to separate groups. Spacing also sets scanning direction: tighter horizontal spacing makes people read across rows, tighter vertical spacing makes them read down columns.
- **Similarity:** shared color, size, shape or orientation links items, even far apart. Encode the same measure (say revenue) in the same color in every graph. The corollary is never to reuse a color for unrelated meanings.
- **Enclosure:** a border or a common fill groups strongly, even when faint. This is the strongest grouping cue.
- **Closure:** people complete partial shapes, so two axes define a plot area; no full box is needed.
- **Continuity:** aligned items read as belonging together. Alignment and indentation group table columns and hierarchy levels without grid lines.
- **Connection:** linked items group more strongly than by proximity or similarity, though weaker than enclosure. Use lines for process steps or org relationships.

Two challenges dominate dashboard design: making the most important data stand out, and arranging a lot of disparate data so it makes sense. The principles above are how you meet both. Knowing why they work lets you adapt them to situations this skill doesn't cover.

## Reduce non-data pixels, then enhance data pixels

Few adapts Tufte's data‑ink ratio to screens: every pixel needs a reason, and nearly always that reason should be that it shows data. A blank background doesn't count against you. Work in this order:

**1. Eliminate unnecessary non-data pixels.** Usually removable with no loss:
- decorative graphics, logos, photos, background images or maps, and simulations of real equipment (bezels, metal sheen, spiral binding, needles). If branding demands a logo, make it small and visually subtle, and put it somewhere out of the way.
- color variation that encodes nothing (a different color for each bar)
- borders around sections where white space would do
- fill colors behind titles, legends, plot areas or sections where a neutral background would do
- gradients (they also subtly distort how bar values are read)
- grid lines in graphs, which are rarely needed
- grid lines in tables, and alternating row fills, where white space works
- a full border around the plot area (two axes are enough)
- 3‑D and drop shadows

**2. De-emphasize and regularize the non-data pixels you keep.** Axes, section dividers, the occasional needed grid line or row fill (for tracking across dense rows, or comparing specific ranges): make them only just visible, with thin strokes and light, low-saturation grays. Make every element that serves the same purpose look the same, because viewers notice any difference and look for its meaning. Navigation, filter and selection controls show no data: if you need them, keep them small, muted and out of the way (the bottom-right is the least prominent spot). Instructions and descriptions go behind a single Help button or pop-up, not on the face of the dashboard.

**3. Eliminate unnecessary data pixels.** Keep only what the task needs, at the summarization level it needs (a quarter-to-date total, by region or by month, rather than transactions), and use exceptions.

**4. Highlight the most important data that remains.** There are two kinds of importance, and each takes different means:
- **Always important → static emphasis, mainly location.** Layout shouldn't change dynamically, since users learn where things live and scan faster for it. Emphasis by screen region:

  | | Left | Right |
  |---|---|---|
  | **Top** | **Emphasized** (reading order starts here) | Neutral |
  | **Bottom** | Neutral | **De-emphasized** |

  The **center** is also emphasized, but only when set apart from its surroundings with white space. Put the key metrics top-left (or center). Never spend that space on a logo, title art, navigation or data selection.
- **Important at the moment → dynamic emphasis** using color, added marks and so on, triggered by data conditions. Two ways to make something stand out:
  - expressions *greater* than the norm: darker or more saturated color intensity, bigger size, thicker line width
  - expressions that merely *contrast* with the norm: a different hue (blue text among black), a different orientation, enclosure, an added mark
- One of the best highlights, especially for items shown as text, is **a simple added mark** (circle, asterisk, checkmark) beside the item, in **one hue at varying intensities** for urgency. Intensity differences survive color blindness; distinct hues don't. Different symbols also work, but rising intensity is read more intuitively as rising urgency.
- Red isn't a universal danger signal; in China, for example, it connotes happiness. Never rely on hue alone.
- **Restrict what counts as important.** If everything is highlighted, nothing stands out. Once the prime positions are used up, dynamic means can also emphasize always-important data.

## Display media chooser

Pick each medium against two criteria: it is the best way to show that kind of data, and it still works small. Beyond that, a new visualization doesn't belong on a dashboard just because a vendor offers it.

**Text or graphics?** Text is read serially but is precise and ideal for lookup: a single value, or a table of values to find. Graphics give numbers shape and reveal patterns, trends and comparisons. A dashboard of isolated text measures supports lookup but hides the big picture. Most dashboards should blend the two, and often show a key measure both ways (bullet graph plus the actual figure), because people want the amount *and* how it compares.

A text-only measure can still carry evaluation and context. For example: `YTD Expenses $487,321` (bold it if it's a problem), then add `Target $450,000`, then a variance (`+$37,321` or `+8%`), or show the variance alone if that's all that matters.

| Data or message | Use | Avoid |
|---|---|---|
| A single measure with nothing to compare | Text (number plus label) | Any graph or gauge |
| A key measure against a target, with good/bad ranges | **Bullet graph** | Radial gauges, speedometers, thermometers, traffic lights |
| Recent history behind a current value | **Sparkline** next to the value | Up/down trend arrows (over what period?) |
| Values across categories with no order (regions, products) or ranked categories | **Bar graph** (horizontal or vertical), sorted by value when there's no intrinsic order | Lines connecting categories |
| Shape of a time series (trend, cycles, volatility, rate of change) | **Line graph** | Bars (unless individual periods matter) |
| Individual periods or adjacent-period comparisons (day vs. night crew per month) | Bar graph on the time scale | |
| Parts of a whole | **Bar graph**, labeled as % of total | Pie charts; one stacked bar |
| Several wholes with their parts, emphasis on the whole | Stacked bar graph; or parts as bars plus the total as a line on a second scale | Stacked bars when changes in the parts matter |
| Two series needing different emphasis (revenue and expense bars, profit trend line) | Combination bar and line graph | Arbitrary mixing |
| Ranked contributions and their concentration | Pareto chart (ranked bars plus cumulative line) | |
| Distribution of one measure (calls per rep per hour) | **Histogram**: bars for few intervals, a line for many | |
| Distribution compared across groups (salaries per grade, call durations per rep) | Range bars plus median, or a **simplified box plot** | Median alone when the spread matters |
| Build-up to or break-down of a total (revenue to net profit) | **Waterfall chart** (bars from zero, labeled steps) | Pies; unlabeled floating bars |
| Share of the total, few periods, when totals don't matter | **100% stacked bar** | Several pies side by side |
| Many items each with several measures | **Table with embedded charts** (sparkline, bullet graph and value per row) | A separate chart per item |
| Correlation between two measures | **Scatter plot** with a straight line of best fit | 3‑D scatters; extra encoded variables; curved fits for untrained users |
| Large hierarchy where conditions need spotting | **Treemap** (size = one measure, single-hue intensity = another) | Treemaps for precise comparison |
| Something needs attention | **Alert icon** that appears only when needed | Always-on red/yellow/green lights |
| Up or down vs. past or target | Up/down triangles | |
| Flagging items in a list | One on/off icon (checkmark, asterisk or X), used consistently | A mix of icons |
| Process flow, hierarchy, dependencies | Drawing objects (boxes, circles, lines, arrows) | |
| Meaning tied to physical location (incident locations, building temperatures) | Map or floor plan | Maps for a few sales regions with no spatial meaning |
| Same graph across one more variable (revenue by region × channel) | **Small multiples** with shared scales and labels | Selector widgets that show one slice at a time |
| Ranked findings with brief explanations | Text table | Graphics or alerts that add nothing |

Graph construction rules:
- **Bar scales start at zero**, because bar length is the value. Line graph scales needn't start at zero: they can be narrowed to just below the minimum and just above the maximum to show more detail.
- Draw **lines only along interval scales** such as time, because a line implies continuity between values. The exception is a Pareto chart's cumulative line.
- **Make the data the most prominent thing** in every graph. Axes and labels come second.
- **Label directly** (slice, bar or line labels) rather than through legends that make eyes bounce. Order bars by value when the categories have no natural order.
- **Put values that should be compared next to each other.** Actual beside budget for each region, not grouped by series. Stack graphs over-under when they share a time axis.
- Combining measures in one graph encourages comparison. Two quantitative scales (left and right axes) are acceptable for related measures in different units.
- **Right-align numbers** in tables, use thousands separators, and state units ("$ thousands") once in the header or label.
- **Repeat the same medium freely.** Varying chart types for variety forces a new perceptual strategy for every panel. Consistency lets one way of reading carry across the screen.
- **Never use 3‑D,** even when depth encodes a variable (bars hide behind bars). Also avoid bubbles, area graphs, radar graphs (tolerable only when the categories are naturally circular, like hours of the day), and bars that encode values with both height *and* width.

Further tips from the deck:
- Keep axis labels horizontal; if category labels won't fit, switch to horizontal bars.
- Leave gaps between bars of about half a bar's width.
- Use one color for a bar series, plus an accent color for the point that matters.
- Use **no more than four lines** per line chart; split anything more into small multiples. Use solid lines only for data, and label lines at their ends.
- Size the scale so line data spans about **two-thirds of the chart height**. Include zero on line charts when it doesn't flatten meaningful variation.
- Use the **same scale, order and placement** for charts meant to be compared. Never reverse an axis, or stretch or compress one to exaggerate.
- Compare **percentages, not counts,** when periods or groups have different totals.
- Use callouts and annotations to point at the important or interesting value.

Specifications and variants for every medium are in `references/display-media.md`. The deck's full chooser, its do's and don'ts for each chart type, and its "if you must" rules for pies and area charts are in `references/chart-practices.md`.

## Layout and organization

- **Group by business function, entity or use.** Functions are things like order entry or shipping; entities are departments, projects or systems; uses are things like comparing revenue with expenses. For someone who spans many units (a CEO), group and order by importance or by the sequence in which they build the overview. Learn how the information will actually be used before arranging it.
- **Co-locate items in a group.** Position is perceived preattentively.
- **Delineate groups by the least visible means.** White space first. If the layout is too dense, use light, thin borders; they can be surprisingly faint and still work. Avoid heavy title bars and loud colored section bands.
- **Support meaningful comparisons:** put items in the same table or graph where appropriate, place them near each other, link them with a shared color, and add comparative values (ratios, % of total, % of forecast, variances). Percentages express difference more directly than raw values.
- **Discourage meaningless comparisons:** separate unrelated items spatially and give them different colors. Don't let yellow mean "satisfactory" in one panel, "forecast" in another and "June" in a third.
- **Be consistent.** Anything that means the same thing or works the same way should look the same everywhere, down to axis-line weight. Use the same medium for the same kind of data and use.
- **Spend space according to importance.** Tangential data shouldn't get the biggest panels or largest fonts. Don't stretch graphs to fill gaps (blank space beats filler), and don't strand small tables in large empty areas when they could be bigger and easier to read.
- **Emphasize the current period.** When showing several quarters or months, make the current one stand out and the rest recede.
- **Don't fragment data meant to be seen together** into tabs, per-product screens, or radio buttons and sliders that show one slice at a time. Use filters and navigation to reach *other* information, not to split up one picture.
- **Filter strips:** many BI tools default to a row of prompts (filters) across the top, followed by two or three rows of report sections (Oracle's "1 column & 3 sections" layouts). If you use one, keep the strip thin and visually muted so the first row of data still holds the top-left emphasis.

## Color, text and aesthetics

Aesthetics matter. An unattractive dashboard puts viewers in a frame of mind that works against it, and a pleasing one relaxes them, which helps insight. Apply that care **to the display of the data itself**, never to ornament. The aim is the eloquence that comes from simplicity.

- **Muted, natural palette for normal content:** soft grays, browns, oranges, greens and blues, the colors of earth and sky. Keep bright, fully saturated colors for the few items that must grab attention. Few's samples use almost only grays, with one muted hue for section headings and red at two intensities for alerts. Too many bright or dark colors exhausts the eye.
- **Background:** a barely tinted off-white, softer than stark pure white. Avoid dark or heavy backgrounds and section-by-section background colors. Grays work as graph backgrounds only if light.
- **Hue for groups, monochrome for state.** Use hue subtly, to mark group relationships at the highest level. Use tints and shades of one hue for interactive state (the selected item, where the viewer is). Use **no more than about six colors** in one layout, and avoid vibrating pairs like red/green and blue/yellow. Ready-made tint-to-shade ramps and notes on what each color suggests are in `references/chart-practices.md`.
- **Color blindness** affects about 10% of men and 1% of women, mostly as red-green confusion. Never encode status with hue alone. Vary intensity within one hue (light red and dark red), or pair a bright red with a pale green, or use bold/black/gray text. When dark backgrounds are used to flag bad values, they make the most important numbers the hardest to read.
- **High resolution, crisp rendering.** Clarity comes from sharp simple graphics, not shading or photo-realism.
- **Text:** use the most legible font available, one family throughout, optionally a second for headings, and nothing ornate or themed. Don't use italics or underlining for emphasis. Use bold sparingly, only to flag items that need attention, or use size or an added mark instead.

## What Few's own designs look like

*These conventions come from the book's figures; the text never states them. Hex values were sampled from the printed figures, so treat them as close approximations.*

- **Palette tokens:**
  - Background: a warm off-white, about `#FEFFF5`.
  - Normal data, Few's "standard" set: `#BFC4BE` gray, `#BEA799` taupe, `#CDBF9A` tan, `#CBD282` khaki-green, `#7F99B0` steel blue.
  - Emphasis set, reserved for the few things that must pop: `#3C3638` near-black, `#ED3338` red, `#FC9632` orange, `#02A75A` green, `#0185C6` blue.
  - Alerts: one hue at two intensities, `#F3ABAE` light red and `#ED3338` red.
  - Bullet-graph bands: `#8E8E8E`, `#BFBFBF` and `#E0E0E0`, with the bar in `#333`.
- **The data leads; the title recedes.** The dashboard title is the largest text on screen but light, muted and regular weight, with "(Data as of …)" after it in small gray. In three of the four model dashboards, data holds the top-left (an alert strip, key bullet graphs) and the title sits in the center, to the right, or even in the bottom control strip.
- **Section headings:** one muted hue, a size up from body text, not bold, with a gray parenthetical qualifier for the timeframe or unit, e.g. "System Availability (Last 30 days)". Each section's mini-legend sits right-aligned on the same line in small type, e.g. "(▬ Actual │ Target ▒ Poor ▒ Good)".
- **Tables:**
  - Small gray column headers over one thin rule, a rule above any total row, and nothing else.
  - Headers wrap onto two lines and right-align over numeric columns.
  - Units go in the label ("Revenue QTD (millions)") or once in the title. Put $ only on the total row.
- **Graphs:**
  - No grid lines, no plot-area border, no fill. Axes are thin light gray with small ticks.
  - The unit label sits horizontally above the y-axis, never rotated, and the title sits above the plot.
  - Label series at their line ends, or color the title's words to match the series, instead of using a legend.
  - With two y-axes, color each axis and its title to match its series.
- **Metric rows** read left to right: sparkline (column headed with its window, e.g. "Past 12 Months"), alert-dot column, label, bullet graph, value. Bullet graphs stacked in one section share a single scale, printed once at the bottom of the column.
- **Separation:**
  - Sparse layouts use white space only.
  - The densest sample (web marketing) uses thin light-gray hairlines between sections.
  - Colored enclosure appears only as a highlight, such as a thin red box around the out-of-range reps.

## Interaction: design as a launch pad

A single screen can't hold everything, so dashboards should almost always be interactive. The two common interactions are **drilling down** into detail and **slicing or filtering** to narrow focus.
- **Launch from the data itself:** click a region's bar to see its states, or hover a point to pop up its exact value. This is intuitive and saves the space buttons would take.
- **Use the same launch action everywhere.**
- Alerts can link straight to a screen explaining what's wrong.
- **Operational dashboards:** new alerts may blink, and even sound, until acknowledged by clicking. If alerts have been silenced, show it (a "Reset alerts" control that turns yellow and eventually blinks). Fast-updating data can be distracting while someone investigates, so offer a freeze/unfreeze-updates control that visibly reminds them it's frozen and nags if it stays frozen too long.
- Show an "as of" timestamp for the data, and state the currency or units once.

## Design process and testing (Lean UX loop)

The deck's Lean UX cycle runs **Frame the vision → Design collaboratively → Experiment → Feedback and research**, then repeats. It works in small batches, learns before scaling, and favors making things over debating them. Few's testing rules slot into its last two steps.

- **Frame:** problem statement, hypotheses, proto-personas (see workflow step 0).
- **Design collaboratively, inside the team.** Everyone can contribute ideas, not just designers. Run a Design Studio (design charrette) with low-fidelity sketches:
  1. problem and constraints (30 min)
  2. each person sketches six ideas alone (15 min)
  3. present and critique (5 min each)
  4. iterate and refine (10 min)
  5. converge on team ideas (45 min)

  Check that the ideas cover every hypothesis. Keep the work visible on whiteboards and printouts.
- **Experiment.** Prototype from low to high fidelity, staying low as long as you can because it's cheaper and quicker to iterate. A prototype should answer three questions: is there a need, is there value, and is it usable? Be clear whether you're building a throwaway prototype or a minimum viable product, so it doesn't quietly become the build.
- **Then, with the users, present one prototype:** your best consolidated design, populated with **real data**, not a menu of alternatives. Users know what they need to accomplish but not how the display should be designed. That's the designer's expertise, just as letting customers design software through feature requests produces bloated, hard-to-use products. Try to stop users forming fixed ideas about the look before you've shown them a design.
- **Feedback and research.** Research continuously, as a team, and keep it non-specialized:
  - Agree on what you need to learn and which questions to ask, then interview real users in pairs: one asks, one takes notes.
  - Watch users make sense of the dashboard. Briefly teach any unfamiliar media (bullet graphs, sparklines) and explain why you chose them.
  - Collate findings with the team after each round. Act on **patterns**; park one-off outliers.
  - Verify across several sources and channels, so internal staff don't drown out actual customers.
- Expect refinement, not overhaul, if the homework was done. Nobody gets everything right first time, so test regardless and loop.

## Review checklist: the thirteen common mistakes

Run this against any dashboard you design or review. Each item is a failure to look for; the fix is in the section named in brackets.

1. **Exceeds one screen.** Scrolling is needed, or data that should be seen together is split across screens, tabs, per-item views or one-at-a-time selectors. [What a dashboard is; Layout]
2. **Inadequate context.** Bare numbers with no target, history or evaluation; gauges with unlabeled scales; a good/bad color with no indication of *how* good or bad. [Choosing and enriching measures]
3. **Excessive detail or precision.** Cents, seconds, many decimals, transaction rows. [Choosing and enriching measures]
4. **Deficient measure.** The viewer has to compute the real message (for example, showing actual and budget when the variance is the point). [Choosing and enriching measures]
5. **Inappropriate display media.** Pies (including pies of things that aren't parts of a whole), bubbles, radar graphs, maps without a spatial reason, graphs where text would do or text where a graph would reveal the pattern. [Display media chooser]
6. **Meaningless variety.** Different chart types used for the sake of variety. [Display media chooser; Layout: consistency]
7. **Poorly designed media.** Legends instead of direct labels; random slice or bar order; colors too bright or too similar; per-bar colors that mean nothing; heavy grid lines; 3‑D and occlusion; compared bars not adjacent; skeuomorphic meters (odometer digits without thousands separators, scale numbers hidden under needles). [Display media chooser; `references/display-media.md`]
8. **Inaccurate encoding.** Bar scales not starting at zero; values encoded as areas. [Display media chooser]
9. **Poor arrangement.** Logo or controls in the top-left; tangential data given the most space or the largest type; related graphs placed where they can't be compared; no sensible viewing sequence; loud section bars over-segmenting the screen. [Layout; Highlight]
10. **Important data not highlighted, or everything highlighted.** Everything equally bold and colorful, so nothing stands out; an alert dot on every row (green when fine), so the real alerts don't pop. [Highlight]
11. **Useless decoration.** Ornate logos and titles, equipment simulations, notebook spirals, filler graphics, background images or maps, gradients, photos. [Reduce non-data pixels]
12. **Misused or overused color.** Hue used without meaning; the same color with different meanings; dependence on red/green; too many saturated colors. [Color]
13. **Unattractive display.** Stretched graphs, dreary dark grays, clashing colors, decoration bolted on to compensate. [Color, text and aesthetics]

Extra checks from the deck. Fixes are in the *Display media chooser* rules and `references/chart-practices.md`:
- More than about six colors, or red/green or blue/yellow pairings?
- More than four lines in a line chart, or dashed or dotted data lines?
- Vertical or diagonal axis labels; bars too crowded or too far apart?
- Inconsistent ordering, placement or scales across charts that will be compared; a reversed or distorted axis?
- Counts compared where totals differ and percentages are needed?
- A pie or area chart that should be a bar or line chart? If one is mandated, does it meet the "if you must" rules?

A remove-to-improve pass: for each element, would anything be lost without it? If not, remove it.

Final test: with one glance, can the intended viewer tell (a) the state of the things they care about most, and (b) exactly which items need attention? If not, simplify further.

## Applying this in code and BI tools

*This section is a practical translation of the book's rules for modern tools; it isn't in the book.*

- Design for the viewer's actual screen size and make the whole dashboard fit with no page scroll. If it won't fit, cut, summarize or condense the media; don't shrink text below legibility or add scrolling.
- Chart libraries' defaults break many of these rules. Turn off grid lines, chart borders, 3‑D, gradients, shadows, entry animations, background images and auto-assigned rainbow palettes; prefer direct labels to legends. Define the palette (muted base colors, one alert hue at two intensities, an off-white background) as named tokens and reuse them; Few's sampled values are in *What Few's own designs look like*.
- Most tools have no bullet graph or sparkline built in. Build them: a bullet graph is a horizontal bar over two to five gray bands with a short perpendicular target tick, and a sparkline is a tiny axis-less line. Both are a few lines of SVG or a horizontal bar chart with layered series. See `references/display-media.md`.
- Drive dynamic highlighting (alert dots, bolding) from data thresholds in code, never by hand.
