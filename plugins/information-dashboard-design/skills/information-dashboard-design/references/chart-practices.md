# Chart practices, tips and color (from the "Lean UX and Dashboard Design" deck)

This file captures the chart-selection guidance, per-chart best practices, tips and color material from the *Lean UX and Dashboard Design* deck (2015, slides 3–11). The deck draws on Stephen Few, Andrew Abela's chart chooser, Oracle's dashboard guidelines and common infographic best-practice sheets.

**Precedence:** Few's rules (SKILL.md and `display-media.md`) are the baseline. Where the deck's advice is looser than Few's, the stricter Few rule wins **on a dashboard**, and the deck's tip becomes "if you must use this chart, do it this way". Every such conflict is marked **⚠ Few**.

Contents:
1. Choosing a chart: know your data, find the story, Abela's four questions
2. Per-chart best practices: bar, line, area, pie/donut, scatter
3. Ten data-design do's and don'ts
4. Common data visualization issues
5. Color: palettes, ramps and associations
6. Design principles

---

## 1. Choosing a chart

**Find the story first.** Before picking a chart, work out what you're trying to say and which relationship carries it. Look for:
- **trends**, e.g. ice-cream sales over time
- **correlations**, e.g. sales vs. temperature
- **outliers**, e.g. sales in an unusual region

The right chart is the one that delivers that message best.

**Know your data types:**
- **Quantitative:** counted or measured; numeric.
- **Discrete:** a finite set of possible values, e.g. number of employees.
- **Continuous:** measured, any value within a range, e.g. rainfall in a year.
- **Categorical:** sorted into groups, e.g. product types.

Discrete vs. continuous matters for line and area charts. A connecting line implies values in between, which only exist for continuous data.

**Know the relationship you're showing**, then use the chart Few would choose:

| Relationship | Example | Dashboard chart |
|---|---|---|
| Nominal comparison | Visitors to different websites | Bar graph, sorted by value |
| Time series | Monthly sales | Line graph (bars if individual periods matter); sparkline for context |
| Ranking | Months ranked hottest to coldest | Sorted horizontal bar graph or ranked table |
| Part-to-whole | % of customers buying each product | Bar graph labeled % of total |
| Deviation | Ticket sales on rainy vs. normal days; distance from the mean or target | Line or bar of % variance around a 0 reference line |
| Distribution | Heights of a basketball team | Histogram (bars for few points, line for many); simplified box plot to compare groups |
| Correlation | Salary vs. education | Scatter plot with a straight trend line |

**Abela's "What would you like to show?" chooser,** with dashboard substitutions applied:
- **Comparison among items**
  - one variable per item, few categories: bar chart for many items, column chart for few
  - one variable per item, many categories: a table, or a table with embedded charts (sparklines, bullet graphs)
  - two variables per item: *variable-width column*. **⚠ Few:** bars that encode values in both width and height can't be read accurately, so use two aligned bar graphs or a scatter plot.
- **Comparison over time**
  - many periods, non-cyclical: line chart
  - many periods, cyclical: *circular area (radar)*. **⚠ Few:** use a line, or small multiples by cycle. Radar is tolerable only when the cycle is naturally circular, like hours of the day.
  - few periods: column chart for one or a few categories, line chart for many
- **Relationship**
  - two variables: scatter plot
  - three variables: *bubble chart*. **⚠ Few:** area is misread and it takes too long to interpret on a dashboard. Keep two variables, and show the third separately or in an analysis view.
- **Distribution**
  - one variable: column histogram for few data points, line histogram for many
  - two variables: scatter plot
  - three variables: *3‑D area*. **⚠ Few:** never use 3‑D.
- **Composition, static**
  - simple share of total: *pie*. **⚠ Few:** use a sorted bar labeled % of total.
  - accumulation to, or subtraction from, a total: **waterfall chart**. Its bars encode length, so it's consistent with Few. Start at zero and label the steps.
  - components of components: 100% stacked column with sub-components
- **Composition over time, few periods**
  - only relative differences matter: 100% stacked column
  - relative and absolute both matter: stacked column (Few: only when the emphasis is on the whole)
- **Composition over time, many periods**
  - *stacked area* or *100% stacked area*. **⚠ Few:** prefer a line per part, or a line of each part's share, plus a total line. Area charts hide series behind each other.

## 2. Per-chart best practices

