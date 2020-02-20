import { Pipe, PipeTransform } from '@angular/core'

@Pipe({
  name: 'highlight'
})
export class HighlightPipe implements PipeTransform {

  transform(value: string, search: string): string {
    return value.replace(
      new RegExp('(?![^&;]+;)(?!<[^<>]*)(' + search + ')(?![^<>]*>)(?![^&;]+;)', 'gi'),
      '<strong>$1</strong>'
    )
  }

}
