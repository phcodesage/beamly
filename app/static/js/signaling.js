/**
 * Beamly Signaling Client Module
 * Manages the Socket.IO signaling channel to coordinate peer discovery.
 */

class SignalingClient {
    constructor() {
        this.socket = null;
        this.handlers = {};
    }

    /**
     * Connects to the Socket.IO server.
     */
    connect() {
        return new Promise((resolve, reject) => {
            try {
                // Initialize socket connection using standard client import
                this.socket = io({
                    transports: ['websocket', 'polling']
                });

                this.socket.on('connect', () => {
                    console.log('[Signaling] Connected to Socket.IO server. SID:', this.socket.id);
                    resolve();
                });

                this.socket.on('connect_error', (error) => {
                    console.error('[Signaling] Connection error:', error);
                    reject(error);
                });

                // Set up event relayers to local handlers
                this.socket.on('joined', (data) => this._trigger('joined', data));
                this.socket.on('peer_joined', (data) => this._trigger('peer_joined', data));
                this.socket.on('peer_left', (data) => this._trigger('peer_left', data));
                this.socket.on('signal', (data) => this._trigger('signal', data));
                this.socket.on('error', (data) => this._trigger('error', data));
                
                this.socket.on('disconnect', (reason) => {
                    console.log('[Signaling] Disconnected from server:', reason);
                    this._trigger('disconnect', reason);
                });

            } catch (err) {
                console.error('[Signaling] Setup error:', err);
                reject(err);
            }
        });
    }

    /**
     * Registers an event callback.
     * @param {string} eventName 
     * @param {Function} callback 
     */
    on(eventName, callback) {
        if (!this.handlers[eventName]) {
            this.handlers[eventName] = [];
        }
        this.handlers[eventName].push(callback);
    }

    /**
     * Sends a join room request to the server.
     * @param {string} roomCode 
     */
    join(roomCode) {
        if (!this.socket || !this.socket.connected) {
            console.error('[Signaling] Cannot join, socket not connected.');
            return;
        }
        console.log('[Signaling] Emitting join request for room:', roomCode);
        this.socket.emit('join', { room: roomCode });
    }

    /**
     * Relays a signaling payload (SDP offer/answer or ICE candidate) to the peer.
     * @param {string} roomCode 
     * @param {object} signalData 
     */
    sendSignal(roomCode, signalData) {
        if (!this.socket || !this.socket.connected) {
            console.error('[Signaling] Cannot send signal, socket not connected.');
            return;
        }
        this.socket.emit('signal', {
            room: roomCode,
            signal: signalData
        });
    }

    /**
     * Leaves the active room.
     * @param {string} roomCode 
     */
    leave(roomCode) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('leave', { room: roomCode });
        }
    }

    /**
     * Disconnects the socket.
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    /**
     * Internal method to trigger registered handlers.
     * @param {string} eventName 
     * @param {any} data 
     */
    _trigger(eventName, data) {
        const callbacks = this.handlers[eventName];
        if (callbacks) {
            callbacks.forEach(cb => {
                try {
                    cb(data);
                } catch (err) {
                    console.error(`[Signaling] Error in handler for event "${eventName}":`, err);
                }
            });
        }
    }
}

// Expose to window namespace
window.SignalingClient = SignalingClient;
