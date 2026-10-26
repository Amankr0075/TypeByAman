' TypeByAman — Silent Native Helper Launcher (Zero Console Window)
' Author: Aman Kumar | github.com/Amankr0075

Set FSO = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")

scriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
batPath = scriptDir & "\start-helper.bat"

WshShell.CurrentDirectory = scriptDir
WshShell.Run """" & batPath & """", 0, False
