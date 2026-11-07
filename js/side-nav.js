(function(){
    function syncRail(group){
        document.querySelectorAll('.sn-rail-btn[data-group]').forEach(function(b){
            b.classList.toggle('active', b.getAttribute('data-group') === group);
        });
    }
    function openPanel(){
        document.getElementById('snPanel').classList.add('is-open');
        document.getElementById('snScrim').classList.add('is-open');
        document.getElementById('snLogoBtn').classList.add('is-open');
    }
    function closePanel(){
        document.getElementById('snPanel').classList.remove('is-open');
        document.getElementById('snScrim').classList.remove('is-open');
        document.getElementById('snLogoBtn').classList.remove('is-open');
    }
    function togglePanel(){
        const isOpen = document.getElementById('snPanel').classList.contains('is-open');
        if(isOpen) closePanel(); else openPanel();
    }
    window.SNav = { open: openPanel, close: closePanel, toggle: togglePanel };

    function patch(){
        if(!window.App || !App.UI || !App.UI.switchMainGroup){ setTimeout(patch, 50); return; }
        if(App.UI._railPatched) return;
        const orig = App.UI.switchMainGroup.bind(App.UI);
        App.UI.switchMainGroup = function(group){
            orig(group); syncRail(group); closePanel();
            // Render ulang saat tab baru kelihatan, biar animasi kartu tugas & data terbaru
            // gak "nyangkut" gara-gara sempat dirender waktu tab masih disembunyikan (display:none).
            if(group==='kuliah' && window.KuliahProBridge && window.KuliahProBridge.refresh) window.KuliahProBridge.refresh();
        };
        App.UI._railPatched = true;
        syncRail(App.UI._activeGroup || 'home');
    }
    patch();
})();
