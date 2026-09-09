/* =========================================================
   GUEST QR SCANNER
   Camera permission is requested only after the guest taps Scan waiter QR.
   URL context never grants staff authority; it only selects venue/waiter service.
   ========================================================= */

let guestQrStream = null;
let guestQrDetector = null;
let guestQrScanTimer = null;
let guestQrScanBusy = false;

function setGuestQrStatus(message, kind = "") {
  const target = document.getElementById("guestQrStatus");
  if (!target) return;
  target.className = `status ${kind}`.trim();
  target.textContent = String(message || "");
}

function easyBevQrHostAllowed(hostname) {
  const host = String(hostname || "").toLowerCase();
  const current = String(window.location.hostname || "").toLowerCase();
  return host === current || ["easybev.co.za", "www.easybev.co.za", "vusilesani.github.io"].includes(host);
}

function resolveEasyBevGuestQr(rawValue) {
  try {
    const url = new URL(String(rawValue || ""), window.location.href);
    const slot = String(url.searchParams.get("guest") || "").trim();
    const venue = String(url.searchParams.get("venue") || EASYBEV_DEFAULT_VENUE_ID).trim();
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    if (!easyBevQrHostAllowed(url.hostname)) return null;
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(slot)) return null;
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(venue)) return null;
    return url;
  } catch (_) {
    return null;
  }
}

function stopGuestQrCamera() {
  if (guestQrScanTimer) {
    clearTimeout(guestQrScanTimer);
    guestQrScanTimer = null;
  }
  guestQrScanBusy = false;
  if (guestQrStream) {
    guestQrStream.getTracks().forEach(track => {
      try { track.stop(); } catch (_) {}
    });
  }
  guestQrStream = null;
  const video = document.getElementById("guestQrVideo");
  if (video) video.srcObject = null;
}

function closeGuestQrScanner() {
  stopGuestQrCamera();
  document.getElementById("guestQrScannerModal")?.classList.add("hidden");
}

async function scanGuestQrFrame() {
  if (!guestQrStream || !guestQrDetector || guestQrScanBusy) return;
  const video = document.getElementById("guestQrVideo");
  if (!video) return;

  guestQrScanBusy = true;
  try {
    const codes = await guestQrDetector.detect(video);
    const value = codes && codes[0] && codes[0].rawValue;
    if (value) {
      const target = resolveEasyBevGuestQr(value);
      if (!target) {
        setGuestQrStatus("That isn't an EasyBev waiter QR.", "warning");
      } else {
        setGuestQrStatus("QR found. Connecting…", "success");
        stopGuestQrCamera();
        window.location.href = target.href;
        return;
      }
    }
  } catch (error) {
    console.warn("QR frame scan failed", error);
  } finally {
    guestQrScanBusy = false;
  }

  guestQrScanTimer = setTimeout(scanGuestQrFrame, 220);
}

async function openGuestQrScanner() {
  const modal = document.getElementById("guestQrScannerModal");
  const video = document.getElementById("guestQrVideo");
  if (!modal || !video) return;

  modal.classList.remove("hidden");
  setGuestQrStatus("Opening camera…");

  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    setGuestQrStatus("Camera access isn't available here. Use your phone camera to scan the waiter QR.", "warning");
    return;
  }

  if (!("BarcodeDetector" in window)) {
    setGuestQrStatus("This browser can't scan QR codes inside EasyBev. Use your phone camera to scan the waiter QR.", "warning");
    return;
  }

  try {
    const formats = typeof BarcodeDetector.getSupportedFormats === "function"
      ? await BarcodeDetector.getSupportedFormats()
      : ["qr_code"];
    if (Array.isArray(formats) && !formats.includes("qr_code")) {
      setGuestQrStatus("QR scanning isn't supported by this browser. Use your phone camera instead.", "warning");
      return;
    }

    guestQrDetector = new BarcodeDetector({ formats: ["qr_code"] });
    guestQrStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } }
    });
    video.srcObject = guestQrStream;
    await video.play();
    setGuestQrStatus("Point the camera at the waiter QR.");
    scanGuestQrFrame();
  } catch (error) {
    console.warn("EasyBev camera access failed", error);
    stopGuestQrCamera();
    const denied = String(error && error.name || "") === "NotAllowedError";
    setGuestQrStatus(
      denied
        ? "Camera permission was blocked. Allow camera access or use your phone camera app."
        : "Could not open the camera. Use your phone camera to scan the waiter QR.",
      "warning"
    );
  }
}

window.addEventListener("pagehide", stopGuestQrCamera);
