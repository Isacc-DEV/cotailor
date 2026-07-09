import { Controller, Get } from '@nestjs/common';
import { TaxonomyService } from './taxonomy.service';

// Read-only tree for the profile form (any signed-in user). Enabled entries only.
@Controller('taxonomy')
export class TaxonomyController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  @Get()
  tree() {
    return this.taxonomy.tree(false);
  }
}
