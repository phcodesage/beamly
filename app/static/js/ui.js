/**
 * Beamly UI Controller Module
 * Integrates WebRTC connection states, sender/receiver tasks, drag-drop bindings, and dynamic page state updates.
 */

// Global state variables
let coordinator = null;
let signaling = null;
let receiver = null;
let activeSender = null;
const sendQueue = [];
let queueRunning = false;
const activeTransfers = new Map(); // fileId -> DOMElement

// Format utility functions
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatSpeed(bytesPerSec) {
    return formatBytes(bytesPerSec, 1) + '/s';
}

function formatETA(seconds) {
    if (!isFinite(seconds) || seconds === null || seconds === undefined) return 'Calculating...';
    if (seconds <= 0) return '0s';
    if (seconds < 60) return Math.round(seconds) + 's';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
}

/**
 * Toast notifications generator
 * @param {'SUCCESS'|'INFO'|'ERROR'|'WARNING'} type 
 * @param {string} message 
 */
function showToast(type, message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-neo transform translate-y-4 opacity-0 transition-all duration-300';
    
    // Assign custom styling based on Toast Type
    let bg = 'bg-neoWhite';
    let icon = '⚡';
    
    switch (type) {
        case 'SUCCESS':
            bg = 'bg-neoGreen';
            icon = '✓';
            break;
        case 'ERROR':
            bg = 'bg-neoPink text-neoWhite';
            icon = '✕';
            break;
        case 'WARNING':
            bg = 'bg-neoYellow';
            icon = '⚠';
            break;
        case 'INFO':
            bg = 'bg-neoBlue';
            icon = 'ℹ';
            break;
    }
    
    toast.className = `toast-neo ${bg}`;
    toast.innerHTML = `
        <span class="border-3 border-neoBlack bg-neoWhite text-neoBlack w-6 h-6 flex items-center justify-center font-black select-none text-xs shadow-neo-sm">
            ${icon}
        </span>
        <span class="flex-grow select-all uppercase tracking-wide text-xs md:text-sm font-black leading-snug">${message}</span>
        <button class="font-extrabold hover:text-neoYellow cursor-pointer pl-2">&times;</button>
    `;

    // Add click close handler
    toast.querySelector('button').addEventListener('click', () => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-4', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    });

    container.appendChild(toast);

    // Trigger visual entry transition
    requestAnimationFrame(() => {
        setTimeout(() => {
            toast.classList.remove('translate-y-4', 'opacity-0');
            toast.classList.add('translate-y-0', 'opacity-100');
        }, 10);
    });

    // Auto dismiss after 4 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.remove('translate-y-0', 'opacity-100');
            toast.classList.add('translate-y-4', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }
    }, 4000);
}

// Bind to window for templates to access
window.showToast = showToast;

/**
 * Initializes listeners and mounts modules when room loads.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Only execute on room route
    if (!window.BEAMLY_ROOM) return;
    
    console.log('[UI] Initializing Beamly transfer module...');

    // Initialize receiver module
    receiver = new FileReceiver({
        onMetaReceived: (meta) => {
            addQueueItem(meta.fileId, meta.filename, meta.size, 'RECEIVING');
            showToast('INFO', `Receiving: ${meta.filename}`);
        },
        onProgress: (progress) => {
            updateQueueProgress(progress);
        },
        onComplete: (fileId, blob, url) => {
            finalizeQueueItem(fileId, 'RECEIVED', url);
            showToast('SUCCESS', 'File received successfully!');
        },
        onCancel: (fileId) => {
            failQueueItem(fileId, 'Cancelled by sender.');
            showToast('WARNING', 'File transfer cancelled.');
        },
        onError: (fileId, err) => {
            failQueueItem(fileId, err.message || 'Transfer failed.');
            showToast('ERROR', `Error: ${err.message || 'Transfer failed'}`);
        }
    });

    // Initialize signaling client and connection coordinator
    signaling = new SignalingClient();
    coordinator = new ConnectionCoordinator(window.BEAMLY_ROOM.code, signaling, {
        onStateChange: (state, detail) => handleStateChange(state, detail),
        onPeerHandshake: (peerInfo) => handlePeerHandshake(peerInfo),
        onDataChannelMessage: (event) => handleIncomingMessage(event),
        onChannelClosed: () => handleChannelClosed()
    });

    // Fire startup connection orchestrator
    coordinator.initialize();

    // Set up drag and drop and inputs
    setupInputListeners();
});

/**
 * Updates UI badge based on ConnectionCoordinator states.
 */
