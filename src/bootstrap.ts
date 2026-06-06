import{app}from "electron"
import "./main"

app.commandLine.appendSwitch("disable-features","TranslateUI")
app.commandLine.appendSwitch("ignore-gpu-blacklist")
