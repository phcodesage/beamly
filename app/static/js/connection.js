/**
 * Beamly WebRTC Connection Coordinator Module
 * Orchestrates the signaling handshake, candidate queueing, state transitions, and connection lifecycle.
 */

class ConnectionCoordinator {
    /**
     * @param {string} roomCode - The room code to connect to
     * @param {SignalingClient} signalingClient - Instantiated signaling client
     * @param {object} callbacks - Hook functions
     * @param {Function} callbacks.onStateChange - (state, detail) => {}
     * @param {Function} callbacks.onPeerHandshake - (peerInfo) => {}
     * @param {Function} callbacks.onDataChannelMessage - (event) => {}
     * @param {Function} callbacks.onChannelClosed - () => {}
     */
    constructor(roomCode, signalingClient, callbacks = {}) {
        this.roomCode = roomCode;
        this.signaling = signalingClient;
        this.role = null; // 'initiator' or 'joiner'
        
        this.pc = null;
        this.dataChannel = null;
        
        // Queue ICE candidates received before remote description is set
        this.candidatesQueue = [];
        this.isRemoteDescriptionSet = false;

        this.onStateChange = callbacks.onStateChange || (() => {});
        this.onPeerHandshake = callbacks.onPeerHandshake || (() => {});
        this.onDataChannelMessage = callbacks.onDataChannelMessage || (() => {});
        this.onChannelClosed = callbacks.onChannelClosed || (() => {});
    }

    /**
     * Connects to the signaling server and joins the room.
     */
    async initialize() {
        this.onStateChange('connecting', 'Connecting to signaling server...');
        
        try {
            await this.signaling.connect();
            
            // Set up signaling listeners
            this.signaling.on('joined', (data) => this._handleJoined(data));
            this.signaling.on('peer_joined', () => this._handlePeerJoined());
            this.signaling.on('peer_left', () => this._handlePeerLeft());
            this.signaling.on('signal', (data) => this._handleSignal(data));
            this.signaling.on('error', (data) => this.onStateChange('error', data.message));
            this.signaling.on('disconnect', () => this.onStateChange('disconnected', 'Signaling channel disconnected.'));

            // Join room
            this.signaling.join(this.roomCode);

        } catch (err) {
            console.error('[Connection] Initialization failed:', err);
            this.onStateChange('error', 'Signaling server connection failed.');
        }
    }

    /**
     * Callback when this client joins the room.
     */
    async _handleJoined(data) {
        this.role = data.role;
        console.log(`[Connection] Joined room ${data.room} as ${this.role}`);
        
        if (this.role === 'initiator') {
            this.onStateChange('waiting', 'Waiting for receiver to join...');
        } else {
            this.onStateChange('connecting', 'Receiver joined. Establishing P2P link...');
            await this._setupPeerConnection();
        }
    }

    /**
     * Callback when a second peer joins (only called for initiator).
     */
    async _handlePeerJoined() {
        console.log('[Connection] Receiver peer detected. Creating offer...');
        this.onStateChange('connecting', 'Receiver detected. Setting up P2P link...');
        
        await this._setupPeerConnection();
        
        // Initiator creates data channel
        this._createDataChannel();
        
        // Create and send SDP offer
        this._createOffer();
    }

    /**
     * Sets up the RTCPeerConnection and standard ICE/State event handlers.
     */
    async _setupPeerConnection() {
        const iceServers = await RTCManager.fetchIceServers();
        this.pc = RTCManager.createPeerConnection({ iceServers: iceServers });


        // Send local ICE candidates to peer
        this.pc.addEventListener('icecandidate', (event) => {
            if (event.candidate) {
                this.signaling.sendSignal(this.roomCode, { candidate: event.candidate });
            }
        });

        // Monitor connection state
        this.pc.addEventListener('connectionstatechange', () => {
            switch (this.pc.connectionState) {
                case 'connected':
                    this.onStateChange('connected', 'Direct connection established!');
                    break;
                case 'failed':
                    this.onStateChange('failed', 'P2P negotiation failed. Retrying...');
                    this._retryConnection();
                    break;
                case 'disconnected':
                    this.onStateChange('disconnected', 'Peer disconnected.');
                    this._handlePeerLeft();
                    break;
            }
        });

        // Joiner side: Listen for incoming data channel
        this.pc.addEventListener('datachannel', (event) => {
            console.log('[Connection] Received remote DataChannel event');
            this.dataChannel = event.channel;
            this._configureDataChannel();
        });
    }

    /**
     * Initiates DataChannel on the initiator side.
     */
    _createDataChannel() {
        console.log('[Connection] Creating DataChannel: fileTransfer');
        // Reliable and ordered channel by default
        this.dataChannel = this.pc.createDataChannel('fileTransfer', {
            ordered: true
        });
        this._configureDataChannel();
    }