function handleStateChange(state, detail) {
    console.log(`[UI State] State: ${state} (${detail})`);
    
    const badge = document.getElementById('connectionStatusBadge');
    const overlay = document.getElementById('connectionOverlay');
    
    if (!badge) return;

    // Reset badge coloring classes
    badge.className = 'border-3 border-neoBlack px-4 py-2 font-extrabold text-center uppercase shadow-neo-sm';

    switch (state) {
        case 'waiting':
            badge.innerText = 'WAITING FOR PEER...';
            badge.classList.add('bg-neoYellow', 'text-neoBlack');
            if (overlay) overlay.classList.remove('hidden');
            break;
            
        case 'connecting':
            badge.innerText = 'NEGOTIATING...';
            badge.classList.add('bg-neoBlue', 'text-neoBlack');
            if (overlay) overlay.classList.remove('hidden');
            break;
            
        case 'connected':
            badge.innerText = 'CONNECTED';
            badge.classList.add('bg-neoGreen', 'text-neoBlack');
            if (overlay) overlay.classList.add('hidden');
            showToast('SUCCESS', 'Connected directly to peer device!');
            break;
            
        case 'disconnected':
            badge.innerText = 'DISCONNECTED';
            badge.classList.add('bg-neoPink', 'text-neoWhite');
            if (overlay) overlay.classList.remove('hidden');
            break;
            
        case 'failed':
            badge.innerText = 'NEGOTIATION FAILED';
            badge.classList.add('bg-neoPink', 'text-neoWhite');
            showToast('ERROR', 'WebRTC link failed. Retrying context...');
            break;
            
        case 'error':
            badge.innerText = 'SIGNAL ERROR';
            badge.classList.add('bg-neoPink', 'text-neoWhite');
            showToast('ERROR', `Error context: ${detail}`);
            break;
    }
}

/**
 * Displays connected device information from the handshake message.
 */
function handlePeerHandshake(peerInfo) {
    console.log('[UI Handshake] Peer details:', peerInfo);
    
    const panel = document.getElementById('peerInfoPanel');
    const nameEl = document.getElementById('peerDeviceName');
    const browserEl = document.getElementById('peerBrowserName');
    
    if (panel && nameEl && browserEl) {
        nameEl.innerText = peerInfo.platform.toUpperCase();
        browserEl.innerText = peerInfo.browser.toUpperCase();
        panel.classList.remove('hidden');
        panel.classList.add('flex');
    }
}

/**
 * Closes device details and resets UI queues when channels drop.
 */
function handleChannelClosed() {
    const panel = document.getElementById('peerInfoPanel');
    if (panel) {
        panel.classList.add('hidden');
        panel.classList.remove('flex');
    }
    
    // Terminate any active receiver task
    receiver.reset();
    
    // Wipe local queue items that are currently running
    activeTransfers.forEach((element, fileId) => {
        const bar = element.querySelector('.progress-neo-bar');
        const status = element.querySelector('.file-direction');
        if (status && (status.innerText.includes('SENDING') || status.innerText.includes('RECEIVING'))) {
            failQueueItem(fileId, 'Link lost');
        }
    });

    // Clear sending tasks
    sendQueue.length = 0;
    queueRunning = false;
    activeSender = null;
}

/**
 * Forwards received data payload directly to receiver handler.
 */
function handleIncomingMessage(event) {
    if (typeof event.data === 'string') {
        try {
            const parsed = JSON.parse(event.data);
            receiver.handleControlMessage(parsed);
        } catch (e) {
            console.error('[UI] Failed to parse string message:', e);
        }
    } else {
        receiver.handleBinaryChunk(event.data);
    }
}

/**
 * Binds dropzone events, copy-clipboard paste, and file input selectors.
 */
function setupInputListeners() {
    const dropZone = document.getElementById('dropZone');
    const filePicker = document.getElementById('filePicker');
    
    if (!dropZone || !filePicker) return;

    // Drag-over hover states
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('bg-yellow-100', 'border-neoPink');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('bg-yellow-100', 'border-neoPink');
        }, false);
    });

    // File dropped trigger
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            handleSelectedFiles(files);
        }
    });

    // Click dropzone triggers file picker click
    dropZone.addEventListener('click', () => {
        filePicker.click();
    });

    // File picker selection change
    filePicker.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleSelectedFiles(files);
        }
    });

    // Global document paste for screenshots
    window.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        const pastedFiles = [];
        
        for (let item of items) {
            if (item.kind === 'file') {
                const blob = item.getAsFile();
                if (blob) {
                    // Give a neat timestamp name to pasted images
                    const ext = blob.type.split('/')[1] || 'png';
                    const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
                    const filename = `Pasted_Image_${timestamp}.${ext}`;
                    const file = new File([blob], filename, { type: blob.type });
                    pastedFiles.push(file);
                }
            }
        }

        if (pastedFiles.length > 0) {
            handleSelectedFiles(pastedFiles);
            showToast('INFO', `Pasted ${pastedFiles.length} file(s) from clipboard.`);
        }
    });
}