### Bar charts
Versatile: change over time, comparing categories, parts of a whole.
- **Vertical (column)** suits chronological data (time runs left to right) and negative values below the axis. **Horizontal** suits long category labels.
- **Stacked** compares several part-to-whole relationships, for discrete or continuous data, in either orientation. Few's caveat: only the bottom segment can be compared accurately, so use stacking when the whole matters most.
- **100% stacked** fits when each category's total is unimportant and the percentage split is the message.
- **Horizontal labels.** Avoid steep diagonal or vertical text; if labels don't fit, switch to horizontal bars.
- **Space bars at about half a bar's width.**
- **Start the value axis at zero.** A raised baseline truncates the bars and misstates values.
- **Use one consistent color** for the bars, plus at most an accent color to highlight a significant data point. Rainbow bars imply meaning that isn't there.
- **Order deliberately:** by value (Few's default for nominal categories), sequentially (time, ordinal scales), or alphabetically only when lookup by name matters more than comparison.

### Line charts
Time series of continuous data, showing trend, acceleration, deceleration and volatility.
- **Zero baseline if possible.** Include zero unless small fluctuations are meaningful (stock prices, availability between 95% and 100%); then narrow the scale to show them. **⚠ Few:** a line graph never *requires* zero, but don't exaggerate trivial changes either.
- **Use the right height:** scale so the data spans about two-thirds of the y-axis.
- **No more than four lines.** Beyond that, split into separate charts (small multiples) for better comparison.
- **Solid lines only.** Dashed and dotted lines distract. Distinguish lines by intensity or hue instead. (A dashed *reference* line, such as a target, is a separate case; keep it light.)
- **Label lines directly** at their ends instead of using a legend.

### Area charts
They show time-series relationships, but also volume. **⚠ Few:** area graphs are excluded from his dashboard library because series hide behind each other. Prefer lines. If an area chart is required:
- **Variants:** area for progression of a quantity over time; stacked area for part-to-whole, showing how each category builds the cumulative total; 100% stacked area for the distribution of categories when the total doesn't matter.
- **In stacked areas, put the most variable categories on top** and the low-variability ones at the bottom, so the stable bands stay readable.
- **Start the y-axis at zero.**
- **No more than four categories.**
- **Use transparency and thoughtful ordering** in overlapping (unstacked) areas so no series is hidden.
- **Never use area charts for discrete data.** The connected outline implies intermediate values.

### Pie and donut charts
Part-to-whole comparisons, most effective with very few values. A donut leaves room for a total in the middle. The deck itself gives Few's case against them: people judge slice sizes reliably only at familiar angles and positions (25%, 50%, 75%, 100%), so comparing slices is hard. **⚠ Few: on a dashboard, use a bar graph labeled % of total.** If a pie is unavoidable (it's mandated or the audience insists):
- **No more than five slices.** Group small values into "Other", but don't bury interesting or significant items there.
- **Never use several pies side by side to compare.** Use a stacked or grouped bar chart instead.
- **The slices must total 100%** and be sized in proportion to their values. Never use a pie for values that aren't parts of one whole.
- **Order the slices.** Either start the largest at 12 o'clock and go clockwise in descending order, or put the largest at 12 o'clock going clockwise and the second-largest at 12 o'clock going counter-clockwise, with the rest continuing below.
- Label the slices directly with muted colors; no legend, no 3‑D, no exploded slices.