    /**
     * Binds message, open, close, and error events to the data channel.
     */
    _configureDataChannel() {
        if (!this.dataChannel) return;

        this.dataChannel.binaryType = 'arraybuffer';

        this.dataChannel.addEventListener('open', () => {
            console.log('[Connection] DataChannel is OPEN');
            this.onStateChange('connected', 'Secure direct channel opened.');
            
            // Send handshake metadata (Browser/OS details)
            this._sendHandshake();
        });

        this.dataChannel.addEventListener('close', () => {
            console.log('[Connection] DataChannel is CLOSED');
            this.onChannelClosed();
            this.onStateChange('disconnected', 'Data channel closed.');
        });

        this.dataChannel.addEventListener('error', (event) => {
            console.error('[Connection] DataChannel Error:', event.error);
            this.onStateChange('error', 'Data channel transfer error.');
        });

        // Relay data to receiver/sender handler
        this.dataChannel.addEventListener('message', (event) => {
            // Handshake message parser
            if (typeof event.data === 'string') {
                try {
                    const parsed = JSON.parse(event.data);
                    if (parsed.type === 'handshake') {
                        this.onPeerHandshake(parsed);
                        return; // Absorb handshake
                    }
                } catch (e) {
                    // Not a handshake JSON, pass to standard message relay
                }
            }
            this.onDataChannelMessage(event);
        });
    }

    /**
     * Emits browser and platform information to the peer.
     */
    _sendHandshake() {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            const userAgent = navigator.userAgent;
            
            // Simple UA parser logic to extract browser/OS
            let browser = "Unknown Browser";
            if (userAgent.indexOf("Firefox") > -1) browser = "Firefox";
            else if (userAgent.indexOf("SamsungBrowser") > -1) browser = "Samsung Browser";
            else if (userAgent.indexOf("Opera") > -1 || userAgent.indexOf("OPR") > -1) browser = "Opera";
            else if (userAgent.indexOf("Edge") > -1 || userAgent.indexOf("Edg") > -1) browser = "Microsoft Edge";
            else if (userAgent.indexOf("Chrome") > -1) browser = "Google Chrome";
            else if (userAgent.indexOf("Safari") > -1) browser = "Safari";

            let platform = "Unknown OS";
            if (userAgent.indexOf("Windows") > -1) platform = "Windows";
            else if (userAgent.indexOf("Macintosh") > -1) platform = "macOS";
            else if (userAgent.indexOf("Linux") > -1) platform = "Linux";
            else if (userAgent.indexOf("Android") > -1) platform = "Android";
            else if (userAgent.indexOf("iPhone") > -1 || userAgent.indexOf("iPad") > -1) platform = "iOS";

            this.dataChannel.send(JSON.stringify({
                type: 'handshake',
                browser: browser,
                platform: platform,
                userAgent: userAgent
            }));
        }
    }

    /**
     * Creates and sends the SDP offer (called by initiator).
     */
    async _createOffer() {
        try {
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);
            this.signaling.sendSignal(this.roomCode, { sdp: offer });
        } catch (err) {
            console.error('[Connection] Failed to create offer:', err);
            this.onStateChange('error', 'SDP negotiation failed.');
        }
    }

    /**
     * Handles signaling signals (SDP offer/answer and ICE candidates).
     */
    async _handleSignal(data) {
        if (!this.pc) return;

        try {
            const { sdp, candidate } = data.signal;

            if (sdp) {
                console.log('[Connection] Received remote SDP description type:', sdp.type);
                await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
                this.isRemoteDescriptionSet = true;
                
                // Flush queued ICE candidates
                while (this.candidatesQueue.length > 0) {
                    const cand = this.candidatesQueue.shift();
                    await this.pc.addIceCandidate(new RTCIceCandidate(cand));
                }

                // If joiner, create and send answer
                if (sdp.type === 'offer' && this.role === 'joiner') {
                    const answer = await this.pc.createAnswer();
                    await this.pc.setLocalDescription(answer);
                    this.signaling.sendSignal(this.roomCode, { sdp: answer });
                }
            } else if (candidate) {
                // Buffer candidates if remote description is not set yet
                if (!this.isRemoteDescriptionSet) {
                    this.candidatesQueue.push(candidate);
                } else {
                    await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
                }
            }
        } catch (err) {
            console.error('[Connection] Signaling payload application error:', err);
        }
    }

    /**
     * Resets peer connection on disconnect or peer exit.
     */
    _handlePeerLeft() {
        console.log('[Connection] Peer left room. Disconnecting PC.');
        this._cleanupPeerConnection();
        this.onChannelClosed();
        
        if (this.role === 'initiator') {
            this.onStateChange('waiting', 'Receiver left. Waiting for a new peer...');
        } else {
            this.onStateChange('disconnected', 'Sender disconnected. Rejoin or create a new room.');
        }
    }

    /**
     * Retries connection setup on ICE negotiation failure.
     */
    async _retryConnection() {
        this._cleanupPeerConnection();
        await this._setupPeerConnection();
        if (this.role === 'initiator') {
            this._createDataChannel();
            this._createOffer();
        }
    }


    /**
     * Cleans up RTCPeerConnection and DataChannel objects.
     */
    _cleanupPeerConnection() {
        this.isRemoteDescriptionSet = false;
        this.candidatesQueue = [];
        
        if (this.dataChannel) {
            try {
                this.dataChannel.close();
            } catch (e) {}
            this.dataChannel = null;
        }
        
        if (this.pc) {
            try {
                this.pc.close();
            } catch (e) {}
            this.pc = null;
        }
    }

    /**
     * Explicit disconnect.
     */
    close() {
        this.signaling.leave(this.roomCode);
        this._cleanupPeerConnection();
        this.signaling.disconnect();
    }
}

// Expose to window namespace
window.ConnectionCoordinator = ConnectionCoordinator;
