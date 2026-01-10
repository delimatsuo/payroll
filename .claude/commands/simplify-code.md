# Simplify Code

Review and simplify the code that was just written.

## Instructions

Review the recent changes and look for opportunities to:

1. **Remove unnecessary abstractions**
   - Delete wrapper functions that just call another function
   - Remove helper files with only one export
   - Inline simple logic that's only used once

2. **Simplify types**
   - Replace `interface` with `type` for simple shapes
   - Remove redundant type annotations where TypeScript can infer
   - Use string literal unions instead of enums

3. **Clean up code**
   - Remove commented-out code
   - Remove unused imports
   - Remove unnecessary variables (inline them)
   - Remove backwards compatibility code that's not used

4. **Improve readability**
   - Use early returns to reduce nesting
   - Use destructuring where it improves clarity
   - Keep functions focused on one task

## What NOT to simplify

- Don't remove error handling
- Don't remove type safety
- Don't combine unrelated logic
- Don't remove necessary abstractions for testing

## Output

After simplifying, run TypeScript check to ensure no errors were introduced:

```bash
npx tsc --noEmit
```
