Attribute VB_Name = "ModuloCotizador"
Option Explicit

Public Sub GenerarPDF()
    Dim ws As Worksheet
    Dim carpeta As String
    Dim cliente As String
    Dim archivo As String
    Dim numero As String

    Set ws = ThisWorkbook.Worksheets("COTIZACION")

    If Len(ThisWorkbook.Path) = 0 Then
        MsgBox "Primero guarda el archivo de Excel en una carpeta.", vbExclamation, "Cotizador"
        Exit Sub
    End If

    cliente = Trim(CStr(ThisWorkbook.Worksheets("COTIZADOR").Range("C4").Value))
    If cliente = "" Then cliente = "Cliente"

    numero = Format(Now, "yyyymmdd_hhnnss")
    cliente = LimpiarNombreArchivo(cliente)
    archivo = ThisWorkbook.Path & Application.PathSeparator & _
              "Cotizacion_" & cliente & "_" & numero & ".pdf"

    ws.ExportAsFixedFormat Type:=xlTypePDF, _
                           Filename:=archivo, _
                           Quality:=xlQualityStandard, _
                           IncludeDocProperties:=True, _
                           IgnorePrintAreas:=False, _
                           OpenAfterPublish:=True

    MsgBox "PDF generado correctamente:" & vbCrLf & archivo, vbInformation, "Cotizador"
End Sub

Public Sub NuevaCotizacion()
    With ThisWorkbook.Worksheets("COTIZADOR")
        .Range("C4:C5").ClearContents
        .Range("C6").Value = "15 años"
        .Range("C7").Value = 30
        .Range("C8").Value = "Granada"
        .Range("B15:B34").ClearContents
        .Range("C15:C34").Value = 0
    End With
    MsgBox "La cotización está lista para un nuevo cliente.", vbInformation, "Cotizador"
End Sub

Private Function LimpiarNombreArchivo(ByVal texto As String) As String
    Dim caracteres As Variant
    Dim i As Long
    caracteres = Array("\", "/", ":", "*", "?", """", "<", ">", "|")
    For i = LBound(caracteres) To UBound(caracteres)
        texto = Replace(texto, caracteres(i), "_")
    Next i
    LimpiarNombreArchivo = texto
End Function
