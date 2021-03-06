import { AfterViewInit, Component, EventEmitter, Input, Output, ViewChild } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { DescriptorsComponent } from 'src/app/components/descriptors/descriptors.component'
import { DialogComponent } from 'src/app/components/dialog/dialog.component'
import { Doc } from 'src/app/models/decs'
import { FormConfig } from 'src/app/models/form'
import { ApiService } from 'src/app/services/api.service'
import { AuthService } from 'src/app/services/auth.service'

@Component({
  selector: 'app-doc',
  templateUrl: './doc.component.html',
  styleUrls: ['./doc.component.scss']
})
export class DocComponent implements AfterViewInit {

  @Input() doc: Doc
  @ViewChild('indexings') indexings: DescriptorsComponent
  @ViewChild('validations') validations: DescriptorsComponent
  @Output() completed = new EventEmitter<boolean>()
  @Output() validated = new EventEmitter<boolean>()
  formConfigDescriptors: FormConfig = {
    label: 'Indización',
    hint: `Puedes buscar un descriptor por su término en español, término en inglés, número de registro (DeCS),
    código MeSH análogo o alguno de sus sinónimos aceptados.`,
    buttonName: 'Completado',
    color: 'primary',
    action: 'complete'
  }
  formConfigValidations: FormConfig = {
    label: 'Validación',
    hint: `El icono rojo indica que ese descriptor ha sido añadido por ti en la fase 1 de indización; el resto son sugerencias.`,
    buttonName: 'Validado',
    color: 'accent',
    action: 'validate'
  }

  constructor(
    public api: ApiService,
    private auth: AuthService,
    public dialog: MatDialog,
  ) { }

  ngAfterViewInit() { }

  /**
   * Open a confirmation dialog before mark a document as completed/validated and apply changes to backend.
   */
  confirmDialogBeforeMark(action: string): void {
    let title: string
    let content: string
    let buttonName: string
    let color: string
    switch (action) {
      case 'complete':
        title = 'Esta acción no se puede revertir.'
        content = '¿Quieres marcar este documento como completado?'
        buttonName = 'Completar'
        color = 'primary'
        break
      case 'validate':
        title = 'Esta acción no se puede revertir.'
        content = '¿Quieres marcar este documento como validado?'
        buttonName = 'Validar'
        color = 'accent'
        break
    }
    const dialogRef = this.dialog.open(DialogComponent, {
      width: '500px',
      data: {
        title,
        content,
        cancel: 'Cancelar',
        buttonName,
        color
      }
    })
    dialogRef.afterClosed().subscribe(confirmation => {
      if (confirmation) {
        switch (action) {
          case 'complete':
            if (this.indexings.chips.length === 0) {
              alert('Atención: no hay ningún código añadido.')
              return
            }
            this.doc.completed = true
            this.completed.emit(true)
            this.api.markAsCompleted({ doc: this.doc.id, user: this.auth.getCurrentUser().id }).subscribe()
            break
          case 'validate':
            if (this.validations.chips.length === 0) {
              alert('Atención: no hay ningún código añadido.')
              return
            }
            this.doc.validated = true
            this.validated.emit(true)
            this.api.markAsValidated({ doc: this.doc.id, user: this.auth.getCurrentUser().id }).subscribe()
            const validatedAnnotations = []
            this.validations.chips.forEach(chip => {
              validatedAnnotations.push({
                decsCode: chip.decsCode,
                user: this.auth.getCurrentUser().id,
                doc: this.doc.id,
              })
            })
            this.api.saveValidatedAnnotations(validatedAnnotations).subscribe()
            break
        }
      }
    })
  }

}
