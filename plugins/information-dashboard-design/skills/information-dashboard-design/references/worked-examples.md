# Worked examples: Few's model dashboards and a catalogue of failures

Use the four model dashboards as layout patterns to adapt, not templates to copy; Few stresses that the right measures depend on the specific users. Use the failure catalogue when reviewing someone else's dashboard, because most real dashboards show several of these at once.

Contents:
1. Model dashboards: sales (strategic), CIO (strategic + operational), telesales (operational), web marketing (analytical)
2. Failure catalogue: eight competition entries critiqued, vendor-demo failures, and failures visible only in the figures

---

## 1. Model dashboards

All four share the same visual system:
- **Background and color:** a warm off-white background (about `#FEFFF5`) and grays for nearly everything. Section titles take one muted hue: gold-brown for sales, green for the CIO, slate blue for marketing, light gray for telesales. Red, at one or two intensities, is used *only* for alerts.
- **Separation:** white space between sections in the sales and CIO dashboards. The denser marketing dashboard adds thin light-gray hairlines; telesales has a faint outer border and one vertical divider.
- **Title:** large but light and not bold, with an "as of" timestamp. Except on the sales dashboard, data holds the top-left and the title sits elsewhere.
- **Units and help:** units are stated once, and a single small Help button replaces on-screen instructions.
- **Sections:** each section heading carries a gray parenthetical qualifier ("(Last 30 days)"), with its mini-legend right-aligned on the same line. Column headers sit in small gray type over one thin rule.
- **Scales:** a column of bullet graphs shares one scale, printed once at its foot.

SKILL.md turns these conventions into rules under *What Few's own designs look like*.

### Sales dashboard (strategic: a sales manager)
Measures: sales revenue, revenue in the pipeline (by probability tier), profit, customer satisfaction, top 10 customers, market share.

Layout (a 2 × 3 grid of sections):
- **Top-left, the prime position: "Key Metrics YTD"**, a table with one row per metric (Revenue, Profit, Avg Order Size, On Time Delivery, New Customers, Customer Satisfaction, Market Share). Columns: a 12-month **sparkline**, a red **alert dot** where needed, the metric name, a **bullet graph of % of target** (0–150%, shared by all rows because the units differ), and the **actual value** as text (e.g. $913,304; 104%; 4.73/5).
- **Top-right: Market Share**, a horizontal bar graph of % of total market by company, sorted, with "Our Company" picked out in a darker gray.
- **Middle-left: Revenue YTD by region**: sparkline, region, bullet graph of actual vs. target in $, actual, and % of total. Alert dot on the lagging region.
- **Middle-right: Revenue QTD by region**: **stacked bars of actual plus pipeline** (pipeline split by probability, e.g. 90% and 75%) against a target marker, so the manager sees whether actual plus likely revenue reaches target. Alert dots on regions that won't.
- **Bottom-left: Product Sales YTD**: sparkline, product, paired bars for revenue and units vs. target, and revenue.
- **Bottom-right: Top 10 Customers in the Pipeline**: a ranked text table (pipeline, QTD, YTD).

Why it works: color is used sparingly, so alerts pop; key metrics hold the top-left; sparklines and bullet graphs pack dense information without clutter; important measures appear both graphically (vs. target) and as text (the amount); only white space separates groups; there's one Help button and no instructions.

### CIO dashboard (strategic, with one operational corner)
Measures: system availability, expenses, customer satisfaction, severe problem count, CPU and storage usage vs. capacity, network traffic, application response time, major project milestones, top projects in the queue, other critical events.

