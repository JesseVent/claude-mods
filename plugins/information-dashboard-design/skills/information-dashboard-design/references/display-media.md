# Dashboard display media library

These are the detailed specifications behind the *Display media chooser* in SKILL.md, following Few's chapter 6 library. Each medium earns its place by meeting two criteria: it is the best way to show a common kind of dashboard data, and it still works when drawn small.

Contents:
1. Graphs: bullet graph, bar, stacked bar, bar+line and Pareto, line, sparkline, box plot, scatter plot, treemap
2. Graphs left out, and why
3. Icons: alert, up/down, on/off
4. Text, images and drawing objects
5. Organizers: tables, spatial maps, small multiples

---

## 1. Graphs

### Bullet graph (Few's replacement for gauges and meters)

**Use for:** one key measure against one or more comparative measures (target, last year), set against qualitative ranges (bad, satisfactory, good).

**Anatomy**, laid out horizontally or vertically:
- **Text label** at the start, with its unit underneath (e.g. "Revenue 2005 YTD", "(U.S. $ in thousands)").
- **Quantitative scale** along the bar, with labeled tick marks.
- **Background bands** showing the qualitative ranges as **intensities of one hue**: grays by default, though any hue works (beige, for instance). In Few's examples the darkest band covers the poor range. Use two to five bands, with three typical. Intensity rather than hue keeps it readable for color-blind viewers.
- **Bar**: a dark, thin bar centered over the bands that encodes the key measure.
- **Comparative marker**: a short line perpendicular to the bar at the target value.

**Proportions, as drawn in Few's figures (6‑6 to 6‑14):**
- The bar is about a quarter to a third of the band height.
- The target marker is a thin line about three-quarters of the band height.
- With its scale, the whole graph is about two text lines tall.
- The label right-aligns against the graph: the measure name larger and bold, its unit underneath in small gray.
- Band grays run `#8E8E8E` (poor), `#BFBFBF`, `#E0E0E0` (good), with the bar in `#333`. With five bands, go from darkest (poor, at the left) to lightest.

**Why it works:** it's linear, so many bullet graphs stack tightly in rows or columns, where radial gauges waste space and can't pack together. When the bar passes the target marker it forms a **cross**, which is perceived preattentively, so a column of bullet graphs shows at a glance which measures have met target. In Few's informal tests, bullet graphs were read faster and more accurately than radial gauges, in far less space.

**Variants:**
- **Several comparisons:** give each comparative measure its own marker, distinguished by stroke weight (one thick, one thin; Few draws the secondary one thinner and shorter), by intensity, or at a pinch by symbol shape.
- **Scale not starting at zero:** to zoom into a narrow range (all values between 150 and 300, say), drop the bar, which would misstate its length, and show the key measure as a **symbol marker** (a dot), with the target as a short line. The marker itself tells viewers the scale doesn't start at zero. With a bar, the scale must start at zero.
- **Projection toward a future target:** split the bar into a dark segment for actual-to-date and a lighter segment extending to the projected period-end value, so viewers see both progress and whether they're on track for the target.
- **Percent-of-target scales** (0–150%, 0–250%) let measures in different units share one aligned scale in a stacked list. Few's sample sales, CIO and telesales dashboards all do this, printing the shared scale **once** at the bottom of the column instead of under every row. The telesales sample goes further and runs the bands and the 100% target line continuously through all three rows, so the set reads as one graph. When rows keep their own units (Fig 6‑8), each row keeps its own scale, and the rows' left edges still align.
- A combined legend such as "▬ Actual │ Target ▒ Poor ▒ Satisfactory ▒ Good" (or "Good / Excessive / Critical") once per section.

**Problems with the gauges it replaces:** circular shapes waste space and don't pack together; thermometers waste space on realism; scales are often unlabeled or have numbers inside the arc where the needle covers them; captions sit where the needle points; odometer-style digits have no thousands separators; colored needles say good or bad but not *how* good or bad; red zones sit in confusing places. If you do use a gauge, at least label the scale and color the ranges rather than the needle. Better still, use a bullet graph.

### Bar graph

**Use for:** several instances of one or more measures across **categories**, compared value against value.

Understand the three categorical scale types first:
- **Nominal:** items differ in name only (regions, departments). They have no order.
- **Ordinal:** items have an order but no quantitative value (A/B/C; small, medium, large; poor through excellent).
- **Interval:** ordered items that also stand for equal-sized ranges of a quantity (55–60, 60–65 …). **Time units are interval scales** (years, quarters, months, days).

