// Runs inside the isolated WebView; no network or React dependencies.
export const readerRuntime = String.raw`
(function () {
  const state = JSON.parse(document.getElementById('reader-data').textContent);
  const book = document.getElementById('book');
  const viewport = document.getElementById('viewport');
  const footer = document.getElementById('position');
  let current = 0, count = 1, columns = 1, stride = 1, currentAnchor = state.anchor;
  let selectionTimer, positionTimer, touchStart, selecting = false;
  let settings = state.settings, highlights = state.highlights;
  const post = value => {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(value));
    else window.dispatchEvent(new CustomEvent('folio-message', {detail:value}));
  };
  function nodes(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const result = []; let node;
    while ((node = walker.nextNode())) if (node.length) result.push(node);
    return result;
  }
  function point(anchor) {
    const element = document.getElementById(anchor.blockId);
    if (!element) return null;
    let offset = Math.max(0, anchor.offset);
    for (const node of nodes(element)) {
      if (offset <= node.length) return {node, offset};
      offset -= node.length;
    }
    const list = nodes(element), node = list[list.length-1];
    return node ? {node,offset:node.length} : {element};
  }
  function anchorAt(node, offset) {
    const element = (node.nodeType === 1 ? node : node.parentElement).closest('[data-block]');
    if (!element || !book.contains(element) || element.tagName === 'FIGURE') return null;
    const range = document.createRange(); range.selectNodeContents(element);
    range.setEnd(node, offset);
    return {blockId:element.id, offset:range.toString().length};
  }
  function visibleAnchor() {
    // Character rectangles, not paragraph starts, preserve position in long paragraphs.
    const left = viewport.getBoundingClientRect().left;
    const right = viewport.getBoundingClientRect().right;
    for (const element of book.querySelectorAll('[data-block]')) {
      if(element.tagName==='FIGURE') {
        if(Array.from(element.getClientRects()).some(r=>r.right>left+1 && r.left<right-1)) return {blockId:element.id,offset:0};
        continue;
      }
      let offset = 0;
      for (const node of nodes(element)) {
        const range = document.createRange(); range.selectNodeContents(node);
        if (!Array.from(range.getClientRects()).some(r => r.right > left + 1 && r.left < right - 1)) {
          offset += node.length; continue;
        }
        let lo = 0, hi = Math.max(0,node.length-1);
        while (lo < hi) {
          const mid = Math.floor((lo+hi)/2);
          range.setStart(node,mid); range.setEnd(node,Math.min(node.length,mid+1));
          if (range.getBoundingClientRect().right <= left + 1) lo=mid+1; else hi=mid;
        }
        return {blockId:element.id,offset:offset+lo};
      }
    }
    return {blockId:state.book.blocks[0].id,offset:0};
  }
  function report() {
    currentAnchor = visibleAnchor();
    const block = state.book.blocks.find(b=>b.id===currentAnchor.blockId);
    post({type:'position', anchor:currentAnchor, page:current+1, total:count,
      sourcePage:block ? block.sourcePage : 1, progress:count===1?0:current/(count-1)});
  }
  function go(index, animate) {
    current = Math.max(0, Math.min(count-1,index));
    book.style.transition = animate && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'transform 190ms ease-out' : 'none';
    book.style.transform = 'translateX(' + (-current*stride) + 'px)';
    footer.textContent = (current+1)+' / '+count + (columns===2 ? ' · doble página' : '');
    clearTimeout(positionTimer); positionTimer=setTimeout(report,220);
  }
  function jump(anchor) {
    const p = point(anchor);
    if (!p) {go(current,false);return;}
    let rect;
    if(p.element) rect=p.element.getBoundingClientRect();
    else {
      const range = document.createRange(); range.setStart(p.node,p.offset);
      range.setEnd(p.node,Math.min(p.node.length,p.offset+1));
      rect=range.getBoundingClientRect();
    }
    const x = rect.left - viewport.getBoundingClientRect().left + current*stride;
    go(Math.floor(Math.max(0,x)/stride),false);
  }
  function layout(anchor) {
    const width=viewport.clientWidth;
    columns = settings.columns==='two' || (settings.columns==='auto' && innerWidth>=840) ? 2 : 1;
    document.documentElement.dataset.theme=settings.theme;
    book.style.fontSize=settings.fontSize+'px'; book.style.lineHeight=settings.lineHeight;
    book.style.columnCount=columns;
    stride=width+40;
    // Stop the prior turn before measuring: otherwise its in-flight transform
    // corrupts the anchor rectangle during font/column changes.
    book.style.transition='none'; book.style.transform='none'; current=0;
    count=Math.max(1,Math.ceil((book.scrollWidth+40)/stride));
    if(anchor) jump(anchor); else go(0,false);
  }
  function selection() {
    const s=window.getSelection();
    if(!s || s.isCollapsed || !s.rangeCount) { selecting=false; post({type:'selection',selection:null}); return; }
    const r=s.getRangeAt(0), start=anchorAt(r.startContainer,r.startOffset), end=anchorAt(r.endContainer,r.endOffset);
    if(!start || !end) return;
    selecting=true;
    post({type:'selection',selection:{start,end,quote:s.toString().slice(0,24000)}});
  }
  function paint() {
    for(const mark of Array.from(book.querySelectorAll('mark'))) mark.replaceWith(...mark.childNodes);
    book.normalize();
    const blocks=Array.from(book.querySelectorAll('[data-block]'));
    for(const h of highlights) {
      const first=blocks.findIndex(b=>b.id===h.start.blockId),last=blocks.findIndex(b=>b.id===h.end.blockId);
      if(first<0 || last<first) continue;
      blocks.slice(first,last+1).forEach((element,i,list)=>{
        const start=i===0?h.start.offset:0, end=i===list.length-1?h.end.offset:element.textContent.length;
        let offset=0;
        for(const node of nodes(element)) {
          const a=Math.max(0,start-offset),b=Math.min(node.length,end-offset); offset+=node.length;
          if(b<=a) continue;
          const range=document.createRange();range.setStart(node,a);range.setEnd(node,b);
          const mark=document.createElement('mark');mark.dataset.highlight=h.id;range.surroundContents(mark);
        }
      });
    }
  }
  window.folio={
    next:()=>go(current+1,true), previous:()=>go(current-1,true), jump,
    settings:value=>{const a=visibleAnchor();settings=value;layout(a);},
    highlights:value=>{const a=visibleAnchor();highlights=value;paint();layout(a);},
    clearSelection:()=>{window.getSelection().removeAllRanges();selecting=false;},
    section:()=>{
      const a=visibleAnchor(),i=state.book.blocks.findIndex(b=>b.id===a.blockId);
      const nextHeading=state.book.blocks.findIndex((b,j)=>j>i&&b.kind==='heading');
      const text=state.book.blocks.slice(i,nextHeading<0?undefined:nextHeading).map((b,index)=>index===0?b.text.slice(a.offset):b.text).join('\n');
      post({type:'section',text:text.slice(0,24000)});
    }
  };
  document.addEventListener('selectionchange',()=>{clearTimeout(selectionTimer);selectionTimer=setTimeout(selection,180);});
  viewport.addEventListener('touchstart',e=>{touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY,time:Date.now(),table:!!e.target.closest('.table-wrap')};},{passive:true});
  viewport.addEventListener('touchend',e=>{
    if(!touchStart || touchStart.table || selecting || !window.getSelection().isCollapsed) return;
    const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;
    if(Date.now()-touchStart.time<450 && Math.abs(dx)>75 && Math.abs(dx)>Math.abs(dy)*1.5) go(current+(dx<0?1:-1),true);
  },{passive:true});
  let resizeTimer;
  window.addEventListener('resize',()=>{const a=currentAnchor;clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>layout(a),100);});
  const images=Array.from(document.images).map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;}));
  Promise.all(images).then(()=>document.fonts.ready).then(()=>{paint();layout(currentAnchor);post({type:'ready'});});
})();
`;
