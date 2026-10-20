#!/bin/sh
# Opens the context sidebar in a tmux or iTerm2 split beside the current pane.
# Run it from the pane where Claude Code is running (the /context-compass:open command does this).
DIR="$(cd "$(dirname "$0")" && pwd)"
W="${CTX_SIDEBAR_WIDTH:-42}"
if [ -n "$TMUX" ]; then
  TARGET="${TMUX_PANE:-$(tmux display-message -p '#{pane_id}')}"
  tmux split-window -h -d -l "$W" -c "$PWD" "CTX_TARGET_PANE=$TARGET node '$DIR/context-compass.mjs'"
  echo "context-compass: opened beside this pane (${W} columns)."
elif [ -n "$ITERM_SESSION_ID" ]; then
  # iTerm2 starts a split's command without a login shell, so node goes in by absolute path.
  CMD="'$(command -v node)' '$DIR/context-compass.mjs' --cwd '$PWD'"
  osascript - "${ITERM_SESSION_ID#*:}" "$CMD" "$W" <<'EOF' >/dev/null || exit 1
on run argv
  tell application "iTerm2"
    repeat with w in windows
      repeat with t in tabs of w
        repeat with s in sessions of t
          if unique id of s is item 1 of argv then
            tell s to set side to (split vertically with default profile command (item 2 of argv))
            try
              set columns of side to (item 3 of argv as integer)
            end try
            tell s to select
            return
          end if
        end repeat
      end repeat
    end repeat
  end tell
  error "this iTerm2 session was not found"
end run
EOF
  echo "context-compass: opened beside this iTerm2 pane."
else
  echo "context-compass: run Claude Code inside tmux or iTerm2, or run 'node $DIR/context-compass.mjs' in another terminal in this directory."
fi