Rules:
- Nominal or ordinal scales always get **bars, never lines**. Lines imply continuity between values, which doesn't exist there.
- On an interval scale, use bars when the point is **individual values or comparisons between adjacent values** (day crew vs. night crew output each month). Use a line when the point is the overall shape.
- **Part-to-whole data:** use a bar graph rather than a pie, and say "% of total" in the title, since bars don't announce part-to-whole the way pies do.
- Scale starts at zero. Sort by value when categories have no intrinsic order, and keep compared series adjacent within each category (actual next to budget). Orient vertically or horizontally as space and labels require.
- One neutral color per series. Different colors per bar are only for real distinctions, such as highlighting "Our Company" in dark gray among competitors.
- **Drawing, from Few's figures (6‑15, 6‑16, 6‑21, 6‑22):**
  - Bars in a pair touch, with a gap of about one pair's width between categories.
  - Horizontal bars carry right-aligned category labels at their left.
  - In a ranked part-to-whole list, print the value between label and bar ("Competitor A 29.9%"), sort descending, and put "All Others" last whatever its size.
  - Highlight your own item with a dark bar and a bold label among light-gray ones.
  - To tell two series apart without color, use a dark gray fill against a white fill with a thin dark outline.
- **Histograms** (Fig 6‑35) use one muted hue and narrow gaps (about a fifth of a bar's width), because the bins are contiguous intervals. Small multiples of histograms keep identical scales.
- The deck's construction tips (horizontal labels, gaps of half a bar's width, ordering, when to stack or use 100% stacked bars) are in `chart-practices.md`, section 2.

### Stacked bar graph

- **Never** use one for a single series of parts of a whole; a plain bar graph reads much faster.
- Use it only for **several instances of a whole and its parts, when the emphasis is on the whole** (quarterly revenue split by channel). Only the bottom segment can be compared accurately across bars.
- When changes in the parts matter, use either two graphs side by side (one for the whole, one for the parts as grouped bars), or a combination graph with the parts as bars and the whole as a line on a second scale.
- Stacking is a good fit when the sum itself is meaningful against a reference. Few's sales dashboard stacks actual revenue plus pipeline (by probability tier) against the target marker.
- Shade the segments as a ramp of one gray or hue, **darkest at the bottom** (the one segment comparable across bars), and label them directly beside the last bar instead of with a legend (Fig 6‑24).
- Whether you group bars by quarter or by channel decides which comparison is easy (Fig 6‑25). Put the bars you want compared next to each other.

### Combination bar and line graph, and the Pareto chart

- Combine bars and lines only when some data needs emphasis on individual values or local comparisons (bars: monthly revenue and expenses) and other data needs emphasis on overall shape (line: the profit trend).
- **Parts as bars, whole as a line,** on separate left and right scales. This avoids the dead space a single scale would leave between the small parts and the large total. Title each axis at its top ("Per Sales Channel", "Total Sales"), label the line at its end ("Total"), and color each axis and its labels to match its series so no legend is needed (Figs 6‑27 and 7‑2).
- Few's revenue/expense/profit example (Fig 6‑26) draws revenue bars above zero, expense bars below zero, and profit as a darker, thicker line across them.
- **Pareto chart:** categories ranked in descending order as bars, plus a cumulative-total line (often as a % of the total). It is the one sanctioned exception to "lines only on interval scales", because each cumulative value is built from the one before, so the connection is real. A steep early slope shows concentration (e.g. 3 of 10 reps produce 75% of revenue). A flatter line shows even contribution. Few adds a thin gray reference line at the threshold that makes the point (75%) and puts rank numbers in the category labels ("1 Sharon Stuart") (Fig 6‑28).

### Line graph

**Use for:** the shape of data over time: trends, fluctuations, cycles, rate of change, and how two series move together. For a time series on a dashboard, the shape is usually what's needed, so the line graph is often the best quick overview.

- Unlike bars, the scale **need not start at zero**. You can narrow it to just below the minimum and just above the maximum, so the data fills the plot area and shows more detail.
- The data lines must be the most prominent element in the graph.
- **Deviation graphs:** plot the percentage variance from a target, prior period or running average around a 0% reference line when deviation is the message. Few's web marketing sample uses three of these at different time scales.
- Distinguish several lines by gray intensity (about five at most), or by hue/weight with the key line darkest.
- **Multi-focus time series:** place adjacent graphs at decreasing resolution, e.g. this month by day, the last 12 months by month, the last 10 years by year.
- The deck adds: at most four lines per chart (split beyond that), solid lines only, direct end labels, and data spanning about two-thirds of the height. See `chart-practices.md`.

### Sparkline (Edward Tufte)

**Use for:** compact historical context beside a current value: "data-intense, design-simple, word-size graphics".

