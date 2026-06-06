export default{
    transform:{
        "^.+\\.tsx?$":["ts-jest",{
            tsconfig:"tsconfig.json",
            useESM:true
        }]
    },
    extensionsToTreatAsEsm:[".ts"],
    moduleNameMapper:{
        "^(\\.{1,2}/.*)\\.js$":"$1"
    },
    testMatch:["**/tests/**/*.test.ts"]
}
