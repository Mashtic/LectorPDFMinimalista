!ifndef BUILD_UNINSTALLER
  Function OpenDefaultAppsSettings
    ExecShell "open" "ms-settings:defaultapps"
  FunctionEnd
!endif

!macro customFinishPage
  !define MUI_FINISHPAGE_SHOWREADME ""
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Set Folio as default PDF viewer"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION OpenDefaultAppsSettings
  !define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
  !insertmacro MUI_PAGE_FINISH
!macroend
