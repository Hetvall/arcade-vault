---
name: spec-impl-game
description: Implementa un spec de juego aprobado (mismo flujo que /spec-impl) y, al terminar el último paso, detona en secuencia los agentes skin-designer y luego mobile-porter para dejar el juego nuevo con skins y responsive. Valida estado "Approved", crea branch spec-NN-slug y avanza paso a paso con pausas para revisar diffs.
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Task, Read, Glob, Grep, Edit, Write, AskUserQuestion, mcp__supabase__apply_migration, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*), Bash(npm run lint:*), Bash(npm run build:*)
---

# /spec-impl-game — Implementer of approved game specs

Esta skill es una **especialización de `/spec-impl`** para specs de juego (los que produce
`/add-game`, que siempre tocan los 5 seams documentados en
`.claude/skills/add-game/reference.md`: engine, canvas wrapper, wiring en `game-player.tsx`, CSS
y migración Supabase). Las Fases 1–4 son **idénticas** a `/spec-impl`. La única diferencia es una
**Fase 5** al final: cuando el último paso del plan queda implementado, detona automáticamente y
**en secuencia** (nunca en paralelo) dos agentes de acabado — `skin-designer` primero, luego
`mobile-porter` — para que el juego nuevo salga con skins y con el pase de responsive/táctil ya
aplicados.

## Session context

Current repository state:
!`git status --short`

Current branch:
!`git branch --show-current`

Specs available in this folder:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist"`

Branch-creation config:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, no config file)"`

---

## Instructions

Follow these five phases in strict order. **Do not advance to the next phase if the previous one
did not complete correctly.**

---

### Phase 1 — Identify the spec

The received argument is: `$ARGUMENTS`

If `$ARGUMENTS` is empty:

- List the files available in `specs/` (you already have them above).
- Ask the user to specify the exact name of the spec.
- Stop and wait for an answer. Do not continue.

If `$ARGUMENTS` has a value:

- Look for the file in `specs/`. The user may have written the full name (`01-mvp-arkanoid`), only
  the number (`01`), or only the slug (`mvp-arkanoid`). Try to find the correct file in any of
  those cases.
- If you do not find the file, show the available specs and ask the user to correct the name.
- If you do find it, continue to Phase 2.

---

### Phase 2 — Validate the spec's state

Read the spec file you located in Phase 1 using the Read tool or `cat`.

In the file's contents, look for the line that contains the spec's state. The header label is
typically `**Status:**` (English) or `**Estado:**` (Spanish), but it may use any language. Match
by position (status line near the top of the spec) and by the surrounding state machine, not by
the exact label.

**Absolute rule:** You can only continue if the state **means "Approved"** — regardless of the
language used.

Treat any of the following (and their equivalents in other languages) as the **Approved** state
and continue:

- English: `Approved`
- Spanish: `Aprobado`
- Portuguese: `Aprovado`
- French: `Approuvé`
- German: `Genehmigt`
- Italian: `Approvato`
- …or any other language's word that clearly means "approved"

Anything else (Draft / Borrador, In review / En revisión, Implemented / Implementado, Obsolete /
Obsoleto, or any unrecognized value) means **stop** and show the error message below.

| State category                            | Examples (any language)                           | Action                                                                     |
| ----------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| Approved                                  | `Approved`, `Aprobado`, `Aprovado`, `Approuvé`, … | Continue to Phase 3.                                                       |
| Draft                                     | `Draft`, `Borrador`, …                            | Stop. Show the error message below.                                        |
| In review                                 | `In review`, `En revisión`, …                     | Stop. Show the error message below.                                        |
| Implemented                               | `Implemented`, `Implementado`, …                  | Stop. Show the error message below.                                        |
| Obsolete                                  | `Obsolete`, `Obsoleto`, …                         | Stop. Show the error message below.                                        |
| State line not found / unrecognized value | —                                                 | Stop. The file does not follow the expected format. Tell this to the user. |

If you are unsure whether a value means "approved", **do not assume**. Stop and ask the user to
clarify or to update the spec to the canonical wording.

**Standard error message when the state does not mean Approved:**

```
❌ I cannot implement this spec.

Current state: [STATE FOUND]
I only work with specs whose state means "Approved" (e.g. `Approved`, `Aprobado`,
or the equivalent in another language).

To continue you have two options:
  1. If the spec is ready to be implemented, open it and change the state
     to "Approved" (or the equivalent term your team uses) manually.
     That change is made by the human, not the agent.
  2. If the spec still needs work, use /spec [name] or /add-game to resume it.
```

