!macro customInstall
  CreateShortCut "$DESKTOP\World Maps.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
  CreateDirectory "$SMPROGRAMS\World Maps"
  CreateShortCut "$SMPROGRAMS\World Maps\World Maps.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
!macroend

Function .onInstSuccess
  MessageBox MB_OK|MB_ICONINFORMATION "World Maps is installed.$\r$\n$\r$\nLook for the World Maps icon on your Desktop or in the Start menu.$\r$\n$\r$\nIf Windows blocks it, right-click World Maps.exe → Properties → Unblock."
FunctionEnd