### Scatter plots
The relationship between two variables; correlation across lots of data.
- **Use trend lines.** A straight line of best fit makes direction and strength obvious.
- **No more than two trend lines** in one plot; more becomes unreadable.
- **Axis start:** the deck says start the y-axis at zero. **⚠ Few:** points encode values by position, not length, so zero is optional. Include it when it doesn't squash the cloud; otherwise narrow the range so the pattern is visible.
- **Extra variables:** the deck suggests encoding them with dot size and color. **⚠ Few:** not on a dashboard; it takes too long to read. Use color for at most two or three groups and skip size encoding (that's a bubble chart). Keep the richer version for analytical tools.

## 3. Ten data-design do's and don'ts

1. **Do** use one color to represent each category, and keep it the same everywhere.
2. **Do** order data sets using a logical hierarchy.
3. **Do** use callouts to highlight important or interesting information. A short annotation or added mark beats making viewers hunt.
4. **Do** visualize data so values are easy to compare: adjacent, on common scales, sorted.
5. **Do** use icons to aid comprehension and cut unnecessary labeling. Keep them few, simple and consistent (Few's alert, up/down and on/off icons).
6. **Don't** use high-contrast color pairs such as red/green or blue/yellow. They vibrate, and red/green fails for color-blind viewers.
7. **Don't** use 3‑D charts; they skew perception.
8. **Don't** add chart junk: illustrations, drop shadows, ornament.
9. **Don't** use more than **six colors** in a single layout (Few: about five distinct values per attribute).
10. **Don't** use distracting fonts or text effects (bold, italic, underline). Reconciled with Few: never italic or underline for emphasis, and use bold only as a deliberate, sparing flag on items that need attention.

## 4. Common data visualization issues
(The deck's checklist, after Gerald Everett Jones's *How to Lie with Charts*.) Watch for:
- display choices that distort reality, such as pie charts and 3‑D charts
- variety for the sake of variety
- too much information
- poorly designed displays: noisy fill patterns, fussy line styles, saturated or bright colors
- quantitative data encoded inaccurately
- **inconsistent ordering and placement:** the same categories in a different order, or the same panel in a different place, across charts or pages
- **inconsistent or reversed scales:** charts meant to be compared must share scales, and an axis must never run backwards
- **proportional axis scaling** that misleads: stretched or compressed axes, or truncated bar baselines, exaggerating or hiding change
- **counts instead of percentages** when comparing periods or groups with different totals; normalize first

Guiding motto: **"Remove to improve"**, i.e. maximize the data-ink ratio.

## 5. Color

- **Purpose:** use color subtly, to show group relationships at the highest level (one hue per functional area or category). Use monochrome variations (tints and shades of one hue) for interactive state, such as the selected item or where the viewer currently is. This matches Few: muted base colors, with saturated color only where attention is needed.
- **Vocabulary:** *hue* is the pure color; a *tint* is hue plus white; a *tone* is hue plus gray; a *shade* is hue plus black.
- **Monochrome ramps from the deck**, each running tint → primary → shade. These are good for qualitative bands, selection states and sequential encodings, and readable when color-blind because they vary in intensity:

  | Family | Tint | Tint | Primary | Shade | Shade |
  |---|---|---|---|---|---|
  | Blue | `#E9F4FE` | `#B3D6F7` | `#86BAEC` | `#609FDC` | `#3E82C4` |
  | Purple-gray | `#EBEAED` | `#C4BECC` | `#9C91AA` | `#7D6D92` | `#614C7B` |
  | Green | `#EDF5E3` | `#D7EBC2` | `#B5D494` | `#8CB262` | `#69933C` |
  | Orange | `#FFE0C8` | `#FFCAA2` | `#E3A06D` | `#BC7640` | `#99541F` |

  These are muted, natural colors in the spirit of Few's standard palette. Pair them with neutral grays for most data, and keep one saturated hue (typically red) for alerts.
- **Color associations** (Western conventions, and cultural: red means good fortune in China). Use them to avoid clashing with the message, not as decoration:
  - **Red:** intense, energetic, urgent; prompts quick decisions. Reserve it for alerts.
  - **Orange:** cheerful, stimulating, adventurous.
  - **Yellow:** warm and pleasant, but low contrast on light backgrounds.
  - **Green:** natural, restful, well-being; read as "good".
  - **Blue:** calm, deep, expert, stable; the usual safe neutral accent.
  - **Purple:** regal, creative, soothing.
  - **Black:** powerful, sophisticated. For text and key data, not large fills.
  - **White:** clean and simple. Few prefers a barely tinted off-white background to stark white.

## 6. Design principles (the "6 Principles of Design" infographic)
These general visual-design principles complement Few's Gestalt and emphasis rules:
- **Unity/harmony:** proximity, similarity, continuation, repetition and rhythm make a screen feel like one system. On a dashboard: repeat the same chart forms, spacing and styles.
- **Balance:** symmetrical, asymmetrical (unequal elements in visual equilibrium) or radial. Dashboards usually want a calm asymmetric balance driven by importance, not mirror symmetry.
- **Hierarchy:** trees, nesting, and weight (elements of equal weight read as the same level). Section titles in one weight, data labels in another.
- **Scale/proportion:** size, ratio and divisions create focal points. Size panels by importance (Few's "spend space according to importance").
- **Dominance/emphasis:** highlight, color and size make one thing stand out. This is Few's "highlight the most important data", and only works if little else competes.
- **Similarity and contrast:** light vs. dark gives figure/ground separation, and varied textures or lines create contrast. Keep data dark or saturated against light, low-contrast surroundings.
