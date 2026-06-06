declare function describe(name:string,fn:()=>void):void
declare function test(name:string,fn:()=>Promise<void>|void):void
declare function expect(value:unknown):{toContain:(expected:string)=>void;toBe:(expected:unknown)=>void}
