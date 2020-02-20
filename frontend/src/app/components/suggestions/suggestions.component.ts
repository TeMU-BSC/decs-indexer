import { Component, OnChanges, Input, ViewChild, ElementRef } from '@angular/core'
import { Doc, Descriptor } from 'src/app/models/decs'
import { DialogComponent } from '../dialog/dialog.component'
import { ApiService } from 'src/app/services/api.service'
import { AuthService } from 'src/app/services/auth.service'
import { MatDialog } from '@angular/material/dialog'
import { MatSnackBar } from '@angular/material/snack-bar'
import { MatAutocomplete, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete'
import { FormControl } from '@angular/forms'
import { ENTER } from '@angular/cdk/keycodes'
import { Observable } from 'rxjs'
import { customSort, removeAccents } from 'src/app/utilities/functions'
import { debounceTime, startWith, map } from 'rxjs/operators'
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop'

@Component({
  selector: 'app-suggestions',
  templateUrl: './suggestions.component.html',
  styleUrls: ['./suggestions.component.scss']
})
export class SuggestionsComponent implements OnChanges {

  @Input() doc: Doc
  @ViewChild('chipInput') chipInput: ElementRef<HTMLInputElement>
  @ViewChild('auto') matAutocomplete: MatAutocomplete
  // Set up reactive formControl
  autocompleteChipList = new FormControl()
  // Set up values to use with chips
  addOnBlur = true
  removable = true
  selectable = true
  separatorKeysCodes: number[] = [ENTER]
  // Set up options array
  options: Descriptor[]
  precodedDescriptors: Descriptor[]
  // Define filteredOptins Array and Chips Array
  filteredOptions: Observable<Descriptor[]>
  chips = []
  suggestionChips = []

  constructor(
    public api: ApiService,
    public auth: AuthService,
    public dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    // Init the options
    this.options = this.api.allDescriptors
    // Init the precoded descriptors
    this.precodedDescriptors = this.api.getPrecodedDescriptors()
    // Filter descriptors as the user types in the input field
    this.filteredOptions = this.autocompleteChipList.valueChanges.pipe(
      debounceTime(100),
      startWith(''),
      map((value: string | null) => value
        ? this.customFilter(value, 'termSpanish')
        : this.precodedDescriptors.filter(d => !this.chips.includes(d)))
    )
  }

  /**
   * This component implements OnChanges method so it can react to parent changes on its @Input() 'doc' property.
   */
  ngOnChanges() {
    // Update the chip lists
    const decsCodes = this.options.filter(descriptor => this.doc.decsCodes.includes(descriptor.decsCode))
    const decsCodesValidated = this.options.filter(descriptor => this.doc.decsCodesValidated.includes(descriptor.decsCode))
    decsCodesValidated.forEach(decsCode => {
      decsCode.new = true
    })
    this.chips = decsCodes.concat(decsCodesValidated)
    this.suggestionChips = this.options.filter(descriptor => this.doc.suggestions.includes(descriptor.decsCode))
  }

  /**
   * Custom filter for the descriptors.
   */
  customFilter(input: string, sortingKey: string) {
    // Ignore the starting and ending whitespaces. Replace double/multiple whitespaces by single whitespace.
    input = input.trim().replace(/ +(?= )/g, '')
    // If numeric, find the exact decsCode match (there are no decsCodes with 1 digit)
    if (input.length >= 2 && !isNaN(Number(input))) {
      const decsFiltered = this.api.allDescriptors
        .filter(descriptor => descriptor.decsCode.startsWith(input) && !this.chips.includes(descriptor))
      return customSort(decsFiltered, input, 'decsCode')
    }
    // Normalize the lower-cased input
    input = removeAccents(input.toLowerCase())
    // Avoid showing the descriptors that are already added to current doc
    const alreadyAdded = (descriptor: Descriptor) => this.chips.some(chip => chip.decsCode === descriptor.decsCode)
    const subsetToFilter = this.api.allDescriptors.filter(descriptor => !alreadyAdded(descriptor))
    // Filter the descriptors by some HARDCODED properties (#TODO refactor)
    const filtered = subsetToFilter.filter(descriptor =>
      removeAccents(descriptor.termSpanish.toLowerCase()).includes(input)
      || removeAccents(descriptor.termEnglish.toLowerCase()).includes(input)
      || removeAccents(descriptor.meshCode.toLowerCase()).includes(input)
      || removeAccents(descriptor.synonyms.toLowerCase()).includes(input)
    )
    // Return the sorted results by matching importance
    return customSort(filtered, input, sortingKey)

    // VERSION 2: filter by its length or grater than its length
    // ...
  }

  /**
   * Add a chip to chip list and send it to the backend to add it to database.
   */
  addChip(event: MatAutocompleteSelectedEvent): void {
    // Get the selected chip from the event
    const selectedDescriptor: Descriptor = event.option.value
    // Add the NEW attribute to the chip
    selectedDescriptor.new = true
    // Add the chip to the chips list
    this.chips.push(selectedDescriptor)
    // Clear the typed text from the input field
    this.chipInput.nativeElement.value = ''
    this.autocompleteChipList.setValue('')
    // Build the object to sent to backend
    const annotationToAdd = {
      decsCode: selectedDescriptor.decsCode,
      user: this.auth.getCurrentUser().id,
      doc: this.doc.id
    }
    // Add the new annotation to database
    this.api.addValidation(annotationToAdd).subscribe()
  }

  /**
   * Remove a chip from the chip list and send it to the backend to remove it from database.
   */
  removeChip(chip: Descriptor): void {
    // Remove chip from input field
    const index = this.chips.indexOf(chip)
    if (index >= 0) {
      this.chips.splice(index, 1)
    }
    // Build the object to sent to backend
    const annotationToRemove = {
      decsCode: chip.decsCode,
      user: this.auth.getCurrentUser().id,
      doc: this.doc.id
    }
    // Remove the annotation from database
    this.api.removeValidation(annotationToRemove).subscribe()
    // Visual information to the user
    const snackBarRef = this.snackBar.open(`DeCS borrado: ${chip.termSpanish} (${chip.decsCode})`, 'DESHACER')
    // If the action button is clicked, re-add the recently removed annotation
    snackBarRef.onAction().subscribe(() => {
      this.chips.push(chip)
      this.api.addValidation(annotationToRemove).subscribe()
    })
  }

  /**
   * Open a confirmation dialog to confirm the removal of a annotation from a document.
   */
  confirmBeforeRemove(chip: Descriptor, title: string): void {
    const dialogRef = this.dialog.open(DialogComponent, {
      width: '350px',
      data: {
        title,
        content: `${chip.termSpanish} (${chip.decsCode})`,
        cancel: 'Cancelar',
        action: 'Borrar'
      }
    })
    dialogRef.afterClosed().subscribe(result => result ? this.removeChip(chip) : null)
  }

  /**
   * Merge with the addChip() method
   * ---> TODO avoid adding the same chip several times
   */
  confirmBeforeMoveChip(chip: Descriptor, title: string) {
    const dialogRef = this.dialog.open(DialogComponent, {
      width: '350px',
      data: {
        title,
        content: `${chip.termSpanish} (${chip.decsCode})`,
        cancel: 'Cancelar',
        action: 'Aceptar'
      }
    })
    dialogRef.afterClosed().subscribe(result => result ? this.acceptSuggestion(chip) : null)
  }

  acceptSuggestion(suggestion: Descriptor) {
    // Add the NEW attribute to the chip
    suggestion.new = true
    // Add the chip to the chips list
    this.chips.push(suggestion)
    // Clear the typed text from the input field
    this.chipInput.nativeElement.value = ''
    this.autocompleteChipList.setValue('')
    // Build the object to sent to backend
    const annotationToAdd = {
      decsCode: suggestion.decsCode,
      user: this.auth.getCurrentUser().id,
      doc: this.doc.id
    }
    // Add the new annotation to database
    this.api.addValidation(annotationToAdd).subscribe()
  }

  drop(event: CdkDragDrop<string[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex)
    } else {
      transferArrayItem(event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex)
    }
  }

}
