# Commit, Push, and Create PR

Create a commit with the current changes, push to remote, and create a pull request.

## Context

```bash
git status
git diff --cached --stat
git log --oneline -5
git branch --show-current
```

## Instructions

1. Review the staged changes shown above
2. Create a descriptive commit message in Portuguese that:
   - Summarizes what was changed
   - Uses imperative mood (e.g., "Adiciona", "Corrige", "Atualiza")
   - Is concise but informative
3. Commit the changes
4. Push to the current branch
5. If the branch is not `main`, create a PR using `gh pr create`

## PR Format

Use this format for the PR:
- Title: Short description of the change
- Body:
  - Summary with bullet points
  - Test plan with steps to verify

Remember to check if there's already an open PR for this branch before creating a new one.
