# Contributing to OpenTrainDNN

First of all, thank you for considering a contribution. Every bug report, every suggestion, every pull request makes this tool better for the next person who opens it.

This document explains how to set up the project, what we are looking for, and what we are not.


## Table of contents

- [Code of conduct](#code-of-conduct)
- [Ways to contribute](#ways-to-contribute)
- [Setting up the project](#setting-up-the-project)
- [Project philosophy](#project-philosophy)
- [What we welcome](#what-we-welcome)
- [What we do not accept](#what-we-do-not-accept)
- [Code style](#code-style)
- [Commit message conventions](#commit-message-conventions)
- [Pull request process](#pull-request-process)
- [Reporting bugs](#reporting-bugs)
- [Suggesting features](#suggesting-features)
- [Testing](#testing)
- [Recognition](#recognition)


## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to uphold its standards. Report unacceptable behaviour by opening an issue or contacting the maintainer directly.


## Ways to contribute

You do not need to write code to help. Every one of these is valuable:

| Contribution | Effort | Impact |
|---|---|---|
| 🐛 Report a bug | Low | High |
| 📖 Improve documentation | Low | High |
| 🌍 Translate the README | Medium | Medium |
| 🎨 Fix a UI inconsistency | Low | Medium |
| ⚡ Optimise a hot loop | Medium | High |
| 🧪 Add a browser test | High | High |
| ✨ Propose a new feature | Low | Depends |
| 💬 Answer a question in an issue | Low | High |

If you are not sure where to start, look for issues labelled `good first issue`.


## Setting up the project

### Prerequisites

- A modern browser (Chrome, Firefox, Safari, or Edge)
- Python 3.6+ for the local server, or any other static file server
- A code editor (VS Code, Sublime, Vim, or anything else)

**There is no build step. There are no dependencies. There is no npm install.**

### Getting the code

```
git clone https://github.com/Matiyos/OpenTrainDNN.git
cd OpenTrainDNN
```

### Running locally

The simplest way:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

You can also just open `index.html` directly in a browser. That works because the project uses plain script tags, not ES modules.

### Making sure it works

Before you start changing code, confirm the baseline works:

1. Start the camera.
2. Capture 15 samples into class 1.
3. Capture 15 samples into class 2.
4. Train for 10 seconds.
5. Confirm the prediction flips when you alternate objects.

If any of that fails before you have changed anything, open an issue.


## Project philosophy

Read this section before proposing a change. It will save us both time.

**The tool is a teaching instrument, not a framework.** Every design decision follows from that.

**Nothing gets hidden.** The whole point is that a user can open the browser console and see every number. If your feature involves wrapping something in a class that hides state, it is probably wrong for this project.

**No dependencies.** Not a single one. Not even a utility library. The tool must work forever, on any machine, with nothing installed. That is a feature, not a limitation.

**No build step.** A user should be able to download the folder, double-click `index.html`, and have it work. Adding a bundler, a transpiler, or a package manager breaks this.

**Correctness over features.** A small tool that is exactly right beats a large tool that is approximately right.

**Simplicity over cleverness.** If a reviewer needs to think for more than 30 seconds to understand a line of code, rewrite it.


## What we welcome

### Bug fixes

Any bug that prevents the tool from working as documented. Include a reproduction in the PR.

### Performance improvements

The training loop, the visualization, and the input pipeline are all hot paths. If you can make any of them faster without making the code harder to read, we want to see it.

### Documentation improvements

Typos, unclear sentences, missing explanations, better examples, translations. All welcome.

### Small, focused UX improvements

Better contrast on a button. A clearer error message. A tooltip on a control that was ambiguous. These add up.

### Accessibility improvements

Keyboard navigation, screen reader support, colour-blind-safe palettes. The tool is currently not fully accessible. Help here is genuinely valuable.

### Educational content

A new demo shape. A better tutorial in the README. A short video showing the tool in action. Anything that helps someone learn faster.


## What we do not accept

This is the most important section. Please read it before opening a PR.

### ❌ New architectures

RNNs, LSTMs, GRUs, Transformers, attention, spiking networks. These are different projects with different stories. Adding them would dilute the tool's focus and complicate the code beyond what a learner can read in one sitting.

If you want to explore those architectures, fork the project. We will link to forks that do interesting things.

### ❌ A build step

No webpack, no Rollup, no Vite, no Parcel, no Babel, no TypeScript. The tool must work from a plain `file://` open with nothing installed.

### ❌ Dependencies

No npm packages. No CDN imports. No vendored libraries. Every function the tool needs is written in the repository.

### ❌ A backend

No server, no login, no cloud storage, no telemetry. The tool is a static folder. It will remain a static folder.

### ❌ A framework rewrite

No React, Vue, Svelte, Solid, or any other framework. The DOM manipulation is deliberate and simple. It is part of the teaching.

### ❌ Features that hide state

If a feature wraps the network or the weights in an abstraction that prevents the user from inspecting them, it is against the project's philosophy.

### ❌ Cosmetic changes without a reason

Reformatting an entire file. Renaming variables across the codebase. Reorganising imports. These are noise in the git history and make review harder. If you want to reformat, do it in a separate PR and explain why.

### ❌ Large refactors without prior discussion

Open an issue first. Explain what you want to change and why. Wait for agreement. Then write code. This saves you from wasting effort on a PR that will not be merged.


## Code style

The project uses a plain, readable JavaScript style. It is not enforced by a linter — read the existing code and match it.

### General rules

- Two-space indentation.
- Semicolons everywhere.
- Single quotes for strings.
- `const` by default, `let` when reassignment is needed, never `var`.
- `===` and `!==`, never `==` or `!=`.
- Arrow functions for callbacks, named functions for top-level code.
- No trailing whitespace.
- Files end with a newline.

### Naming

- `camelCase` for variables and functions.
- `PascalCase` for constructor-like objects (rare in this codebase).
- `SCREAMING_SNAKE_CASE` for module-level constants.
- Descriptive names. `cur`, `tmp`, and `x` are fine in tight loops. Anywhere else, be specific.

### Comments

- Section headers use the block format you see in every file.
- Explain **why**, not **what**. The code already says what.
- A comment that says `increment i` is worse than no comment.
- A comment that explains the mic ring buffer wraps at SIZE, so we read modulo, is worth its weight in gold.

### Structure

- Every file starts with `'use strict';`.
- Every file has a section banner explaining what it does.
- Public functions are defined before they are used.
- Helper functions are defined near the code that uses them.

Match the style of the existing code and your PR will look like it belongs.


## Commit message conventions

This project loosely follows Conventional Commits. It is not enforced, but following it makes the changelog easier to generate.

### Format

```
<type>(<scope>): <short description>

<optional body>

<optional footer>
```

### Types

| Type | Use for |
|---|---|
| `feat` | A new user-facing feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `style` | Formatting, whitespace, no code change |
| `refactor` | A code change that neither fixes a bug nor adds a feature |
| `perf` | A performance improvement |
| `test` | Adding or fixing tests |
| `chore` | Build process, tooling, dependencies |

### Scopes

The scope is the file or module affected: `input`, `network`, `visualize`, `classes`, `main`, `math`, `state`, `readme`.

### Examples

```
feat(network): add He initialization for ReLU layers

fix(input): correct spectrogram orientation for narrow FFT sizes

docs(readme): add a GIF of the microphone demo

perf(visualize): skip edge drawing when weight magnitude is below threshold

refactor(classes): extract thumbnail rendering into its own function
```

### One commit, one thing

If you are fixing a bug and improving a comment in the same file, commit them separately. Future readers will thank you.


## Pull request process

### Before you open a PR

1. **Search existing issues and PRs.** Someone may already be working on it.
2. **Open an issue first** for anything non-trivial. Explain what you want to change and why.
3. **Rebase on `main`.** Your PR should apply cleanly.

### Opening the PR

Use the pull request template. It asks for:

- A short description of what changed and why
- Which browsers you tested on
- A screenshot or GIF if the change is visual
- A checklist confirming the project philosophy was respected

### What happens next

- A maintainer will review within a few days.
- If the change is small and clear, it will be merged directly.
- If the change needs work, you will get specific feedback.
- If the change is out of scope, it will be closed with an explanation.

Please do not open a PR and disappear. Respond to review comments within a week, or the PR will be closed so the repository stays clean.

### What makes a PR easy to merge

| Do | Do not |
|---|---|
| Small, focused change | Change 40 files at once |
| Describe what and why | Assume the reviewer knows your intent |
| Include a reproduction for bugs | Say "it doesn't work" |
| Match the existing code style | Reformat unrelated files |
| Test on two browsers | Assume Chrome is the only browser |
| Update the README if behaviour changed | Leave documentation stale |


## Reporting bugs

Open an issue using the bug report template.

A good bug report includes:

1. **What you did.** The exact steps to reproduce.
2. **What you expected.** The correct behaviour.
3. **What happened.** The incorrect behaviour.
4. **Environment.** Browser name and version, operating system, input source.
5. **Console output.** Any error messages from the browser console.
6. **Screenshot or recording.** If the bug is visual.

**Please do not** open a bug report for a limitation that is already documented. If the README says "does not work with fine textures," a report that fine textures do not work is not a bug.


## Suggesting features

Open an issue using the feature request template.

A good feature request includes:

1. **The problem.** What are you trying to do that the tool cannot do?
2. **The idea.** What would the solution look like?
3. **Alternatives.** What else have you considered?
4. **Scope.** How much of the codebase would this touch?

**Before suggesting a feature, check What we do not accept.** If it is on that list, it will be closed without further discussion.


## Testing

The project has no automated test suite yet. This is a known gap. If you would like to add one, please open an issue first.

For manual testing, use this checklist:

### Every PR

- Page loads without console errors
- Start camera works and shows video
- Capture from camera works on all 3 keys
- Switch to microphone works
- Capture from microphone works on all 3 keys
- Train runs and loss decreases
- Prediction updates in real time
- Save produces a valid JSON file
- Load restores the weights correctly
- Reset clears the network
- Clear removes all samples

### If your change touches a specific area

- **Input pipeline:** test both camera and microphone
- **Network:** test both Dense and CNN
- **Visualization:** test at 8×8, 16×16, and 32×32
- **Classes:** test 2 classes and 4 classes
- **CSS:** test at desktop width, tablet width, and phone width

### Browser matrix

At minimum, test on two of the following:

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

If your change touches `getUserMedia` or the Web Audio API, test on all four. These APIs differ between browsers and are the most common source of bugs.


## Recognition

Every contributor will be listed in the repository's contributor graph automatically. For larger contributions, you will be credited by name in the CHANGELOG entry for the release that includes your work.

Thank you for taking the time to make this tool better.


<div align="center">

**[⬆ back to top](#contributing-to-opentraindnn)**

</div>