- A tiny line with **no axes and no scale**. It isn't for precise reading; the exact current value sits next to it as text. It shows whether the trend is up, down, volatile or seasonal over a fixed window (rolling 12 months, 30 days, today by hour).
- **Size:** about the height of a text line and six to ten times as wide. Draw it as a thin dark-gray line with no markers except the optional final dot. Place it immediately before the label or value it explains (Figs 6‑30 to 6‑33), and name its window in the column header ("Past 12 Months").
- Optional: a **light gray band** for the normal or acceptable range, so excursions stand out. Also optional: a **dot on the final point**, colored to match the current value's text (red when flagged), to tie the line to the number.
- **Replaces trend arrows,** which never say the period they cover (since yesterday? this year?). A sparkline shows the whole period.
- A common row pattern: `[sparkline] [alert dot] label  [bullet graph]  actual value`.

### Box plot (John Tukey), simplified for dashboards

**Use for:** distributions, where a sum or median alone hides how values spread (salaries per grade, call durations per rep, application response times).

From least to most informative:
1. Median only: says nothing about spread.
2. **Range bar** (lowest to highest value): spread, but not where values cluster.
3. **Range bar plus a median mark**: a median near one end shows skew, and this is often enough for a dashboard.
4. **Simplified box plot** (recommended): a thin line from lowest to highest value, with no end caps; a box from the 25th to the 75th percentile, i.e. the middle 50%, filled very light gray with a thin dark outline; a solid line across at the median.

As drawn in Figs 6‑36 and 6‑37, range bars are mid-gray rectangles, with the median as a short dark line across them.

The full box-and-whisker plot with outliers is usually too rich for dashboards and their audiences. An acceptable range can be shown as a light band behind the box plots.

### Scatter plot

**Use for:** whether two paired measures are correlated, in which direction (positive or negative slope), and how strongly (tightness around a trend line). Example: monthly ad count against sales revenue over 24 months.
- Add a **straight line of best fit**. It makes direction and strength stand out much faster. Avoid curved fits unless the users are trained to read them.
- Several data sets (radio vs. TV ads) can share one plot, with distinct simple markers and a fit line for each.
- **Drawing (Figs 6‑40 to 6‑42):**
  - Use hollow circles, so overlapping points stay visible.
  - Draw the trend line noticeably heavier than the markers.
  - With two sets, give each its own muted hue for markers, trend line and an end label ("TV Ads", "Radio Ads"), instead of a legend.
- **Don't** add a third variable through 3‑D or other encodings on a dashboard; it takes too long to interpret.
- The deck adds: no more than two trend lines per plot (see `chart-practices.md`).

### Treemap (Ben Shneiderman)

**Use for:** large hierarchical or categorical sets in the least space, to **spot conditions**, not to compare values precisely or rank them.
- Nested rectangles fill the space. **Size** encodes one measure (revenue) and **color** a second (% of quota).
- Prefer **one hue varying in intensity** (white for best, saturated red for worst), so the large dark rectangles, the biggest problems, jump out. Use a red-to-green diverging scheme only if the line between below and above target truly matters; a state slightly under quota and one slightly over are rarely that different.
- Usually interactive: click a rectangle to drill into the next level of the hierarchy.

## 2. Graphs left out, and why

Each was left out because something else communicates better, or because it's too complex for dashboard use:
- **Pie charts:** they encode values as area and angle, which people judge poorly. Without value labels you can only tell the largest slice from the tiny one. Their only merit is announcing "parts of a whole", and a bar graph labeled "% of total" does the same job better. They're also misused for things that aren't parts of a whole, such as separate cancer probabilities. Pie problems compound: legends instead of labels, random slice order, colors too bright or too alike to match (eleven shades from yellow to red). If a pie or area chart is mandated anyway, follow the "if you must" rules in `chart-practices.md`.
- **Area graphs, bubble charts and 2‑D-sized shapes:** area is underestimated (a circle three times the diameter has nine times the area), and nested bubbles create optical illusions. Stacked areas also **occlude**, hiding entire series behind others.
- **Radar graphs:** a line graph wrapped around a circle, and harder to read than bars. They're tolerable only when the categories are naturally circular (hours on a clock).
- **3‑D anything:** depth that encodes nothing distorts values. Depth that does encode a variable (quarters behind regions) hides bars behind other bars. Avoid it, practically without exception, for business data.
- **Bars that use both height and width** to encode two values: viewers compare the areas and get it wrong.
- **Custom encodings that need a separate key** (colored shapes in a positional grid): they're slow to learn, imprecise even once learned, and worse at showing trend than a simple line.

