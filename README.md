# Beamly ⚡

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python Version](https://img.shields.io/badge/Python-3.9+-blue.svg)](requirements.txt)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-pink.svg)](tailwind.config.js)

**Beamly** is a modern, production-quality, open-source peer-to-peer (P2P) file transfer application. Built with **Flask, Jinja2, TailwindCSS (Neo-Brutalism)**, and native browser **WebRTC DataChannels**, it enables secure, fast, and serverless transfers directly between two devices.

The Flask backend acts **strictly as a signaling coordinator**—file data never touches the server.

---

## ⚡ Tagline
> **"Peer-to-peer file transfer. No cloud. No account."**

---

## 🎨 Design Theme: Neo-Brutalisim
Beamly adopts a striking **Neo-Brutalist** design language:
- 🖋️ **Huge, bold typography**
- 🔳 **Thick 3px borders**
- 🎨 **Flat saturated colors** (Yellow, Pink, Blue, Green)
- 🚫 **No gradients or soft shadows**
- 🧱 **Hard offset shadows** and animated lifts on hover

---

## 📋 Features

### Core MVP
- [x] **Secure Room Creation**: UUID room endpoints utilizing a clean `XXXX-XXXX` format.
- [x] **Dynamic QR Code Generation**: Scan QR codes on mobile to connect instantly.
- [x] **WebRTC Signaling**: Multi-protocol signaling (SDP & ICE exchange) run via Flask-SocketIO.
- [x] **Drag & Drop Uploads**: Native browser drag-drop interface for files.
- [x] **Multi-File Queuing**: Transmit multiple files in a sequential, race-condition-safe queue.
- [x] **Clipboard Paste**: Paste screenshots directly from your clipboard to send immediately.
- [x] **Backpressure Handling**: Tracks data channel `bufferedAmount` to pause sending before buffer overflow, resuming on `bufferedamountlow` event.
- [x] **Real-time Metrics**: Active speed (KiB/s, MiB/s) and ETA calculations.
- [x] **Cancel Transfers**: Cancel individual queued or active transfers dynamically.
- [x] **Mobile Responsive**: Styled with Tailwind for both mobile and desktop screens.
- [x] **Connected Device Signatures**: Direct handshake displays the peer's OS and Browser information.

---

## 🏗️ Architecture Diagram

The signaling process occurs via WebSockets (Flask-SocketIO), but the file transfer payload passes directly through a secure WebRTC DataChannel (SRTP/SCTP) browser-to-browser.

```mermaid
sequence-frame
    actor Sender as Sender Browser
    participant Flask as Flask Server
    actor Receiver as Receiver Browser

    Note over Sender, Receiver: 1. SIGNALING HANDSHAKE (WebSocket)
    Sender->>Flask: Join Room (initiator)
    Receiver->>Flask: Join Room (joiner)
    Flask->>Sender: notify 'peer_joined'
    
    Sender->>Flask: Send SDP Offer
    Flask->>Receiver: Relay SDP Offer
    Receiver->>Flask: Send SDP Answer
    Flask->>Sender: Relay SDP Answer
    
    loop ICE Candidate Exchange
        Sender->>Flask: Send ICE Candidate
        Flask->>Receiver: Relay ICE Candidate
        Receiver->>Flask: Send ICE Candidate
        Flask->>Sender: Relay ICE Candidate
    end

    Note over Sender, Receiver: 2. DIRECT WebRTC CONNECTION (P2P SCTP DataChannel)
    Sender->>Receiver: Handshake Metadata (Browser, OS info)
    
    Note over Sender, Receiver: 3. FILE STREAMING (Sequential Chunks)
    Sender->>Receiver: Send JSON Metadata (filename, size, mimetype)
    loop Chunks (64 KiB each)
        Sender->>Receiver: Send Binary Chunk (ArrayBuffer)
        Note over Sender: Check bufferedAmount\n(Backpressure applied)
    end
    Sender->>Receiver: Send JSON "Completed"
    Note over Receiver: Assemble Chunks -> Download Blob
```

---

## 📂 Folder Structure

```
beamly/
├── app/
│   ├── models/                # Python data models package
│   │   └── __init__.py
│   ├── services/              # Core business services
│   │   ├── __init__.py
│   │   └── room_manager.py    # In-memory room manager and cleaner
│   ├── static/
│   │   ├── css/
│   │   │   ├── src/
│   │   │   │   └── main.css   # Input CSS with Tailwind directives
│   │   │   └── style.css      # Compiled and minified Tailwind CSS
│   │   └── js/
│   │       ├── connection.js  # Coordinates RTCPeerConnection and SDP
│   │       ├── receiver.js    # Assembles chunks and triggers downloads
│   │       ├── rtc.js         # Peer connection creation with STUN servers
│   │       ├── sender.js      # Handles file reading, chunking, and backpressure
│   │       ├── signaling.js   # Socket.IO connection client
│   │       └── ui.js          # Direct DOM binding, clipboard, drag-drop
│   ├── templates/
│   │   ├── base.html          # Global wrapper with SEO and layout
│   │   ├── landing.html       # Join/Create room landing page
│   │   └── room.html          # Dynamic WebRTC transfer panel
│   ├── utils/
│   │   ├── __init__.py
│   │   └── helpers.py         # Room code and sanitization helpers
│   ├── __init__.py            # Flask application factory
│   └── routes.py              # HTTP routes and QR generator
├── config.py                  # App environment configurations
├── run.py                     # Server entrypoint (eventlet launcher)
├── requirements.txt           # Python application dependencies
├── package.json               # Node.js Tailwind compiler scripts
├── tailwind.config.js         # Neo-Brutalist styling configuration
├── Dockerfile                 # Multi-stage container script
├── docker-compose.yml         # Dev/Prod orchestration composition
├── LICENSE                    # MIT License
├── CONTRIBUTING.md            # Guidelines for open-source contributors
└── README.md                  # This file
```

---

## 🚀 Installation & Local Development

### Prerequisites
- Python 3.9+
- Node.js & npm (for compiling Tailwind CSS assets)

### Setup Instructions

1. **Activate Python Virtual Environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Install and Compile Assets**:
   ```bash
   npm install
   npm run build:css
   ```

3. **Start the Flask Application**:
   ```bash
   python run.py
   ```
   *The application will boot on `http://localhost:5001`.*

---

## 🐳 Docker Setup

Beamly features a multi-stage `Dockerfile` that compiles the CSS in Node and launches the application using Python 3.11-slim.

1. **Spin up using Docker Compose**:
   ```bash
   docker-compose up --build
   ```

2. **Access the Container**:
   The application will run on `http://localhost:5001`. You can pass environment variables in `docker-compose.yml` to tune room timers and file limitations.

---

## 🗺️ Future Roadmap

Contributions are open for the following roadmap features (labeled `TODO` in codebase):
- [ ] **Folder Transfer**: Support uploading and downloading directory tree structures.
- [ ] **End-to-End Verification**: Implement SHA-256 integrity checksum matches post-assembly.
- [ ] **Clipboard Sync**: Secure clipboard copy-paste text sharing between tabs.
- [ ] **Text Messaging**: Integrated text transfers for quick link exchanges.
- [ ] **Resumable Transfers**: Slice chunk ranges dynamically and request missing parts.
- [ ] **LAN Discovery**: Discover active rooms on the local network (mDNS/IP scans).
- [ ] **PWA Support**: Offline caching and native mobile installs.
- [ ] **Previews**: Inline rendering for image and video transfers prior to save.
- [ ] **Password-Protected Rooms**: Salted hashes exchanged during signaling.

---

## ❓ FAQ

#### **Q: What is the maximum file size Beamly can handle?**
**A**: Theoretically unlimited. Because files are sliced on-the-fly from disk via the HTML5 File API and transferred directly browser-to-browser, the server is never a bottleneck. However, the browser's RAM buffers chunks for file reconstruction on the receiving end.

#### **Q: Do I need a TURN server?**
**A**: Public Google STUN servers are bundled by default for NAT traversal, which works for most home networks. If both users are behind strict symmetric enterprise firewalls, they will require a TURN server. You can configure a TURN list in `config.py`.

#### **Q: Can files be intercepted on the signaling server?**
**A**: No. The signaling server (Flask) only routes signaling metadata (SDP/ICE descriptions). Once the direct P2P link is established, files are sent directly and encrypted out-of-band using DTLS-SRTP.

---

## 📄 License

Beamly is open-source software licensed under the [MIT License](LICENSE).
