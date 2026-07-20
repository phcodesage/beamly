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
     * Dynamically fetches ICE servers from backend API (Cloudflare TURN + STUN).
     * @returns {Promise<Array>}
     */
    static async fetchIceServers() {
        try {
            const backendUrl = (window.BACKEND_URL && window.BACKEND_URL.startsWith('http')) 
                ? window.BACKEND_URL.replace(/\/$/, '') 
                : '';
            const response = await fetch(`${backendUrl}/api/ice-servers`);
            if (response.ok) {
                const data = await response.json();
                if (data && data.iceServers && data.iceServers.length > 0) {
                    console.log('[RTC] Fetched dynamic ICE servers:', data.iceServers);
                    return data.iceServers;
                }
            }
        } catch (err) {
            console.warn('[RTC] Could not fetch dynamic ICE servers, using defaults:', err);
        }
        return RTCManager.DEFAULT_ICE_SERVERS;
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
