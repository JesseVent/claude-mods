# information-dashboard-design

A skill, not a hook: Claude loads it whenever you design, build, mock up, critique or redesign a dashboard, KPI or scorecard screen, status page, or any single screen of key metrics. That includes asks that never say "dashboard", like "make this metrics page clearer" or "which chart should this use". It works in any medium: HTML/React, Tableau, Power BI, Looker, Databricks, Streamlit, Grafana or a spreadsheet.

It distils Stephen Few's *Information Dashboard Design* into rules an agent can follow without the book. It was checked point by point against the text and against all 117 of the book's figures. A second source, a Lean UX and dashboard-design deck, adds per-chart best practices and a design-and-test loop. Where the deck is looser than Few, Few's rule wins on a dashboard.

```
"Build an ops dashboard for these five services"
  → one screen, no scrolling; each measure set against a target or history
  → bullet graphs and sparklines in place of gauges, pies and traffic lights
  → the most important data top-left, the title kept quiet
  → muted colors, with bright color saved for what needs attention
  → a closing check against the thirteen common mistakes
```

## Install

```
/plugin install information-dashboard-design --marketplace JesseVent/claude-mods
```

## What it covers

| File | Contents |
| --- | --- |
| `SKILL.md` | What a dashboard is, choosing measures and their context, a display-media chooser, layout, highlighting and color, Few's own palette and visual conventions, the thirteen mistakes, the Lean UX loop, and a final checklist. |
| `references/display-media.md` | How to draw each display medium: bullet graphs (with measured proportions), sparklines, bar, line and stacked graphs, box plots, scatter plots, alert icons, tables, small multiples. |
| `references/chart-practices.md` | The deck's chart chooser, the do's and don'ts for each chart type, data-design tips and color ramps, each conflict with Few marked. |
| `references/worked-examples.md` | Few's four model dashboards and the failures shown in the book's figures. |

## Limits

- It is a guide to design, not a chart library. Claude still writes the chart code in whatever tool you use.
- The hex values come from sampling the printed figures, so treat them as approximations.
- It covers how to show measures, not which KPIs to track.

## Uninstall

```
/plugin uninstall information-dashboard-design@claude-mods
```