Do not offer alternatives, do not suggest "I can still start if you want". The block is
intentional. **No agent is launched** on this path — Phase 5 never runs if Phase 2 stops here.

---

### Phase 3 — Create the git branch and switch to it

Once you have confirmed the state means `Approved`:

0. **Check the working tree first.** Look at the `git status --short` output in the session
   context above. If it is **not empty**, stop and show the pending changes, then ask:

   ```
   ⚠️ There are uncommitted changes in the working tree.
   Switching branches would carry them over. What do you want to do?
     1. Commit or stash them yourself, then re-run this command  (recommended)
     2. Continue anyway — the changes travel to the new branch
   ```

   Wait for the answer. **Do not stash or commit on the user's behalf** unless they explicitly ask
   for it. If the working tree is clean, skip straight to step 1 without mentioning it.

1. Derive the branch name from the spec file's full name, without the extension. Format:
   `spec-NN-slug`. Examples:

   - `01-mvp-arkanoid.md` → branch `spec-01-mvp-arkanoid`
   - `11-juego-serpentina.md` → branch `spec-11-juego-serpentina`

2. Read the `AutoCreateBranch` flag from the **Branch-creation config** shown in the session
   context above.

   - If the config file does not exist, the value is missing, or the value is unrecognized → treat
     it as `true` (the default).
   - Only an explicit `false` (in any capitalization) disables automatic branch creation.

   **If `AutoCreateBranch` is `true` (default):** proceed without asking.

   - If the branch **does not exist**: create it with `git checkout -b spec-NN-slug`.
   - If it **already exists**: this means previous work is being resumed. Switch to it, read
     `git log --oneline` on the branch, and tell the user which steps of the plan already look
     done and which step you propose to resume from. Wait for confirmation on the resume point
     before implementing anything.
   - In both cases: switch to the branch with `git checkout spec-NN-slug` and confirm the change
     was successful before continuing.

   **If `AutoCreateBranch` is `false`:** ask before touching git. Show:

   ```
   AutoCreateBranch is set to false.
   Create and switch to the branch spec-NN-slug? [y/N]
   ```

   - If the user answers **yes**: create/switch to the branch exactly as in the `true` case above.
   - If the user answers **no** or leaves it empty: **do not create any branch.** Tell the user you
     will implement on the current branch (the one shown in the session context above) and ask for
     explicit confirmation to continue there. Do not improvise — wait for the answer.

3. Visually confirm to the user the spec is ready and which branch is active:

   ```
   ✅ Ready to implement.

   Spec:   specs/NN-slug.md
   Branch: spec-NN-slug  (active)   (← or the current branch, if no new branch was created)
   State:  Approved   (← echo back the actual value found in the spec)
   ```

4. **Do not start implementing yet.** First show the spec summary to the user so they have it
   fresh. Extract and show:
   - The **objective** (the line after `**Objective:**` / `**Objetivo:**` / equivalent label).
   - The **scope** (the `## Scope` / `## Alcance` / equivalent section) — confirm it covers the 5
     game seams (engine, canvas wrapper, `game-player.tsx` wiring, CSS, Supabase migration).
   - The **implementation plan** (the section with the numbered steps — `## Implementation plan` /
     `## Plan de implementación` / equivalent).
   - The **acceptance criteria** (the checklist — `## Acceptance criteria` /
     `## Criterios de aceptación` / equivalent).

Match section headings by meaning, not by exact wording — the spec may be authored in any
language.

---

### Phase 4 — Implement step by step

After showing the spec summary, tell the user:

```
I am going to implement the spec following the implementation plan exactly.
I will pause after each step so you can review the diff.

Shall we start with Step 1?
```

Wait for explicit confirmation ("yes", "go ahead", "go", or equivalent). Do not start without it.

Once confirmed, follow these rules during the entire implementation:

**Never commit automatically.** Not per step, not at the end. You write the code and show the
diff; committing is the user's decision and the user's command. Only commit if they explicitly ask
you to.

**One rule above all:** implement what the spec says. If something in the spec looks suboptimal to
you, mention it as an observation but implement what was agreed. Changes to the spec go into the
spec, not into the code by surprise.

**Work rhythm:**

- Implement one step of the plan.
- Show a summary of which files you touched and what you did.
- Say: `Step N completed. Could you review the diff and let me know if I continue with Step N+1?`
- Wait for confirmation before continuing.

**If during the implementation you find an ambiguity** the spec does not resolve:

- Stop.
- Describe the ambiguity exactly.
- Present two or three concrete options.
- Wait for the user's decision.
- Do not improvise.

