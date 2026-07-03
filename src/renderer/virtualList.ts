interface VirtualListOptions<T>{
    container:HTMLElement
    items:T[]
    itemHeight:number
    renderItem:(item:T,index:number)=>HTMLElement|string
}
let listenerMap=new WeakMap<HTMLElement,EventListener>()
export function createVirtualList<T>(options:VirtualListOptions<T>):{destroy:()=>void}{
    let {container,items,itemHeight,renderItem}=options
    let oldListener=listenerMap.get(container)
    if(oldListener){
        container.removeEventListener("scroll",oldListener)
    }
    container.innerHTML=""
    container.style.overflowY="auto"
    container.style.position="relative"
    let spacer=document.createElement("div")
    spacer.style.position="relative"
    container.appendChild(spacer)
    let viewport=document.createElement("div")
    viewport.style.position="absolute"
    viewport.style.top="0"
    viewport.style.left="0"
    viewport.style.right="0"
    container.appendChild(viewport)
    let renderedRange:{start:number;end:number}={start:-1,end:-1}
    let resizeObserver:ResizeObserver|null=null
    const MAX_SPACER_PIXELS=1000000
    function getItemCount():number{
        return items.length
    }
    function updateSpacerHeight():void{
        let itemCount=getItemCount()
        let trueHeight=itemCount*itemHeight
        spacer.style.height=`${Math.min(trueHeight,MAX_SPACER_PIXELS)}px`
    }
    function scrollTopToStartIndex(scrollTop:number,containerHeight:number):number{
        let itemCount=getItemCount()
        let visibleCount=Math.ceil(containerHeight/itemHeight)+1
        let trueHeight=itemCount*itemHeight
        let spacerHeight=Math.min(trueHeight,MAX_SPACER_PIXELS)
        if(spacerHeight<=containerHeight||trueHeight<=spacerHeight){
            return Math.max(0,Math.floor(scrollTop/itemHeight))
        }
        let maxScroll=spacerHeight-containerHeight
        let ratio=maxScroll>0?scrollTop/maxScroll:0
        return Math.max(0,Math.min(itemCount-visibleCount,Math.floor(ratio*(itemCount-visibleCount))))
    }
    function render():void{
        let itemCount=getItemCount()
        let scrollTop=container.scrollTop
        let containerHeight=container.clientHeight
        let startIndex=scrollTopToStartIndex(scrollTop,containerHeight)
        let visibleCount=Math.ceil(containerHeight/itemHeight)+1
        let endIndex=Math.min(itemCount,startIndex+visibleCount)
        if(startIndex===renderedRange.start&&endIndex===renderedRange.end)return
        renderedRange={start:startIndex,end:endIndex}
        viewport.innerHTML=""
        for(let i=startIndex;i<endIndex;i++){
            let itemEl=document.createElement("div")
            itemEl.style.position="absolute"
            itemEl.style.top=`${i*itemHeight}px`
            itemEl.style.left="0"
            itemEl.style.right="0"
            itemEl.style.height=`${itemHeight}px`
            itemEl.style.overflow="hidden"
            let rendered=renderItem(items[i],i)
            if(typeof rendered==="string"){
                itemEl.innerHTML=rendered
            }
            else{
                itemEl.appendChild(rendered)
            }
            viewport.appendChild(itemEl)
        }
    }
    container.addEventListener("scroll",render,{passive:true})
    listenerMap.set(container,render)
    updateSpacerHeight()
    render()
    if(typeof ResizeObserver!=="undefined"){
        resizeObserver=new ResizeObserver((entries)=>{
            for(let entry of entries){
                if(entry.contentRect.height>0){
                    render()
                }
            }
        })
        resizeObserver.observe(container)
    }
    return {
        destroy:()=>{
            container.removeEventListener("scroll",render)
            listenerMap.delete(container)
            if(resizeObserver){
                resizeObserver.disconnect()
                resizeObserver=null
            }
            if(viewport.parentNode){
                viewport.parentNode.removeChild(viewport)
            }
            if(spacer.parentNode){
                spacer.parentNode.removeChild(spacer)
            }
        }
    }
}
