import type{TrainingItem}from"../types/index.js"
export interface ProvenanceData{
    sourceFile:string
    chunkIndex:number
    model:string
    promptType:string
    timestamp:string// ISO 8601
    _mergedFrom?:string[]
}
export function tagItem(item:TrainingItem,provenance:ProvenanceData):TrainingItem{
    return{
        ...item,
        _provenance:provenance
    }
}
function cloneItem(item:TrainingItem):TrainingItem{
    return{...item}
}
export function mergeProvenance(surviving:TrainingItem,removed:TrainingItem):TrainingItem{
    let existing=surviving._provenance as ProvenanceData|undefined
    let removedProv=removed._provenance as ProvenanceData|undefined
    if(!removedProv)return cloneItem(surviving)
    if(!existing){
        return{
            ...cloneItem(surviving),
            _provenance:{
                ...removedProv,
                _mergedFrom:[removedProv.sourceFile]
            }
        }
    }
    return{
        ...cloneItem(surviving),
        _provenance:{
            ...existing,
            _mergedFrom:[...(existing._mergedFrom||[]),removedProv.sourceFile]
        }
    }
}
