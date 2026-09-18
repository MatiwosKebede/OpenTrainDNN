# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| Latest `main` branch | ✅ |
| Older releases | ❌ |

Only the current `main` branch receives security updates. Please test against `main` before reporting.

## What is in scope

OpenTrainDNN is a static folder of HTML, CSS, and JavaScript. It runs entirely in your browser. It has no backend, no database, no network communication beyond the camera and microphone permission prompts.

Because of this, the attack surface is small, but the following are genuinely in scope:

- **XSS through user input.** If you find a way to inject script through a class name, a file name, or a loaded JSON payload, that is a vulnerability.
- **Malicious JSON in the Save/Load feature.** If a crafted `.json` file can execute code or crash the tab when loaded, that is a vulnerability.
- **Cross-origin data leakage.** If camera or microphone frames can be exfiltrated to a third party through the tool, that is a vulnerability.
- **Dependency confusion.** This project has no dependencies, so this should not apply. If you find one, please report it.

## What is not in scope

- **The camera and microphone permission prompts.** These are browser features. Behaviour is defined by the browser, not by this tool.
- **The accuracy of the neural network.** This is a teaching tool, not a security product. A network that classifies incorrectly is not a security issue.
- **Denial of service through large inputs.** If you train a 64×64 CNN on a laptop, it will be slow. That is expected behaviour.
- **Self-XSS.** If you paste malicious code into your own browser console, that is not a vulnerability in this tool.
- **The camera or microphone being visible to the page.** By design, the tool reads both. That is what it is for. The user grants permission through the browser prompt.

## Reporting a vulnerability

Please do not open a public issue for security vulnerabilities.

Send a private report to the contact address listed in the repository, with the following information:

1. Description of the vulnerability
2. Steps to reproduce — exact, minimal, and complete
3. Impact — what an attacker could achieve
4. Suggested fix — if you have one
5. Your name and contact — for credit in the fix

You will receive an acknowledgement within 72 hours.

## What to expect after reporting

1. Acknowledgement within 72 hours.
2. Assessment within 7 days — is the report valid, and how severe is it?
3. Fix as soon as reasonably possible. For high-severity issues, this will be prioritised over feature work.
4. Disclosure after the fix is released. You will be credited by name unless you prefer to remain anonymous.

If the report turns out not to be a security issue — for example, if it is a bug in the neural network rather than a vulnerability — you will be told, and the issue can be moved to the public tracker.

## Safe harbour

If you make a good-faith effort to comply with this policy during your security research, we will:

- Consider your research authorised
- Work with you to understand and resolve the issue quickly
- Recognise your contribution publicly if you wish

We will not pursue legal action against you for security research conducted in accordance with this policy.

We consider research to be in good faith when:

- You do not access data that is not yours
- You do not modify or destroy data
- You do not degrade the service for others
- You report the vulnerability promptly and privately
- You do not exploit the vulnerability beyond what is necessary to prove it exists

## A note on this project's scope

This is a browser-only tool with no server component. There is no user database, no authentication, no session state, no stored files, and no remote API calls.

The only persistent state is:

1. **In-memory training samples**, which vanish when the tab is closed.
2. **Saved JSON weight files**, which the user downloads to their own computer.

Neither of these leaves the user's machine unless they explicitly share them. There is no telemetry, no analytics, no crash reporting, and no external requests of any kind.

If you are looking for a target with a large attack surface, this is not it. If you have found something that breaks the model above, we want to hear about it.

## Thank you

Security research on small open-source projects is unpaid and often thankless. If you have taken the time to look at this tool carefully, we genuinely appreciate it. Even a report that turns out to be out of scope is a contribution to the project's understanding of what it does and does not do.
