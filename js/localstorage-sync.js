// localstorage-sync.js
// Monkeypatch localStorage to persist changes to the server-side content API
(function(){
  if (!window.fetch || !window.localStorage) return;
  var _set = Storage.prototype.setItem;
  var _remove = Storage.prototype.removeItem;

  function tryParse(value){ try{ return JSON.parse(value); }catch(e){ return null; } }

  // On load, fetch content keys and hydrate localStorage if empty
  function notifyHydrated(){
    try{
      window._localstorageHydrated = true;
      window.dispatchEvent(new CustomEvent('localstorage-hydrated'));
    }catch(e){}
  }

  fetch('/api/content').then(function(r){ if(!r.ok) throw new Error('no'); return r.json(); }).then(function(keys){
    if(!Array.isArray(keys)){
      notifyHydrated();
      return;
    }
    var promises = keys.map(function(k){
      try{
        if (localStorage.getItem(k) == null) {
          return fetch('/api/content/' + encodeURIComponent(k)).then(function(r){ if(!r.ok) throw new Error('no'); return r.json(); }).then(function(data){
            try{ _set.call(localStorage, k, JSON.stringify(data)); }catch(e){}
            return true;
          }).catch(function(){ return false; });
        }
      }catch(e){ }
      return Promise.resolve(true);
    });
    Promise.all(promises).then(function(){ notifyHydrated(); });
  }).catch(function(){ notifyHydrated(); });

  // Debounced POST helper
  var timers = {};
  function postContentDebounced(key, value){
    if(timers[key]) clearTimeout(timers[key]);
    timers[key] = setTimeout(function(){
      timers[key] = null;
      try{
        fetch('/api/content/' + encodeURIComponent(key), {
          method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(value)
        }).catch(function(){});
      }catch(e){}
    }, 250);
  }

  Storage.prototype.setItem = function(key, value){
    try{ _set.call(this, key, value); }catch(e){}
    // attempt to parse JSON, else store raw string on server as { raw: "..." }
    var parsed = tryParse(value);
    var payload = parsed !== null ? parsed : { __raw: String(value) };
    postContentDebounced(key, payload);
  };

  Storage.prototype.removeItem = function(key){
    try{ _remove.call(this, key); }catch(e){}
    try{ fetch('/api/content/' + encodeURIComponent(key), { method: 'DELETE' }).catch(function(){}); }catch(e){}
  };

})();
