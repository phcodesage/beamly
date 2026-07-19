/**
 * Beamly WebRTC File Sender Module
 * Manages chunking files, backpressure, speed calculation, and sending metadata.
 */

class FileSender {
    /**
     * @param {RTCDataChannel} dataChannel - The WebRTC data channel
     * @param {File} file - The HTML5 File object to send
     * @param {string} fileId - Unique identifier for the transfer
     * @param {object} callbacks - Callback functions for events
     * @param {Function} callbacks.onProgress - Progress hook (data) => {}
     * @param {Function} callbacks.onComplete - Success hook (fileId) => {}
     * @param {Function} callbacks.onError - Error hook (fileId, error) => {}
     */
    constructor(dataChannel, file, fileId, callbacks = {}) {
        this.channel = dataChannel;
        this.file = file;
        this.fileId = fileId;
        
        this.onProgress = callbacks.onProgress || (() => {});
        this.onComplete = callbacks.onComplete || (() => {});
        this.onError = callbacks.onError || (() => {});

        // Customizable configurations
        this.chunkSize = 64 * 1024; // 64 KiB chunk size
        this.highWaterMark = 1024 * 1024; // 1 MiB buffer limit before pause
        this.lowWaterMark = 64 * 1024; // 64 KiB trigger for resuming

        // Transfer state
        this.offset = 0;
        this.paused = false;
        this.cancelled = false;
        this.startTime = null;
        
        // Set the buffered amount threshold to trigger the bufferedamountlow event
        this.channel.bufferedAmountLowThreshold = this.lowWaterMark;
    }

    /**
     * Slices a piece of the file and reads it as an ArrayBuffer.
     * @param {Blob} blobSlice 
     * @returns {Promise<ArrayBuffer>}
     */
    _readSlice(blobSlice) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = () => reject(new Error(`Failed to read file slice: ${reader.error}`));
            reader.readAsArrayBuffer(blobSlice);
        });
    }

    /**
     * Starts the file transfer process asynchronously.
     */
    async start() {
        console.log(`[Sender] Starting transfer for: ${this.file.name} (${this.file.size} bytes)`);
        this.startTime = Date.now();

        // 1. Send metadata packet as JSON text
        try {
            this.channel.send(JSON.stringify({
                type: 'metadata',
                fileId: this.fileId,
                filename: this.file.name,
                size: this.file.size,
                mimeType: this.file.type || 'application/octet-stream',
                lastModified: this.file.lastModified,
                checksum: null // TODO: Add SHA-256 end-to-end verification
            }));
        } catch (err) {
            console.error('[Sender] Failed to send metadata:', err);
            this.onError(this.fileId, err);
            return;
        }

        // 2. Loop through file, chunk it, and send
        try {
            while (this.offset < this.file.size && !this.cancelled) {
                // Handle Pausing
                if (this.paused) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    continue;
                }

                // Handle Backpressure
                // If the outgoing buffer is full, wait for the 'bufferedamountlow' event
                if (this.channel.bufferedAmount > this.highWaterMark) {
                    await new Promise((resolve) => {
                        const onLow = () => {
                            this.channel.removeEventListener('bufferedamountlow', onLow);
                            resolve();
                        };
                        this.channel.addEventListener('bufferedamountlow', onLow);
                    });
                    continue;
                }

                // Slice next chunk
                const end = Math.min(this.offset + this.chunkSize, this.file.size);
                const slice = this.file.slice(this.offset, end);
                
                // Read slice as array buffer
                const buffer = await this._readSlice(slice);

                // Exit early if cancelled during async file read
                if (this.cancelled) break;

                // Send binary chunk over data channel
                this.channel.send(buffer);
                this.offset += buffer.byteLength;

                // Calculate transfer metrics
                const elapsed = (Date.now() - this.startTime) / 1000; // seconds
                const speed = elapsed > 0 ? this.offset / elapsed : 0; // bytes/sec
                const remainingBytes = this.file.size - this.offset;
                const eta = speed > 0 ? remainingBytes / speed : 0; // seconds
                const percent = Math.round((this.offset / this.file.size) * 100);

                // Trigger progress update
                this.onProgress({
                    fileId: this.fileId,
                    offset: this.offset,
                    size: this.file.size,
                    percent: percent,
                    speed: speed,
                    eta: eta
                });
            }

            // 3. Finalize transfer if not cancelled
            if (!this.cancelled) {
                console.log(`[Sender] Completed transfer for: ${this.file.name}`);
                this.channel.send(JSON.stringify({
                    type: 'completed',
                    fileId: this.fileId
                }));
                this.onComplete(this.fileId);
            }

        } catch (err) {
            console.error('[Sender] Error in transfer loop:', err);
            this.onError(this.fileId, err);
        }
    }

    /**
     * Pauses the file transfer.
     */
    pause() {
        this.paused = true;
        console.log(`[Sender] Paused file transfer: ${this.fileId}`);
    }

    /**
     * Resumes the file transfer.
     */
    resume() {
        this.paused = false;
        console.log(`[Sender] Resumed file transfer: ${this.fileId}`);
    }

    /**
     * Cancels the file transfer.
     */
    cancel() {
        this.cancelled = true;
        console.log(`[Sender] Cancelled file transfer: ${this.fileId}`);
        try {
            this.channel.send(JSON.stringify({
                type: 'control',
                action: 'cancel',
                fileId: this.fileId
            }));
        } catch (e) {
            // Channel may already be closed
        }
    }
}

// Expose to window namespace
window.FileSender = FileSender;
