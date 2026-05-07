# scripts/

## `pre-commit-hook.sh`

Tracked copy of the pre-commit hook installed at `.git/hooks/pre-commit`.

Git hooks live in `.git/hooks/` which is NOT version-controlled. This file
is the canonical source — if `.git/hooks/pre-commit` gets lost (fresh clone,
new machine, accidental delete), reinstall with:

```bash
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

The hook enforces the Higher-order Prompt-Design Principle (V4S29 V8
methodology amendment, validated by F2/F8a/F17/F18 templating quadruplet).
See the comment header inside `pre-commit-hook.sh` for full details.

## `generate-prompt-baseline.sh`

One-shot regenerator for `.prompt-gate-baseline.txt`. Run from repo root
when the baseline needs to be rebuilt from scratch (e.g., after a major
prompt restructure that invalidates many existing signatures).

```bash
./scripts/generate-prompt-baseline.sh
```

Normal lifecycle: baseline entries are removed manually as part of bundle
cure commits (e.g., Bundle 6 removes the F17 RIGHT summary opening entry
when the cure ships). The generator is for full rebuilds only.
