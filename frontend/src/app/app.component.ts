import { Component, OnInit } from '@angular/core'
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms'
import { MatAutocompleteSelectedEvent, MatSnackBar } from '@angular/material'
import { Observable } from 'rxjs'
import { map, startWith } from 'rxjs/operators'
import { Annotator, Article, Descriptor } from './app.model'
import { AppService } from './app.service'

// TODO implementar login contra bbdd
// TODO enviar al backend un descriptor cada vez que el anotador seleccione uno del autocompletar

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  title = 'Text Mining DeCS Indexer'
  // user: Annotator
  annotators: Annotator[] = []
  articles: Article[] = []
  article: Article = {}
  allDescriptors: Descriptor[] = []
  filteredDescriptors: Observable<Descriptor[]>
  myControl = new FormControl()
  decsForm: FormGroup

  // VERISON 1: AUTOCOMPLETAR FUNCIONA OK
  descriptorsString = ''
  descriptorsSimpleArray: string[]
  articleUpdatedDescriptors: Descriptor[] = []

  constructor(
    private appService: AppService,
    private snackBar: MatSnackBar,
    private fb: FormBuilder
  ) {
    this.initForm()
  }

  get annotator() { return this.decsForm.get('annotator') as FormControl }
  get descriptors() { return this.decsForm.get('descriptors') as FormArray }

  ngOnInit() {
    this.getDescriptors()
    this.getArticles()
    this.getAnnotators()
  }

  initForm() {
    this.decsForm = this.fb.group({
      id: '',
      annotator: ['', Validators.required],
      descriptors: this.fb.array([])
    })
  }

  resetForm() {
    window.location.reload()
  }

  addDescriptor() {
    this.descriptors.push(this.fb.control(''))
  }

  removeDescriptor(index: number) {
    this.descriptors.removeAt(index)
  }

  getAnnotators() {
    this.appService.getAnnotators().subscribe(data => this.annotators = data)
  }

  getArticle(index: number) {
    this.article = this.articles[index]
  }

  getArticles() {
    this.appService.getArticles(3).subscribe(
      articles => this.articles = articles,
      error => console.warn(error),
      () => {
        // TODO select article by annotator in view
        this.getArticle(0)
        this.article.descriptors.forEach(descriptor => {
          this.descriptors.push(this.fb.control(descriptor))
        })

        this.article.descriptors.forEach(descriptor => {
          this.descriptorsString += `${descriptor.id}\n`
        })
      }
    )
  }

  toArray() {
    this.descriptorsSimpleArray = this.descriptorsString.split(/[\s\.\-,;:]+/)
  }

  getDescriptors() {
    this.allDescriptors = this.appService.getDescriptors()

    // Init filtered descriptors list.
    this.filteredDescriptors = this.myControl.valueChanges.pipe(
      startWith(''),
      map(value => typeof value === 'string' ? value : value.termSpanish),
      map(termSpanish => termSpanish ? this._filterDescriptors(termSpanish) : this.allDescriptors.slice())
    )
  }

  // Filtering.
  private _filterDescriptors(termSpanish: string): Descriptor[] {
    const filterValue = termSpanish.toLowerCase().trim()
    return this.allDescriptors.filter(option => option.termSpanish.toLowerCase().includes(filterValue))
  }

  displayFn(descriptor?: Descriptor): string | undefined {
    return descriptor ? descriptor.id : undefined
  }

  onSelectionChange(event: MatAutocompleteSelectedEvent) {
    this.descriptors.push(this.fb.control({
      id: event.option.value.id,
      added: {
        by: this.annotator.value,
        on: Date.now() / 1000
      }
    }))
  }

  saveChanges() {
    this.decsForm.controls.id.setValue(this.article.id)
    console.log(this.decsForm.value)

    // Send request to backend
    // this.appService.updateArticle(this.article).subscribe(bu => console.trace(bu))

    this.snackBar.open('DeCS saved successfully.', 'OK', {
      duration: 5000
    })

  }

  // https://www.freecodecamp.org/news/best-practices-for-a-clean-and-performant-angular-application-288e7b39eb6f/
  trackByFn(index: number, item: any) {
    return item.id // unique id corresponding to the item
  }

}
