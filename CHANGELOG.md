Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.


[Unreleased]

Added

- Nothing yet.

Changed

- Nothing yet.

Fixed

- Nothing yet.


[1.0.0] — 2026-09-19

Initial public release.

Added

- Two input types. Camera (16×16 grayscale) and microphone (16×16 mel spectrogram). Both produce 256 numbers and feed the same network through the same code path.
- Two architectures. Dense (fully connected) and CNN (convolutional with two conv layers, two pooling layers, and two dense layers).
- Up to 8 classes. Each with an editable name, its own color, its own sample collection, and its own thumbnails.
- Twelve input resolutions. From 4×4 to 64×64.
- Live visualization. Every neuron as a glowing circle. Every weight as a curved wire whose thickness, brightness, and glow scale with the weight magnitude. Feature maps for the CNN, updated every frame.
- Train and validation split. Every fifth sample is held out. Validation accuracy is displayed separately from training accuracy.
- Overfitting detection. The warning banner appears the moment validation accuracy falls behind its peak.
- Exact analytical gradients. No finite differences.
- Adam optimizer. Same update rule as production frameworks.
- Gradient clipping. Prevents divergence on large networks.
- Save and Load weights. Export trained weights as JSON, reload them later. Class names survive the reload.
- Modular codebase. Nine files, split by concern: math, state, input, network, visualize, classes, main.
- No dependencies. The tool works from a local file with nothing installed.

Documentation

- README with quick start, feature list, project structure, and browser support.
- CONTRIBUTING with setup instructions, code style, and pull request process.
- CODE_OF_CONDUCT following Contributor Covenant 2.1.
- SECURITY with disclosure policy.
- MIT license.


Versioning

This project follows Semantic Versioning.

- MAJOR version for incompatible changes to the codebase structure or public interface.
- MINOR version for new user-facing features.
- PATCH version for bug fixes and documentation updates.

