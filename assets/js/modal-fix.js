/* modal-fix.js - toggle body.modal-open and ensure internal modal scrolling */
(function () {
  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('open');
    if (modal.id === 'cameraModal') {
      var video = document.getElementById('cameraFeed');
      if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(function (track) { track.stop(); });
        video.srcObject = null;
        video.style.display = 'none';
      }
      var fallback = document.querySelector('.camera-fallback');
      if (fallback) fallback.style.display = 'grid';
    }
    if (modal.id === 'cameraModal' || modal.id === 'qualityModal') {
      var lot = document.getElementById('lotModal');
      if (lot) lot.classList.add('open');
      document.body.classList.add('modal-open');
    }
    if (!document.querySelector('.modal.open')) {
      document.body.classList.remove('modal-open');
    }
  }

  document.addEventListener('click', function (e) {
    // close handlers: any element with data-close or .modal-close, or clicking outside modal-box (on overlay)
    if (e.target.closest('[data-close]') || e.target.closest('.modal-close')) {
      var modal = e.target.closest('.modal');
      if (modal) closeModal(modal);
      return;
    }

    // clicking on overlay (but not inside modal-box) should close
    var overlay = e.target.closest('.modal');
    if (overlay && !e.target.closest('.modal-box')) {
      closeModal(overlay);
      return;
    }
  });

  // close via Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var open = Array.prototype.slice.call(document.querySelectorAll('.modal.open')).pop();
      if (open) closeModal(open);
    }
  });
})();
