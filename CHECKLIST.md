# Beamly Project Checklist & Progress Tracker ⚡

Welcome to the Beamly open-source contribution tracker! This document provides a visual checklist of what has been implemented, what is currently in progress, and upcoming roadmap items that need open-source contributions.

Feel free to use this checklist to coordinate feature additions, report bugs, or submit PRs on GitHub!

---

## 🏗️ Core Architecture & Backend
- [x] **Flask Application Setup**: Configured factory design pattern in `app/__init__.py`.
- [x] **Signaling Server**: Implemented Flask-SocketIO event coordination in `app/socket_events.py` for exchanging descriptions (SDP) and candidates.
- [x] **Room Manager**: Created an in-memory manager (`app/services/room_manager.py`) with automatic inactivity sweeps.
- [x] **Dynamic QR Generator**: Implemented server-side vector QR code generation (`app/routes.py`) linking to the dynamic join room URL.
- [x] **Security Sanitation**: Sanitized inputs and implemented filename traversal filtering in `app/utils/helpers.py`.

---

## ⚡ WebRTC DataChannel Engine
- [x] **Peer Creation & Negotiation**: Bound RTCPeerConnection wrapper in `static/js/rtc.js`.
- [x] **ICE Candidate Queueing**: Solved WebRTC race conditions in `static/js/connection.js` by buffering candidates until remote descriptions are applied.
- [x] **Binary Slicing**: Sliced outgoing payloads into stable **64 KiB chunks** from disk on-the-fly (`static/js/sender.js`).
- [x] **Backpressure Management**: Monitored `bufferedAmount` to halt streaming when buffers fill up, resuming on `bufferedamountlow` event.
- [x] **Reconstruction Assembly**: Managed binary stream buffering and programmatic local saves in `static/js/receiver.js`.
- [x] **Device Handshakes**: Relayed platform/browser signatures over DataChannel when connections open.

---

## 🎨 Front-End & Neo-Brutalist UI
- [x] **Design Token Styling**: Set up flat colors, solid shadows, and thick outlines in `tailwind.config.js` and `app/static/css/src/main.css`.
- [x] **Drag & Drop Upload Zone**: Implemented visual drag-over outlines and picker integrations.
- [x] **Clipboard Paste Support**: Listened to global paste buffers to enable screenshots upload.
- [x] **Sequential Queueing**: Built a race-condition-safe transfer runner executing file tasks one by one.
- [x] **Transfer Metrics**: Provided active speeds, ETAs, progress bars, and cancel triggers.
- [x] **Favicon Assets**: Created matching white-B favicon packages (`favicon.png` and `favicon.ico`).

---

## 📦 Containerization & Licensing
- [x] **Docker Multi-Stage Build**: Added `Dockerfile` leveraging node-slim builders and python-slim runtimes.
- [x] **Docker Compose**: Orchestrated simple multi-environment container scripts.
- [x] **MIT License**: Included standard open-source MIT authorization guidelines.
- [x] **Contributing Guide**: Formatted `CONTRIBUTING.md` with guidelines, guidelines, and branch structure.

---

## 🗺️ Contribution Roadmap (Future TODOs)
We are looking for open-source contributors to pick up the following roadmap items (tagged `TODO` in our files):

- [ ] **End-to-End Hash Verification**
  - *Goal*: Compute a SHA-256 digest on both sides to verify file integrity post-assembly.
  - *Status*: Needs implementation in `sender.js` and `receiver.js`.
- [ ] **Folder Transfers**
  - *Goal*: Support uploading directory listings and recreating folders upon download.
  - *Status*: Needs File System Directory Access API hooks.
- [ ] **PWA Support**
  - *Goal*: Make Beamly installable as a mobile application and enable service workers.
- [ ] **Clipboard Text Synchronization**
  - *Goal*: Simple textbox panel to send and copy textual strings or URLs back and forth.
- [ ] **Resumable Transfers**
  - *Goal*: Exchange transfer index markers to resume aborted transfers without restarting from byte 0.
- [ ] **Inline Previews**
  - *Goal*: Render thumbnail previews of images or video frames directly in the UI queue.
- [ ] **LAN Discovery**
  - *Goal*: Discover active local room endpoints automatically on the network using mDNS or IP sweeps.