## 3. Icons

Only a few are needed, and each must be simple and clearly understood.

- **Alert icon**: "look here".
  - Ideally **one level**, at most two. Ten graded variants are far too complex.
  - A simple **circle or square** (Few's samples use red dots beside the item), shown **only when attention is needed**. An icon that appears is an *added mark*, which is preattentive. An always-present traffic light only changes color, adds nothing, and draws less attention. A green "all is fine" light serves no purpose.
  - For two levels, keep **one shape and one hue at two intensities** (light red about `#F3ABAE`, red about `#ED3338`) rather than red/yellow/green, which about 10% of men can't tell apart. Few's color-blind simulation (Figs 6‑47 and 6‑48) shows green and red collapsing into the same tan, while light vs. dark red stays distinct.
  - Draw the dot about the cap height of the text, in its own narrow column left of the item's label. Rows that need no alert get nothing, not a green dot.
- **Up/down icon**: a triangle or arrow pointing up or down, for direction against the past or a target. If you color it good/bad, vary **intensity as well as hue** (saturated red for the wrong direction, pale green for the right one) so it survives color blindness.
- **On/off icon**: a flag marking some items as different, such as deals close to closing, featured products, "you are here" on a schedule, or reps currently offline. Use checkmarks, asterisks or Xs. Pick one and use it consistently. Few draws them in a muted gray, because they flag rather than alarm, and explains them with a key such as "(X = Currently offline)".

## 4. Text, images and drawing objects

- **Text:** every dashboard has some. It carries category labels, single measures that need no comparison (shown as a simple value with a label, e.g. `YTD Revenue (U.S. $)   $463,098`), ranked lists and short explanations. It's the medium for precision and lookup. Pick fonts for legibility.
- **Images** (photos, illustrations, diagrams): rarely useful in business dashboards. Legitimate cases include a trainer seeing photos of today's attendees, a maintenance map of rooms needing new bulbs, or a police map of the last 24 hours' incidents. Decorative photos are chartjunk.
- **Drawing objects** (rectangles, circles, lines, arrows): for process flows (including branches), hierarchies such as org charts, project task dependencies, and breakdowns of a figure into components (net revenue from its parts). Use rectangles and circles to tell entity types apart; lines show connection and arrows add direction. Drawing objects also group and highlight. Few's two examples:
  - **Fig 6‑52, a net-income breakdown:** a left-to-right tree whose nodes are mini bullet graphs (label and value on one line, the graph below, an alert dot where needed), joined by thin gray elbow connectors.
  - **Fig 6‑53, a project plan:** each task is a lightly outlined box labeled inside, with a dark bar inside the box showing % complete, thin arrowed connectors for dependencies, and a date scale along the bottom.

## 5. Organizers

- **Tables:** rows and columns, not only of text. Graphs, icons and sparklines arranged in a table make a compact, scannable structure, e.g. one row per metric with a sparkline column, a bullet graph column and a value column. Right-align numbers. Separate columns and rows with white space and alignment (continuity), adding light rules or faint row fills only when the eye can't otherwise track across a row.
  - Few's tables (Figs 5‑2, 6‑54, 7‑1, 7‑3) use one thin rule under the header, one above any total row, and nothing else. Headers wrap onto two lines, right-aligned over numeric columns, and $ appears only on the total row.
  - When rules or fills are needed: a separate group column (such as a YTD total) gets a very light gray fill (about `#EEE`) and a thin light vertical rule, and alternating rows get a band of about `#F0F0F0`, never mid-gray (Figs 5‑20 and 5‑21).
  - Few's redesign of a red/yellow/green text scorecard (Fig 6‑4) uses four borderless Metric | Actual | Target tables. Bold marks bad, black marks warning and gray marks good, applied to both value cells, and each metric name carries its unit in parentheses.
- **Spatial maps:** geographic maps or floor plans, used **only when location is part of the meaning** and patterns couldn't be seen otherwise (absenteeism clustering by store location, temperature by building zone). Four sales regions on a US map add nothing that a small table doesn't say better.
- **Small multiples** (Tufte): the same graph repeated in a row, column or matrix, each copy varying along one variable (revenue by region for each of three channels). Everything stays within eye span, comparisons are easy, and you get a dimension that one graph couldn't hold without a selector widget. Use identical scales and don't repeat what's shared: category labels, legend and title appear once. In Few's example (Fig 6‑57), the region labels appear only on the first panel, the same x scale is labeled under each panel, the unit ("U.S. $") appears once at the start of the scale row, and one legend sits at the right. Few hoped dashboard tools would generate these automatically; when building in code, write the loop.