**If the user asks for something that is out of the spec's scope:**

- Remind them that it is out of this spec's scope.
- Suggest noting it down for the next spec.
- Do not implement it on this branch.

**When finishing the last step of the plan** (all steps implemented, `npm run lint` clean):

Do **not** close with the acceptance-criteria reminder yet — that now happens at the end of Phase 5. Instead say:

```
✅ All implementation-plan steps are done.

Now I'll hand off to the finishing agents, in sequence:
  1. skin-designer  (skins for this game)
  2. mobile-porter   (mobile/touch pass for this game and any pages it touches)

I won't ask for confirmation between them — starting with skin-designer.
```

Then continue straight into Phase 5. Do not wait for confirmation to start Phase 5 — the user
already confirmed the implementation run in the message that started Phase 4.

---

### Phase 5 — Handoff: skin-designer → mobile-porter (sequential, never parallel)

This phase only runs if Phase 4 reached its last step successfully. It never runs if Phase 2 or
Phase 3 stopped the flow.

1. Launch the `skin-designer` agent (via the `Task` tool, `subagent_type: skin-designer`),
   passing it as context: the game's `id`, the spec file path, and a one-line note that this is a
   freshly-implemented game needing its 3 skins (neon/retro/clásico) with independent
   per-game persistence. **Run it synchronously and wait for it to finish** — do not launch
   `mobile-porter` until `skin-designer` has returned its result.
2. Show the user a short summary of what `skin-designer` did (files touched, `lint`/`build`
   result) as reported by the agent.
3. Only then, launch the `mobile-porter` agent (`subagent_type: mobile-porter`), with the same
   game context, so it audits/fixes the mobile/touch layout for this game's player page (and any
   site pages it newly touches). **Wait for it to finish** before continuing.
4. Show the user a short summary of what `mobile-porter` did (coverage table entries touched,
   files, `lint`/`build` result) as reported by the agent.
5. If either agent reports it left something out of scope, or its own verification (lint/build)
   failed, surface that explicitly in the summary — do not silently continue, but do not abort the
   second agent just because the first one reported a warning; only stop the sequence if the first
   agent's changes are broken (e.g. build fails) in a way that would make it unsafe for
   `mobile-porter` to build on top of.
6. After both agents have finished (or the sequence was explicitly stopped per step 5), close with
   the original `/spec-impl` reminder:

   ```
   ✅ Implementation + finishing agents (skin-designer, mobile-porter) are done.

   Next step: verify the spec's acceptance criteria one by one.
   If they all pass, update the spec's state to "Implemented" (or the equivalent
   in your repo's language) and make the final commit before merging this branch.
   ```

**Hard rules for this phase:**

- **Sequential, never parallel.** `mobile-porter` must not start until `skin-designer` has
  returned.
- **No automatic commits**, from you or from either agent — the final commit is the user's call.
- Both agents already implement directly and self-verify with `lint`/`build`; you don't re-run
  those yourself, you relay what they reported.

---

## Summary of expected behavior

```
/spec-impl-game 11-juego-serpentina

  Phase 1  →  Finds specs/11-juego-serpentina.md
  Phase 2  →  Reads the state → "Approved" (or "Aprobado", etc.) → ✅ continues
  Phase 3  →  git checkout -b spec-11-juego-serpentina
              Shows objective, scope (5 seams), plan and criteria
  Phase 4  →  Implements step by step with pauses
              Last step done → announces the agent handoff, no extra confirmation needed
  Phase 5  →  Launches skin-designer, waits, shows its summary
              Launches mobile-porter, waits, shows its summary
              Closes reminding to verify acceptance criteria and set state to "Implemented"

/spec-impl-game 02-powerups  (state: Draft / Borrador)

  Phase 1  →  Finds specs/02-powerups.md
  Phase 2  →  Reads the state → "Draft" → ❌ stops
              Shows the standard error message
              Does not create branch, does not touch code, no agent is launched
```

**Branch creation is controlled by the `AutoCreateBranch` flag** in `specs/.spec-config.yml`. It
defaults to `true` (create the branch automatically, as shown above). Set it to `false` to make
Phase 3 ask `[y/N]` before creating the branch.

**Agent names are fixed**: `skin-designer` and `mobile-porter`, in that order, matching
`.claude/agents/skin-designer.md` and `.claude/agents/mobile-porter.md`. If the `Task` tool is not
recognized by the harness when this command runs, use the `Agent` tool instead — same
`subagent_type` values, same sequential (not parallel) invocation.
