; RB YouTube Tools custom uninstall hook
; Shows a checkbox during uninstall to optionally delete downloaded videos

!macro customUnInstall
  ; Ask user if they want to delete downloaded videos
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you also want to delete your downloaded videos from Videos\RB-YouTubeTools?$\n$\nThis will permanently delete all translated captions and downloaded videos." IDNO skip_delete
    StrCpy $4 "$VIDEOS\RB-YouTubeTools"
    ${If} ${FileExists} "$4\*.*"
      RMDir /r "$4"
    ${EndIf}
  skip_delete:
!macroend
