# td workflow — MANDATORY for every task

## 1. Session start
```
td usage --new-session
```
Run this FIRST, before any other work. Review open/in-review issues.

## 2. Before starting any non-trivial work
Create an issue, then start it:
```
td create "<title>" --type feature|bug|task|chore --priority P1|P2|P3 --description "..."
td start <id>
```
Use `td log "<msg>"` to record progress milestones during implementation.

## 3. Before context ends — ALWAYS run:
```
td handoff <id> --done "..." --remaining "..." --decision "..." --uncertain "..."
```
Then submit for review when complete:
```
td review <id>
```

## Full per-task flow
```
td create → td start → [td log] → td handoff → td review
```

## Do NOT use the internal TaskCreate/TaskUpdate tools
Use `td` CLI exclusively for issue tracking in this project.
