/**
 * Beamly WebRTC RTCPeerConnection Module
 * Configures the WebRTC connection configurations, ICE servers, and peer lifecycle.
 */

class RTCManager {
    /**
     * Default public STUN servers for NAT traversal in development/demo environments.
     */
    static get DEFAULT_ICE_SERVERS() {
        return [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun.ekiga.net' },
            { urls: 'stun:stun.ideasip.com' }
        ];
    }

    /**
     * Creates and configures a new RTCPeerConnection instance.
     * @param {object} config - Custom WebRTC configurations (optional)
     * @returns {RTCPeerConnection}
     */
    static createPeerConnection(config = {}) {
        const iceServers = config.iceServers || RTCManager.DEFAULT_ICE_SERVERS;
        
        console.log('[RTC] Initializing RTCPeerConnection with servers:', iceServers);
        
        const pc = new RTCPeerConnection({
            iceServers: iceServers,
            // Bundle policy max-bundle ensures all tracks/data channels are multiplexed on a single port
            bundlePolicy: 'max-bundle',
            // Default connection strategy
            rtcpMuxPolicy: 'require'
        });

        // Set up debug loggers for connection state changes
        pc.addEventListener('connectionstatechange', () => {
            console.log('[RTC] Connection State Changed:', pc.connectionState);
        });

        pc.addEventListener('iceconnectionstatechange', () => {
            console.log('[RTC] ICE Connection State Changed:', pc.iceConnectionState);
        });

        pc.addEventListener('signalingstatechange', () => {
            console.log('[RTC] Signaling State Changed:', pc.signalingState);
        });

        return pc;
    }
}

// Expose to window namespace
window.RTCManager = RTCManager;