/**
 * Loops and packages selected files into the sequential Sender queue.
 */
function handleSelectedFiles(files) {
    if (!coordinator || !coordinator.dataChannel || coordinator.dataChannel.readyState !== 'open') {
        showToast('ERROR', 'No connected peer. Cannot send files.');
        return;
    }

    const panel = document.getElementById('queuePanel');
    if (panel) panel.classList.remove('hidden');

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Generate a random temporary ID for UI tracking
        const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        addQueueItem(fileId, file.name, file.size, 'SENDING');
        
        // Setup individual sender
        const sender = new FileSender(coordinator.dataChannel, file, fileId, {
            onProgress: (progress) => updateQueueProgress(progress),
            onComplete: (id) => finalizeQueueItem(id, 'SENT'),
            onError: (id, err) => failQueueItem(id, err.message || 'Failed')
        });

        // Add to queue array
        sendQueue.push({ fileId, sender });
    }

    // Trigger run of send queue if not already executing
    if (!queueRunning) {
        runSendQueue();
    }
}

/**
 * Sequential queue execution loop.
 */
async function runSendQueue() {
    queueRunning = true;
    updateQueueCount();

    while (sendQueue.length > 0) {
        const task = sendQueue[0];
        activeSender = task.sender;
        
        // Update UI target to show active transfer
        const el = activeTransfers.get(task.fileId);
        if (el) {
            el.querySelector('.file-speed').innerText = 'Starting...';
        }

        // Start async transmission loop
        await activeSender.start();
        
        // Done, pop from queue
        sendQueue.shift();
        updateQueueCount();
    }

    queueRunning = false;
    activeSender = null;
    updateQueueCount();
}

/**
 * Updates the files counter badge.
 */
function updateQueueCount() {
    const badge = document.getElementById('queueCount');
    if (!badge) return;
    
    const activeCount = sendQueue.length;
    badge.innerText = `${activeCount} FILES IN QUEUE`;
}

/**
 * Clones the HTML template to render a list element in the transfer queue.
 * @param {string} fileId 
 * @param {string} filename 
 * @param {number} size 
 * @param {'SENDING'|'RECEIVING'} direction 
 */
function addQueueItem(fileId, filename, size, direction) {
    const list = document.getElementById('queueList');
    const template = document.getElementById('queueItemTemplate');
    const panel = document.getElementById('queuePanel');
    
    if (!list || !template) return;
    if (panel) panel.classList.remove('hidden');

    const clone = template.content.cloneNode(true);
    const itemContainer = clone.querySelector('div');
    itemContainer.setAttribute('data-file-id', fileId);

    // Apply file name
    itemContainer.querySelector('.file-name').innerText = filename;
    itemContainer.querySelector('.file-name').setAttribute('title', filename);

    // Apply file size
    itemContainer.querySelector('.file-size-info').innerText = `0 B / ${formatBytes(size)}`;

    // Set file extension thumbnail
    const ext = filename.split('.').pop().toUpperCase().slice(0, 4) || 'FILE';
    const thumb = itemContainer.querySelector('.file-type-icon');
    thumb.innerText = ext;

    // Direct configuration
    const badge = itemContainer.querySelector('.file-direction');
    badge.innerText = direction;
    if (direction === 'SENDING') {
        badge.className = 'file-direction border-3 border-neoBlack bg-neoBlue text-neoBlack px-2 py-0.5 text-xs font-black uppercase shadow-neo-sm';
    } else {
        badge.className = 'file-direction border-3 border-neoBlack bg-neoGreen text-neoBlack px-2 py-0.5 text-xs font-black uppercase shadow-neo-sm';
    }

    // Cancel click logic
    const cancelBtn = itemContainer.querySelector('.btn-cancel');
    cancelBtn.addEventListener('click', () => {
        cancelTransfer(fileId);
    });

    list.appendChild(clone);
    
    // Store reference in memory
    activeTransfers.set(fileId, list.lastElementChild);
    
    // Scroll queue container to bottom
    list.scrollTop = list.scrollHeight;
}

/**
 * Updates progress bars, speeds, and ETA metrics dynamically.
 */
