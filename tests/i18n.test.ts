import{describe, test, expect}from"vitest"
import{I18n, interpolate, pluralize, select, LocaleMessages}from"../src/core/i18n.js"
describe("I18n", ()=>{
    test("t returns translated string", ()=>{
        let i18n=new I18n({
            locale: "en",
            messages: {
                en: {
                    hello: "Hi"
                }
            }
        })
        expect(i18n.t("hello")).toBe("Hi")
    })
    test("fallback to fallbackLocale", ()=>{
        let i18n=new I18n({
            locale: "fr",
            fallbackLocale: "en",
            messages: {
                en: {
                    hello: "Hi"
                }
            }
        })
        expect(i18n.t("hello")).toBe("Hi")
    })
    test("interpolate variables", ()=>{
        let i18n=new I18n({
            locale: "en",
            messages: {
                en: {
                    greeting: "Hello {name}"
                }
            }
        })
        expect(i18n.t("greeting", {name: "World"})).toBe("Hello World")
    })
    test("tc pluralizes one form", ()=>{
        let i18n=new I18n({
            locale: "en",
            messages: {
                en: {
                    items: "{count, plural, one {# item} other {# items}}"
                }
            }
        })
        expect(i18n.tc("items", 1)).toBe("1 item")
    })
    test("tc pluralizes other form", ()=>{
        let i18n=new I18n({
            locale: "en",
            messages: {
                en: {
                    items: "{count, plural, one {# item} other {# items}}"
                }
            }
        })
        expect(i18n.tc("items", 5)).toBe("5 items")
    })
    test("pluralize with offset", ()=>{
        let message="{count, plural, offset:1 one {# item} other {# items}}"
        expect(pluralize(message, 2)).toBe("1 item")
        expect(pluralize(message, 3)).toBe("2 items")
    })
    test("select male", ()=>{
        let message="{gender, select, male {he} female {she} other {they}}"
        expect(select(message, "male")).toBe("he")
    })
    test("select female", ()=>{
        let message="{gender, select, male {he} female {she} other {they}}"
        expect(select(message, "female")).toBe("she")
    })
    test("select other", ()=>{
        let message="{gender, select, male {he} female {she} other {they}}"
        expect(select(message, "unknown")).toBe("they")
    })
    test("detect locale from injected detector", ()=>{
        let i18n=new I18n({
            detectLocale: ()=>"de-DE"
        })
        expect(i18n.detectLocale()).toBe("de-DE")
    })
    test("loadLocaleMessages adds translations", ()=>{
        let i18n=new I18n({locale: "en"})
        i18n.loadLocaleMessages("en", {
            hello: "Hi"
        })
        expect(i18n.t("hello")).toBe("Hi")
    })
    test("nested key lookup", ()=>{
        let i18n=new I18n({
            locale: "en",
            messages: {
                en: {
                    user: {
                        name: "John"
                    }
                }
            }
        })
        expect(i18n.t("user.name")).toBe("John")
    })
    test("missing key returns key", ()=>{
        let i18n=new I18n({locale: "en"})
        expect(i18n.t("missing.key")).toBe("missing.key")
    })
    test("setLocale and getLocale", ()=>{
        let i18n=new I18n({locale: "en"})
        expect(i18n.getLocale()).toBe("en")
        i18n.setLocale("fr")
        expect(i18n.getLocale()).toBe("fr")
    })
    test("fallback chain uses current locale first", ()=>{
        let i18n=new I18n({
            locale: "fr",
            fallbackLocale: "en",
            messages: {
                fr: {
                    hello: "Bonjour"
                },
                en: {
                    hello: "Hi"
                }
            }
        })
        expect(i18n.t("hello")).toBe("Bonjour")
    })
    test("tc with interpolation", ()=>{
        let i18n=new I18n({
            locale: "en",
            messages: {
                en: {
                    greeting: "{count, plural, one {One item for {name}} other {# items for {name}}}"
                }
            }
        })
        expect(i18n.tc("greeting", 1, {name: "Ada"})).toBe("One item for Ada")
        expect(i18n.tc("greeting", 5, {name: "Ada"})).toBe("5 items for Ada")
    })
    test("interpolate replaces missing with empty string", ()=>{
        expect(interpolate("Hello {name}", {})).toBe("Hello ")
    })
    test("interpolate standalone", ()=>{
        expect(interpolate("Count: {count}", {count: 42})).toBe("Count: 42")
    })
    test("loadLocaleMessages merges nested messages", ()=>{
        let i18n=new I18n({
            locale: "en",
            messages: {
                en: {
                    user: {
                        name: "John"
                    }
                }
            }
        })
        i18n.loadLocaleMessages("en", {
            user: {
                age: "30"
            }
        })
        expect(i18n.t("user.name")).toBe("John")
        expect(i18n.t("user.age")).toBe("30")
    })
    test("t processes select via interpolations", ()=>{
        let i18n=new I18n({
            locale: "en",
            messages: {
                en: {
                    greeting: "{gender, select, male {Mr.} female {Ms.} other {Mx.}} {name}"
                }
            }
        })
        expect(i18n.t("greeting", {gender: "male", name: "John"})).toBe("Mr. John")
    })
    test("tc returns key for missing key", ()=>{
        let i18n=new I18n({locale: "en"})
        expect(i18n.tc("missing", 1)).toBe("missing")
    })
    test("pluralize standalone leaves plain messages", ()=>{
        expect(pluralize("hello", 1)).toBe("hello")
    })
    test("select standalone returns message when no select block", ()=>{
        expect(select("hello", "male")).toBe("hello")
    })
})