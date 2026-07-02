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
    spacer.style.height=`${items.length*itemHeight}px`
    spacer.style.position="relative"
    container.appendChild(spacer)
    let viewport=document.createElement("div")
    viewport.style.position="absolute"
    viewport.style.top="0"
    viewport.style.left="0"
    viewport.style.right="0"
    container.appendChild(viewport)
    let renderedRange:{start:number;end:number}={start:-1,end:-1}
    function render():void{
        let scrollTop=container.scrollTop
        let containerHeight=container.clientHeight
        let startIndex=Math.max(0,Math.floor(scrollTop/itemHeight))
        let visibleCount=Math.ceil(containerHeight/itemHeight)+1
        let endIndex=Math.min(items.length,startIndex+visibleCount)
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
    render()
    return {
        destroy:()=>{
            container.removeEventListener("scroll",render)
            listenerMap.delete(container)
        }
    }
}
