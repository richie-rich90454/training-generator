declare describe:(name:string,fn:()=>void)=>void
declare test:(name:string,fn:()=>Promise<void>|void)=>void
declare expect:(value:unknown)=>{toContain:(expected:string)=>void;toBe:(expected:unknown)=>void}
