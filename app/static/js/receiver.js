/**
 * Beamly WebRTC File Receiver Module
 * Assembles binary chunks into a local file and handles metadata, progress calculation, and downloads.
 */

class FileReceiver {
    /**
     * @param {object} callbacks - Callback hooks
     * @param {Function} callbacks.onMetaReceived - Hook when metadata is received (metadata) => {}
     * @param {Function} callbacks.onProgress - Progress hook (data) => {}
     * @param {Function} callbacks.onComplete - Success hook (fileId, blob, url) => {}
     * @param {Function} callbacks.onCancel - Cancel hook (fileId) => {}
     * @param {Function} callbacks.onError - Error hook (fileId, error) => {}
     */
    constructor(callbacks = {}) {
        this.onMetaReceived = callbacks.onMetaReceived || (() => {});
        this.onProgress = callbacks.onProgress || (() => {});
        this.onComplete = callbacks.onComplete || (() => {});
        this.onCancel = callbacks.onCancel || (() => {});
        this.onError = callbacks.onError || (() => {});

        // Active transfer state
        this.activeFile = null;
        this.startTime = null;
    }

    /**
     * Handles string message data from the DataChannel (JSON control payloads).
     * @param {object} message 
     */
    handleControlMessage(message) {
        switch (message.type) {
            case 'metadata':
                this._initializeTransfer(message);
                break;
            case 'completed':
                this._finalizeTransfer(message.fileId);
                break;
            case 'control':
                if (message.action === 'cancel') {
                    this._cancelTransfer(message.fileId);
                }
                break;
            default:
                console.warn('[Receiver] Unknown control message type:', message.type);
        }
    }

    /**
     * Handles binary chunk data from the DataChannel.
     * @param {ArrayBuffer} chunk 
     */
    handleBinaryChunk(chunk) {
        if (!this.activeFile) {
            console.error('[Receiver] Received binary chunk but no active transfer metadata exists.');
            return;
        }

        const file = this.activeFile;
        file.chunks.push(chunk);
        file.receivedBytes += chunk.byteLength;

        // Calculate transfer metrics
        const elapsed = (Date.now() - this.startTime) / 1000; // seconds
        const speed = elapsed > 0 ? file.receivedBytes / elapsed : 0; // bytes/sec
        const remainingBytes = file.size - file.receivedBytes;
        const eta = speed > 0 ? remainingBytes / speed : 0; // seconds
        const percent = Math.round((file.receivedBytes / file.size) * 100);

        this.onProgress({
            fileId: file.fileId,
            offset: file.receivedBytes,
            size: file.size,
            percent: percent,
            speed: speed,
            eta: eta
        });

        // Safety auto-completion check if completed control message was missed or delayed
        if (file.receivedBytes >= file.size) {
            // Give a short delay to see if completed packet arrives, otherwise trigger auto-finalize
            setTimeout(() => {
                if (this.activeFile && this.activeFile.fileId === file.fileId) {
                    console.log('[Receiver] Automatic completion trigger for:', file.filename);
                    this._finalizeTransfer(file.fileId);
                }
            }, 300);
        }
    }

    /**
     * Initializes the state for a new file transfer.
     * @param {object} meta 
     */
    _initializeTransfer(meta) {
        console.log('[Receiver] Initializing new file transfer metadata:', meta);
        this.startTime = Date.now();
        this.activeFile = {
            fileId: meta.fileId,
            filename: meta.filename,
            size: meta.size,
            mimeType: meta.mimeType,
            receivedBytes: 0,
            chunks: [] // Array of ArrayBuffers storing raw parts
        };

        // Notify UI/App
        this.onMetaReceived(this.activeFile);
    }

    /**
     * Assembles chunks, triggers download, and cleans up.
     * @param {string} fileId 
     */
    _finalizeTransfer(fileId) {
        if (!this.activeFile || this.activeFile.fileId !== fileId) return;

        const file = this.activeFile;
        console.log(`[Receiver] Assembly starting for ${file.filename} (${file.receivedBytes} bytes)`);

        try {
            // Assemble ArrayBuffers into a browser Blob
            const blob = new Blob(file.chunks, { type: file.mimeType });
            const url = URL.createObjectURL(blob);

            // Auto download file for the user
            this._triggerDownload(url, file.filename);

            // Trigger success callback
            this.onComplete(fileId, blob, url);
        } catch (err) {
            console.error('[Receiver] Assembly failed:', err);
            this.onError(fileId, err);
        } finally {
            // Clean up state
            this.activeFile = null;
            this.startTime = null;
        }
    }

    /**
     * Cancels the active transfer and deletes cached chunks.
     * @param {string} fileId 
     */
    _cancelTransfer(fileId) {
        if (this.activeFile && this.activeFile.fileId === fileId) {
            console.log(`[Receiver] Transfer cancelled for: ${this.activeFile.filename}`);
            this.activeFile = null;
            this.startTime = null;
            this.onCancel(fileId);
        }
    }

    /**
     * Triggers a programmatic download in the browser.
     * @param {string} url - Blob URL
     * @param {string} filename - Filename to save as
     */
    _triggerDownload(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    /**
     * Resets state (call when connection drops).
     */
    reset() {
        if (this.activeFile) {
            const fileId = this.activeFile.fileId;
            this.activeFile = null;
            this.startTime = null;
            this.onError(fileId, new Error('WebRTC DataChannel connection lost.'));
        }
    }
}

// Expose to window namespace
window.FileReceiver = FileReceiver;
