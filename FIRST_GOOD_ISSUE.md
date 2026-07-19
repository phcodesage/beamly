# Good First Issue: End-to-End File Integrity Verification (SHA-256) ⚡

We are looking for open-source contributors to implement this feature! Below is the detailed scope, target behavior, and code files to edit. 

If you are interested in working on this, please fork the repository, follow the [CONTRIBUTING.md](CONTRIBUTING.md) setup guide, and submit a Pull Request.

---

## 📋 Issue Description

Currently, Beamly transfers files directly browser-to-browser via WebRTC DataChannels. While the SCTP protocol guarantees ordered and reliable delivery, we want to add an extra layer of security by verifying that the transferred file is 100% identical to the source file by comparing SHA-256 checksums on both ends.

This is a great first issue for anyone looking to learn about the browser's native **Web Crypto API** and WebRTC metadata flow!

---

## 🎯 Goal

1. **Sender Side**: Computes the SHA-256 hash of the file before sending.
2. **Metadata Exchange**: Includes this hash in the initial `metadata` JSON control packet.
3. **Receiver Side**: Streams and buffers the binary file chunks.
4. **Verification**: Once completed, the Receiver computes the SHA-256 hash of the assembled file and compares it to the metadata hash.
5. **UI Indicator**: The UI displays an integrity indicator (e.g., a green shield/checkmark or a warning toast if they mismatch).

---

## 🛠️ Implementation Guide

Here is where the code changes need to be made:

### 1. In `app/static/js/sender.js`
In the [sender.js](app/static/js/sender.js) class:
* Before running the `start()` loop, calculate the SHA-256 hash of the file using the browser's native Web Crypto API:
  ```javascript
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  ```
  *(Note: For extremely large files, loading the entire file via `arrayBuffer()` can hit memory limits. As an optimization, you can compute it in chunks or keep it simple as a first implementation and add a TODO).*
* Update the `metadata` payload to send the hash:
  ```json
  {
      "type": "metadata",
      "fileId": "...",
      "filename": "...",
      "size": 12345,
      "checksum": "<hashHex>"
  }
  ```

### 2. In `app/static/js/receiver.js`
In the [receiver.js](app/static/js/receiver.js) class:
* Save the incoming `checksum` from the metadata packet.
* Upon calling `_finalizeTransfer(fileId)`, compute the SHA-256 hash of the assembled `Blob` before triggering the download:
  ```javascript
  const arrayBuffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  // Convert to hex and compare to this.activeFile.checksum
  ```
* Pass the comparison result (e.g., `isValid: true/false`) to the `onComplete` callback:
  ```javascript
  this.onComplete(fileId, blob, url, isValid);
  ```

### 3. In `app/static/js/ui.js` & `app/static/js/ui.js`
In the [ui.js](app/static/js/ui.js) script:
* Modify the `finalizeQueueItem(fileId, status, downloadUrl)` function.
* If the file is verified successfully (`isValid === true`), display a small green `✓ VERIFIED` badge next to the file inside the transfer queue.
* If verification fails, show a warning toast: `showToast('ERROR', 'File verification failed! Checksum mismatch.')`.

---

## 🧪 Testing Your Changes

1. Start the local server:
   ```bash
   python run.py
   ```
2. Open two separate tabs in `http://localhost:5001`.
3. Drag and drop a file and send it.
4. Verify that the file transfers successfully and displays the new `✓ VERIFIED` badge in the transfer queue.

---

## 📚 References
- [MDN Web Docs: Web Crypto API SubtleCrypto.digest()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest)