- **Top-left: the only near-real-time section**, a "Now" strip naming five critical systems (Network, ERP, Data Warehouse, Web Site, Email). A red circle appears above a system only when it has a problem; no circles means all is well. Alerts can blink (even with rising sound) until clicked, and link to a screen explaining the fault.
- **System Availability (last 30 days):** per system, a 12-month sparkline, an alert dot, a bullet graph of availability % on a narrowed 85–100% scale with an acceptable-level marker, and the value.
- **Hardware % of Capacity:** CPU (today's sparkline) and storage (12-month sparkline), each with a bullet graph banded Good / Excessive / Critical.
- **Daily Network Traffic:** one line graph by hour with three lines (yesterday, the 7-day daily mean, the 6-month daily mean), so today's pattern reads against the norms.
- **Response Time:** simplified **box plots** of the distribution in seconds per application, over an acceptable-range band.
- **Right side, strategic:** Key Non-System Metrics (expenses YTD, customer satisfaction, level-1 problems) as sparkline + bullet graph (% of target) + actual; **Major Project Milestones** table with alert dots and days until or past due; **Top 5 Projects in the Queue** (sorted by priority, with status, an X for funding approved, and scheduled start); **Critical Events, next 14 days** (event, owner, date).

Why it works: a lot of data with no clutter, because non-data pixels are minimal and white space separates sections. The only hues are a muted green for section names and two intensities of red, always meaning "alert", so problems are found at a glance. Putting upcoming projects and events beside system health invites useful questions about readiness.

### Telesales dashboard (operational: a supervisor of about 25 reps, watched all day)
Deliberately limited to **six measures**, because more would overwhelm someone reacting in real time: hold (wait) time, call duration, abandoned calls, call volume, order volume, rep utilization.

- **Top-left: Overall Performance**, the three most critical metrics (Hold Time, Call Duration, Abandonments), each as a bullet graph of % of target (0–250%), the actual value, and a sparkline of today compared with target. The three bullet graphs share continuous background bands and a single 100% target line running through all three rows, with one scale at the foot. Two alert intensities (light red and dark red circles) mark problems.
- **Utilization:** a bullet graph of reps online vs. reps today on a narrowed 75–100% scale.
- **Volume:** a small text table (this hour, today, this month) with a per-hour sparkline for calls and orders, plus two **histograms** showing the distribution of mean hourly calls and orders per rep.
- **Right side: Rep Performance**, every rep **ranked worst-first**, with orders/hr, calls/hr, and call duration as simplified box plots on a shared scale (printed at both the top and the bottom of the long column, with the band legend at the bottom right). A thin red rectangle **encloses** the reps outside the acceptable range. An **X** flags reps who are currently offline. Clicking a rep sends an instant message (launch from the data).
- **Bottom strip, out of the way:** the title (large, in light gray) plus Reset Alerts, Freeze/Unfreeze Data and Help. On a screen watched all day, the title is the least useful thing, so it gets the least prominent spot.
- **Behavior:** data updates every few seconds. Freeze stops updates while investigating; the button turns yellow when frozen and blinks brighter if left frozen too long. New alerts blink, and may sound, until clicked. While alerts are silenced, Reset Alerts turns yellow and eventually blinks.

The diagnostic flow is built into the layout: notice a problem at top-left, then look right to find which reps are causing it.

### Web marketing analysis dashboard (analytical: a site marketing analyst)
Measures: visitors (daily, monthly, yearly), orders, registered visitors, product views, products shown together but rarely bought together, products bought together but not shown together, top referring sites.

- **Header:** MTD visitors and orders vs. target as bullet graphs (top-left); title with "Data as of" timestamp and Help (center); today's % of visitors who are registered or repeat as bullet graphs (top-right). The corners go to data, the center to the title.
- **Visitors: a multi-focus set of three deviation line graphs.** Last 12 months: average daily visitors as % deviation from the same month a year earlier. This month: daily visitors vs. the 13-week running average for the same weekday. Today: hourly visitors vs. the 13-week running average for the same hour. Detail increases toward the present, and each compares against an appropriate norm.
- **Products:** last-30-days sparkline, top 10 products this month by revenue, and a bar of revenue % with a thin tick for viewed % on the same row (one shared 0–16% scale along the top), so mismatches between interest and sales show.
- **Ranked text lists:** the top 10 product pairs often bought together but not displayed together, and the top 10 displayed together but rarely bought together (%, product 1, product 2). Text suits these, because the analyst must read each entry to decide whether to investigate. Being on the list already signals importance, so alerts would add nothing.
- **Referral Sites:** 12-month sparkline, top 10 referrers, referral count, % of total, change vs. a year ago, average revenue.

Ranked lists of exceptions (best and worst) are typical of analytical dashboards. The dashboard tells the analyst where to look and ideally launches straight into the analysis tools.

### Oracle patterns (from the Lean UX deck)
- **Glance → Scan → Commit.**
  - **Glance:** a grid of summary tiles gives the state of things at once.
  - **Scan:** a set of cards or short lists lets the viewer decide what deserves a closer look.
  - **Commit:** a detail view holds enough information to act.

  Few's model dashboards combine Glance and Scan on one screen, with Commit as the drill-down or launch target.
- **"1 column & 3 sections" layouts:** a prompt (filter) strip across the top, then two or three stacked rows of report sections in a few variants: two reports over one wide report; three over one; three over two; three over three. These are serviceable grids. Applying Few, keep the prompt strip thin and muted, put the most important report in the first row's left slot, and keep rows aligned so related reports can be compared.

---

## 2. Failure catalogue

### Eight competition entries for the same sales brief (Few judged a DM Review contest)
1. **Text-only with colored cells.** Text is read serially and slowly, the opposite of a glance. Comparing actual to target needs mental math, where a graphic would show it instantly. Numbers are center-aligned, not right-aligned, so columns are hard to compare. Required measures are missing (pipeline, top 10 customers). All four quarters get equal emphasis when the current quarter matters most. A soft red and a soft green that color-blind viewers can't tell apart. The worst numbers, which should be easiest to read, sit on dark red backgrounds.
2. **Heavy grid lines in tables** ("imprisoning" the numbers) and in graphs. Drop shadows on bars, lines and pies. Every value shown only as a percentage, when managers also want amounts. A pie where a ranked bar graph would do better. Too many bright colors, so nothing important stands out. A revenue history with no breakdown by region or product to compare trends.
3. **Radio buttons to choose the quarter** fragment the data and prevent comparison over time. **Photographs** (chartjunk) and a logo fill the prime top-left. Bars carry printed numbers instead of showing the target visually. Targets are drawn as **lines across nominal categories** (products, regions), so the line shapes mean nothing.
4. **Headache colors:** dark, dramatic backgrounds and a different background color per section. Too much white space around small tables that should have been enlarged.
5. **Sliders and radio buttons beside each graph** show one measure at a time, preventing comparisons between regions. Candy-colored, photo-shaded 3‑D pies dominate the screen. Shaded bars and buttons pop out for no reason.
6. **Clever circular time displays** with hue-coded status: less intuitive than a line graph, showing only the status (no actual amounts, no distance from target), and giving all periods equal weight with no focus on the current quarter. **Gradient fills on bars** subtly change how long the bars look.
7. **Bars encoding two values** by both height and width (share of the whole as height, performance vs. target as width). It saves space but forces area comparisons people can't make accurately, so it takes too long to read.
8. **A novel encoding** of colored shapes inside rectangles whose position stands for a measure, which needed a separate key (nine states from "panic low" to "panic high"). It's hard to learn, still imprecise once learned, and placing the rectangles side by side for each period conveys trend far worse than a simple line graph.

### Failures in the book's vendor and sample screenshots (chapters 3 and 6)
- A bank's executive view split into **10 separate screens** (highlights, deposits, past-due loans, profitability, growth, loans, risk, deposit mix, channels, market share) that executives need to see together. Daily sales split into **20 per-product screens**.
- A **scrolling** page, with a scrollable box that showed only its first metric.
- **Gauges with no scale labels**, colored arrows saying good or bad but not how much, and lots of space spent saying what one line of text could ("YTD Units 7,822").
- Times to the **second** and measures to **ten decimal places**.
- Actual and budget plotted separately when the **variance** was the message.
- A **pie of independent probabilities** (not parts of a whole); a **bubble chart** where one circle's three-times diameter meant nine times the value; nested bubbles creating size illusions; an **unlabeled radar graph** for regional actual vs. budget; a **US map** colored by four regions that added nothing to the adjacent table.
- A **jumble of different chart types**, each needing a new way of reading.
- **Odometer-style meters** with no thousands separators, scale numbers covered by the needle, and captions where the needle points.
- **Bars in rainbow colors** with no meaning, plus a 3‑D effect and a patterned background; actual and budget bars **not adjacent**; 3‑D bars **hiding** a quarter's value; a bar scale **starting at $500,000**, making revenue look four times costs when it was less than double.
- The **logo and navigation in the top-left**; tangential "returns" graphs given the largest area and fonts; bright red title bands over-segmenting the screen; two related trend graphs placed side by side instead of stacked for comparison.
- **Everything equally bold and colorful,** so nothing stands out.
- **Decoration:** an electronic control-panel simulation, a spiral-notebook page, a filler "explosion" of circles (blank space beats meaningless decoration), an ornate logo and title across the whole top, heavy gold and blue backgrounds with gradients, and maps behind graphs.
- **Unattractive:** sections stretched to fill space, a too-dark gray background, and a decorative image bolted on to liven it up.
- **Text-based status grids** using red/yellow/green boxes. Few's redesign put the measures into tables and replaced the colors with **bold / black / gray text** so color-blind users can read them. That improves lookup, but it still shows no patterns, so add graphics where comparison or trend matters.

### Failures visible only in the pictures (chapters 1, 3 and 7)
- **Adjacent gauges whose scales run in opposite directions** (two of a row of gauges run 20 → −100), so the same needle angle means opposite things side by side.
- **An alert dot on every row,** green when fine and red when not, so the red ones don't pop. Show a dot only where attention is needed.
- **Machine-formatted numbers:** tick labels like "$0.00008M" and "10.000%", placeholder labels ("Row 1", "Column 3"), values with no thousands separators (1094308.41), truncated column headers ("TOT…").
- **Rotated or vertical labels** on 30-bar date axes and on column headers.
- **Saturated red/yellow/green bands** behind bars whose scales start at 15 or 8. Few's bullet graph replaces them with gray intensities and a zero-based bar.
- **Bullet-point instructions printed on the dashboard face,** and an actual-vs-budget bar pair on a $4.55M–$4.65M scale.
- **A navigation tree** claiming the whole left column; brushed-metal frames and bezels; beveled dark panels; a navy title band with a stock photo.
- **One color, several meanings:** yellow meant "forecast" in one panel, "June" in another and "satisfactory" in a third.
- **Legends floating over the data** in pop-up boxes, and diagonal column headers in heavy-bordered grids.
