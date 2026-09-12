/* modal-fix.js - toggle body.modal-open and ensure internal modal scrolling */
(function () {
  function openModal(modal) {
    if (!modal) return;
    modal.classList.add('open');
    document.body.classList.add('modal-open');
  }
  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('open');
    // if no other modal is open, remove body class
    if (!document.querySelector('.modal.open')) {
      document.body.classList.remove('modal-open');
    }
  }

  document.addEventListener('click', function (e) {
    // if element has data-open attribute like data-open="#lotModal" or id #viewAllPrices
    const openAttr = e.target.closest('[data-open]') || e.target.closest('#viewAllPrices') || e.target.closest('[data-page-link]');
    if (openAttr) {
      var selector = openAttr.getAttribute && openAttr.getAttribute('data-open');
      var modal = selector ? document.querySelector(selector) : document.querySelector('.modal');
      if (modal) openModal(modal);
      return;
    }

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
      var open = document.querySelector('.modal.open');
      if (open) closeModal(open);
    }
  });
})();
