---
name: clean-commits
description: Reorganize messy git commit history on a feature branch into clean, logical, reviewer-friendly commits. Use this skill when the user types /clean-commits, or asks to "clean up commits", "reorganize commits", "rewrite history", "squash commits for review", "make commits easier to review", or anything about restructuring git history on their current branch. Also trigger when the user mentions their PR has too many commits, messy history, or WIP commits they want to clean up before review.
---

# Clean Commits

Rewrites the commit history on the current feature branch into clean, logical commits optimized for code review. This is a history rewrite only — the final tree state is identical to the original.

## Workflow

### Phase 1: Analyze

1. **Detect the base.** Find where this branch diverges from its upstream:
   ```bash
   # Check if the branch tracks a remote with a PR target
   gh pr view --json baseRefName 2>/dev/null
   # Fall back to merge-base with main/master
   git merge-base HEAD main 2>/dev/null || git merge-base HEAD master
   ```
   Only care about commits between the base and HEAD. Ignore commits that are already on the base branch.

2. **Read the history.** For each commit on this branch:
   ```bash
   git log <base>..HEAD --reverse --format="%h %s" --stat
   ```
   Understand what each commit does, which files it touches, and how changes relate to each other.

3. **Identify the commit message convention.** Look at existing commit messages for prefixes like `[DX-793]`, `feat:`, `fix:`, ticket numbers, etc. The rewritten commits must follow the same convention.

### Phase 2: Plan

Group changes into logical commits. The goal is to make each commit independently reviewable with a clear purpose. Common groupings (adapt to what's actually in the branch):

| Priority | Category | Why separate |
|----------|----------|-------------|
| 1 | Infrastructure / utilities | Small, foundational — reviewer needs to understand these first |
| 2 | Base class / framework changes | The API that other code depends on |
| 3 | Mechanical migrations | Same pattern across many files — reviewer can skim. Note file count in the plan |
| 4 | Behavioral / logic changes | The interesting stuff — small diffs that deserve careful review |
| 5 | Test infrastructure + test updates | Tests grouped together, after the code they test |
| 6 | E2e / integration test fixes | Different environment, different review |
| 7 | Documentation | Docs last so reviewer sees the spec after the code |

**Key principles for grouping:**
- Separate mechanical changes (same pattern in 50+ files) from behavioral changes (logic that matters). This is the highest-value split — reviewers can skim the mechanical commit and focus on the behavioral one.
- If a file appears in multiple logical groups (e.g., got a mechanical migration AND a behavioral fix), use intermediate states from the original commits so each new commit shows only its logical change.
- Keep test changes separate from source changes where practical.
- Keep docs separate.
- Aim for 5-10 commits. Fewer than 5 usually means a commit is doing too much. More than 10 usually means over-splitting.

**Present the plan to the user as a table:**
```
| # | Commit message | Files | Purpose |
|---|---------------|-------|---------|
| 1 | [PREFIX] Add X utility | 1 | Core utility function |
| 2 | [PREFIX] Add Y to base command | 3 | Framework methods |
| 3 | [PREFIX] Migrate commands to use X | ~80 | Mechanical — same pattern everywhere |
| ...
```

**Wait for user approval before proceeding.** They may want to adjust groupings or messages.

### Phase 3: Execute

1. **Create a backup branch:**
   ```bash
   BRANCH=$(git branch --show-current)
   ORIGINAL_HEAD=$(git rev-parse HEAD)
   git branch "${BRANCH}-backup" "$ORIGINAL_HEAD"
   ```

2. **Create a temporary rewrite branch from the base:**
   ```bash
   BASE_COMMIT=<detected base>
   git checkout -b "${BRANCH}-rewrite" "$BASE_COMMIT"
   ```

3. **Build each commit.** For each planned commit, checkout the right files and commit:

   For files that only appear in one logical commit, checkout from the final HEAD:
   ```bash
   git checkout "$ORIGINAL_HEAD" -- path/to/file.ts
   ```

   For files that appear in multiple logical commits (e.g., mechanical migration in commit 3, behavioral fix in commit 5), use intermediate states from the original history. Find the right source commit:
   - The "mechanical only" state: checkout from the original commit that did the migration
   - The "with behavioral fix" state: checkout from the final HEAD

   **Use a shell script file for complex checkouts** to avoid quoting issues with inline bash. Write the file list to a script, then execute it:
   ```bash
   # Write checkout script to /tmp to avoid shell quoting issues
   cat > /tmp/checkout-files.sh << 'SCRIPT'
   #!/bin/bash
   set -e
   # Files needing intermediate state
   INTERMEDIATE_FILES=(path/to/file1.ts path/to/file2.ts)
   for f in "${INTERMEDIATE_FILES[@]}"; do
     git checkout <intermediate-commit> -- "$f"
   done
   # Files needing final state
   git diff --name-only <base> <final> -- src/some/path/ | \
     grep -v 'special-file' | \
     while IFS= read -r f; do git checkout <final> -- "$f"; done
   SCRIPT
   bash /tmp/checkout-files.sh
   ```

   Stage and commit (NO Co-Authored-By):
   ```bash
   git add -A
   git commit -m "[PREFIX] Commit message here"
   ```

4. **Swap the branch pointer:**
   ```bash
   git branch -f "$BRANCH" "${BRANCH}-rewrite"
   git checkout "$BRANCH"
   git branch -d "${BRANCH}-rewrite"
   ```

### Phase 4: Verify

1. **Diff check — this is non-negotiable.** The final tree MUST match the original:
   ```bash
   git diff "$BRANCH" "${BRANCH}-backup" -- <relevant paths>
   ```
   If this produces ANY output, something went wrong. Do not proceed — investigate and fix.

2. **Build and test:**
   ```bash
   pnpm prepare          # or the project's build command
   pnpm exec eslint .    # or the project's lint command
   pnpm test:unit        # or the project's test command
   ```

3. **Show the final history to the user:**
   ```bash
   git log <base>..HEAD --oneline --stat
   ```

### Phase 5: Push

Ask the user if they want to force push. Only after explicit approval:
```bash
git push --force-with-lease origin "$BRANCH"
```

Remind the user the backup branch is available locally:
```
git branch -d ${BRANCH}-backup  # when you're happy with the result
```

## Rules

- **NEVER** include `Co-Authored-By: Claude` or any co-author trailer in commit messages
- **NEVER** change the code — this is a history rewrite only. The final tree state must be identical to the original
- **ALWAYS** create a backup branch before any destructive operation
- **ALWAYS** get user approval on the commit plan before executing
- **ALWAYS** verify with `git diff` that the final state matches the original before declaring success
- Follow the existing commit message convention on the branch
- Use `--force-with-lease` (not `--force`) when pushing to catch unexpected remote changes
- When a commit touches 50+ files with the same pattern, call it out as "mechanical" in the plan so reviewers know they can skim it