function updateQueueProgress(progress) {
    const el = activeTransfers.get(progress.fileId);
    if (!el) return;

    // Update progress bar width
    const bar = el.querySelector('.progress-neo-bar');
    if (bar) {
        bar.style.width = `${progress.percent}%`;
    }

    // Update text indicators
    const percentText = el.querySelector('.file-percent');
    if (percentText) percentText.innerText = `${progress.percent}%`;

    const sizeInfo = el.querySelector('.file-size-info');
    if (sizeInfo) {
        sizeInfo.innerText = `${formatBytes(progress.offset)} / ${formatBytes(progress.size)}`;
    }

    const speedText = el.querySelector('.file-speed');
    if (speedText) speedText.innerText = `Speed: ${formatSpeed(progress.speed)}`;

    const etaText = el.querySelector('.file-eta');
    if (etaText) etaText.innerText = `ETA: ${formatETA(progress.eta)}`;
}

/**
 * Changes queue item indicators to SUCCESS / download linkages.
 * @param {string} fileId 
 * @param {'SENT'|'RECEIVED'} status 
 * @param {string} downloadUrl - Optional Blob download URL for receiver
 */
function finalizeQueueItem(fileId, status, downloadUrl = null) {
    const el = activeTransfers.get(fileId);
    if (!el) return;

    // Complete the progress bar width and adjust details
    const bar = el.querySelector('.progress-neo-bar');
    if (bar) {
        bar.style.width = '100%';
        bar.className = 'progress-neo-bar h-full bg-neoGreen border-r-3 border-neoBlack transition-all duration-300';
    }

    const percentText = el.querySelector('.file-percent');
    if (percentText) percentText.innerText = '100%';

    const badge = el.querySelector('.file-direction');
    if (badge) {
        badge.innerText = status;
        badge.className = 'file-direction border-3 border-neoBlack bg-neoGreen text-neoBlack px-2 py-0.5 text-xs font-black uppercase shadow-neo-sm';
    }

    const speedText = el.querySelector('.file-speed');
    if (speedText) speedText.innerText = 'Completed';

    const etaText = el.querySelector('.file-eta');
    if (etaText) etaText.innerText = '';

    // Remove Cancel button
    const cancelBtn = el.querySelector('.btn-cancel');
    if (cancelBtn) {
        if (downloadUrl) {
            // Replace cancel button with a download button icon link
            cancelBtn.outerHTML = `
                <a href="${downloadUrl}" download="${el.querySelector('.file-name').innerText}" 
                   class="btn-neo btn-neo-yellow py-1 px-3 text-xs font-black uppercase inline-block text-center shadow-neo-sm">
                   Save
                </a>
            `;
        } else {
            cancelBtn.remove();
        }
    }
}

/**
 * Marks transfer queue list element as failed.
 */
function failQueueItem(fileId, message) {
    const el = activeTransfers.get(fileId);
    if (!el) return;

    const bar = el.querySelector('.progress-neo-bar');
    if (bar) {
        bar.className = 'progress-neo-bar h-full bg-neoPink border-r-3 border-neoBlack transition-all duration-300';
    }

    const badge = el.querySelector('.file-direction');
    if (badge) {
        badge.innerText = 'FAILED';
        badge.className = 'file-direction border-3 border-neoBlack bg-neoPink text-neoWhite px-2 py-0.5 text-xs font-black uppercase shadow-neo-sm';
    }

    const speedText = el.querySelector('.file-speed');
    if (speedText) speedText.innerText = message || 'Error';

    const etaText = el.querySelector('.file-eta');
    if (etaText) etaText.innerText = '';

    const cancelBtn = el.querySelector('.btn-cancel');
    if (cancelBtn) cancelBtn.remove();
}

/**
 * Cancels a file transfer session inside the queue list.
 */
function cancelTransfer(fileId) {
    console.log('[UI] Cancel clicked for:', fileId);
    
    // Case 1: Active sender task running
    if (activeSender && activeSender.fileId === fileId) {
        activeSender.cancel();
        failQueueItem(fileId, 'Cancelled');
        return;
    }

    // Case 2: In the waiting sender queue
    const queueIndex = sendQueue.findIndex(task => task.fileId === fileId);
    if (queueIndex > -1) {
        // Remove task from waiting queue array
        sendQueue.splice(queueIndex, 1);
        failQueueItem(fileId, 'Cancelled');
        updateQueueCount();
        return;
    }

    // Case 3: Receiving task
    if (receiver && receiver.activeFile && receiver.activeFile.fileId === fileId) {
        // Trigger cancel back message
        if (coordinator && coordinator.dataChannel && coordinator.dataChannel.readyState === 'open') {
            try {
                coordinator.dataChannel.send(JSON.stringify({
                    type: 'control',
                    action: 'cancel',
                    fileId: fileId
                }));
            } catch (e) {}
        }
        receiver._cancelTransfer(fileId);
        return;
    }

    // Fallback cleanup
    failQueueItem(fileId, 'Cancelled');
}
