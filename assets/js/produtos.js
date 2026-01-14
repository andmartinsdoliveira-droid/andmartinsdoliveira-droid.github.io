document.addEventListener('DOMContentLoaded', () => {

    /* ===============================
       ELEMENTOS BASE
    =============================== */

    const imagensProduto = Array.from(
        document.querySelectorAll('.produto-img, .miniatura-img')
    );

    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const btnPrev = document.getElementById('prevLightbox');
    const btnNext = document.getElementById('nextLightbox');
    const btnClose = document.getElementById('closeLightbox');

    if (!imagensProduto.length || !lightbox || !lightboxImg) return;

    /* ===============================
       ESTADO
    =============================== */

    const imagens = imagensProduto.map(img => img.src);
    let indexAtual = 0;
    let swipeBloqueado = false;
    let touchStartX = 0;
    let touchEndX = 0;

    /* ===============================
       LIGHTBOX
    =============================== */

    function abrirLightbox(index) {
        indexAtual = index;
        atualizarImagem();
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function fecharLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }

    function atualizarImagem() {
        lightboxImg.src = imagens[indexAtual];
    }

    function proximaImagem() {
        if (swipeBloqueado) return;
        indexAtual = (indexAtual + 1) % imagens.length;
        atualizarImagem();
    }

    function imagemAnterior() {
        if (swipeBloqueado) return;
        indexAtual = (indexAtual - 1 + imagens.length) % imagens.length;
        atualizarImagem();
    }

    /* ===============================
       EVENTOS DESKTOP
    =============================== */

    btnPrev?.addEventListener('click', imagemAnterior);
    btnNext?.addEventListener('click', proximaImagem);
    btnClose?.addEventListener('click', fecharLightbox);

    lightbox.addEventListener('click', e => {
        if (e.target === lightbox) fecharLightbox();
    });

    /* ===============================
       CLICK NAS IMAGENS / MINIATURAS
    =============================== */

    imagensProduto.forEach((img, index) => {
        img.addEventListener('click', () => abrirLightbox(index));
    });

    /* ===============================
       SWIPE MOBILE
    =============================== */

    lightboxImg.addEventListener('touchstart', e => {
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
        }
    }, { passive: true });

    lightboxImg.addEventListener('touchmove', e => {
        if (e.touches.length > 1) return;
        touchEndX = e.touches[0].clientX;
    }, { passive: true });

    lightboxImg.addEventListener('touchend', () => {
        if (swipeBloqueado) return;

        const diff = touchStartX - touchEndX;

        if (Math.abs(diff) > 50) {
            diff > 0 ? proximaImagem() : imagemAnterior();
        }
    });

    /* ===============================
       TRAVA INTELIGENTE DE ZOOM
       (1 dedo = swipe | 2 dedos = zoom)
    =============================== */

    if (window.visualViewport) {
        visualViewport.addEventListener('resize', () => {
            swipeBloqueado = visualViewport.scale > 1;
        });
    }

});
