import { inject, Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class KpiService {
  private readonly api = inject(ApiService);

  getKpis() {
    return this.api.getKpis();
  }
}
